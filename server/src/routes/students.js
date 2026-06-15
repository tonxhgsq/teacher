import express from 'express';
import { db } from '../db/schema.js';

const r = express.Router();
const parse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
const isKnownKnowledgePoint = name => {
  const value = String(name || '').trim();
  return value && !['待判断考察点', '待判断', '未知', '未分类'].includes(value);
};
const knowledgeFromCause = cause => {
  const items = Array.isArray(cause) ? cause : [];
  for (const item of items) {
    if (item && typeof item === 'object' && item.knowledgePoint) return item.knowledgePoint;
  }
  return '';
};
const rowKnowledgeNames = row => {
  const causes = parse(row.cause, []);
  const fromCause = Array.isArray(causes)
    ? causes.map(c => (typeof c === 'string' ? c : c?.knowledgePoint || c?.name)).filter(Boolean)
    : [];
  const names = [row.knowledge_point, ...fromCause].filter(isKnownKnowledgePoint);
  return [...new Set(names)];
};
const rowTime = row => {
  const time = Date.parse(String(row.created_at || '').replace(' ', 'T'));
  return Number.isFinite(time) ? time : 0;
};
const countKnowledge = rows => {
  const map = new Map();
  rows.forEach(row => {
    rowKnowledgeNames(row).forEach(name => map.set(name, (map.get(name) || 0) + 1));
  });
  return map;
};
const fmt = s => ({
  ...s,
  weakPoints: parse(s.weak_points, []),
  errorCauses: parse(s.error_causes, {}),
  homeworkRate: s.homework_rate,
  lastRecord: s.last_record,
  recentErrors: parse(s.recent_errors, []),
  feishuGroupId: s.feishu_group_id,
  weak_points: undefined,
  error_causes: undefined,
  homework_rate: undefined,
  last_record: undefined,
  recent_errors: undefined,
  feishu_group_id: undefined
});

r.get('/', async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT * FROM students WHERE owner_user_id = ? ORDER BY id', args: [req.user.id] });
  res.json(rows.map(fmt));
});

r.get('/:id', async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT * FROM students WHERE id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(fmt(rows[0]));
});

r.get('/:id/learning-profile', async (req, res) => {
  const { rows: studentRows } = await db.execute({ sql: 'SELECT * FROM students WHERE id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  const student = studentRows[0];
  if (!student) return res.status(404).json({ error: 'not found' });

  const { rows } = await db.execute({
    sql: `SELECT mr.id, mr.cause, mr.source, mr.status, mr.mastered_at, mr.created_at, COALESCE(NULLIF(mr.content, ''), q.content, '') AS content, q.knowledge_point, q.type, q.difficulty
          FROM mistake_records mr
          LEFT JOIN questions q ON mr.question_id = q.id
          WHERE mr.student_id = ? AND mr.owner_user_id = ?
          ORDER BY mr.created_at DESC`,
    args: [req.params.id, req.user.id]
  });

  const storedWeakPoints = parse(student.weak_points, []);
  const byKnowledge = new Map();
  const sourceCount = {};
  const timelineMap = new Map();

  const activeRows = rows.filter(row => (row.status || 'active') !== 'mastered');
  const masteredRows = rows.filter(row => (row.status || 'active') === 'mastered');
  const unclassifiedActiveRows = activeRows.filter(row => rowKnowledgeNames(row).length === 0);

  for (const row of activeRows) {
    const uniqueNames = rowKnowledgeNames(row);
    const day = String(row.created_at || '').slice(0, 10) || '未记录日期';

    sourceCount[row.source || 'manual'] = (sourceCount[row.source || 'manual'] || 0) + 1;
    timelineMap.set(day, (timelineMap.get(day) || 0) + 1);

    uniqueNames.forEach(name => {
      const item = byKnowledge.get(name) || {
        name,
        count: 0,
        latestAt: row.created_at,
        latestQuestion: row.content || ''
      };
      item.count += 1;
      if (!item.latestAt || String(row.created_at || '') > String(item.latestAt || '')) {
        item.latestAt = row.created_at;
        item.latestQuestion = row.content || '';
      }
      byKnowledge.set(name, item);
    });
  }

  const knowledgeStats = [...byKnowledge.values()].sort((a, b) => b.count - a.count || String(b.latestAt || '').localeCompare(String(a.latestAt || '')));
  const weakPoints = knowledgeStats.map(item => item.name).slice(0, 5);
  const formatRecord = row => ({
    id: row.id,
    source: row.source,
    status: row.status || 'active',
    createdAt: row.created_at,
    knowledgePoint: row.knowledge_point || knowledgeFromCause(parse(row.cause, [])) || '待判断考察点',
    question: row.content || '',
    cause: parse(row.cause, [])
  });
  const formatMasteredRecord = row => ({ ...formatRecord(row), status: row.status || 'mastered', masteredAt: row.mastered_at });
  const timeline = [...timelineMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, count]) => ({ date, count }));
  const newWeakPoints = knowledgeStats.filter(item => !storedWeakPoints.includes(item.name)).map(item => item.name).slice(0, 3);
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const recentRows = activeRows.filter(row => now - rowTime(row) <= 7 * dayMs);
  const previousRows = activeRows.filter(row => now - rowTime(row) > 7 * dayMs && now - rowTime(row) <= 14 * dayMs);
  const olderRows = activeRows.filter(row => now - rowTime(row) > 7 * dayMs);
  const recentCounts = countKnowledge(recentRows);
  const previousCounts = countKnowledge(previousRows);
  const olderCounts = countKnowledge(olderRows);
  const recentTrend = [...new Set([...recentCounts.keys(), ...previousCounts.keys()])]
    .map(name => ({
      name,
      recent: recentCounts.get(name) || 0,
      previous: previousCounts.get(name) || 0,
      delta: (recentCounts.get(name) || 0) - (previousCounts.get(name) || 0),
      isNew: !olderCounts.has(name)
    }))
    .filter(item => item.recent > 0 || item.previous > 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.recent - a.recent)
    .slice(0, 5);
  const repeatedWeakPoints = knowledgeStats
    .filter(item => item.count >= 2)
    .map(item => ({ name: item.name, count: item.count, latestAt: item.latestAt }))
    .slice(0, 5);

  res.json({
    studentId: Number(req.params.id),
    totalMistakes: rows.length,
    activeMistakes: activeRows.length,
    unclassifiedMistakes: unclassifiedActiveRows.length,
    masteredMistakes: masteredRows.length,
    weakPoints,
    newWeakPoints,
    knowledgeStats,
    recentRecords: activeRows.slice(0, 6).map(formatRecord),
    recentSevenRecords: recentRows.slice(0, 20).map(formatRecord),
    activeRecords: activeRows.slice(0, 30).map(formatRecord),
    masteredRecords: masteredRows.slice(0, 30).map(formatMasteredRecord),
    timeline,
    sourceCount,
    comparison: {
      recentWindowDays: 7,
      previousWindowDays: 7,
      recentTotal: recentRows.length,
      previousTotal: previousRows.length,
      deltaTotal: recentRows.length - previousRows.length,
      recentTrend,
      repeatedWeakPoints
    }
  });
});

r.post('/', async (req, res) => {
  const { name, grade, status, weakPoints, errorCauses, homeworkRate, lastRecord, recentErrors, notes, suggestion, feishuGroupId } = req.body;
  const result = await db.execute({
    sql: `INSERT INTO students (owner_user_id, name, grade, status, weak_points, error_causes, homework_rate, last_record, recent_errors, notes, suggestion, feishu_group_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [req.user.id, name, grade || '', status || 'stable', JSON.stringify(weakPoints || []),
      JSON.stringify(errorCauses || {}), homeworkRate ?? 100, lastRecord || null,
      JSON.stringify(recentErrors || []), notes || '', suggestion || '', feishuGroupId || null]
  });
  res.json({ id: Number(result.lastInsertRowid) });
});

r.put('/:id', async (req, res) => {
  const { name, grade, status, weakPoints, errorCauses, homeworkRate, lastRecord, recentErrors, notes, suggestion, feishuGroupId } = req.body;
  const fields = [], args = [];
  if (name !== undefined) { fields.push('name = ?'); args.push(name); }
  if (grade !== undefined) { fields.push('grade = ?'); args.push(grade); }
  if (status !== undefined) { fields.push('status = ?'); args.push(status); }
  if (weakPoints !== undefined) { fields.push('weak_points = ?'); args.push(JSON.stringify(weakPoints)); }
  if (errorCauses !== undefined) { fields.push('error_causes = ?'); args.push(JSON.stringify(errorCauses)); }
  if (homeworkRate !== undefined) { fields.push('homework_rate = ?'); args.push(homeworkRate); }
  if (lastRecord !== undefined) { fields.push('last_record = ?'); args.push(lastRecord); }
  if (recentErrors !== undefined) { fields.push('recent_errors = ?'); args.push(JSON.stringify(recentErrors)); }
  if (notes !== undefined) { fields.push('notes = ?'); args.push(notes); }
  if (suggestion !== undefined) { fields.push('suggestion = ?'); args.push(suggestion); }
  if (feishuGroupId !== undefined) { fields.push('feishu_group_id = ?'); args.push(feishuGroupId); }
  if (fields.length === 0) return res.json({ ok: true });
  args.push(req.params.id);
  args.push(req.user.id);
  await db.execute({ sql: `UPDATE students SET ${fields.join(', ')} WHERE id = ? AND owner_user_id = ?`, args });
  res.json({ ok: true });
});

r.delete('/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM mistake_records WHERE student_id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  await db.execute({ sql: 'DELETE FROM homework WHERE student_id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  await db.execute({ sql: 'DELETE FROM student_node_status WHERE student_id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  await db.execute({ sql: 'DELETE FROM students WHERE id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  res.json({ ok: true });
});

export default r;
