import express from 'express';
import { db } from '../db/schema.js';
import { homeworkCost, spendCredits } from '../lib/credits.js';
import { readableQuestionOwnerIds } from '../lib/systemQuestionBank.js';

const r = express.Router();
const parse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

const fmtQuestion = q => ({
  id: q.id,
  content: q.content,
  type: q.type,
  difficulty: q.difficulty,
  knowledgePoint: q.knowledge_point,
  answer: q.answer,
  status: q.status,
  sourceImage: q.source_image || '',
});

function knowledgeTokens(text = '') {
  const raw = String(text).trim();
  const tokens = raw.split(/[与和、\s]/).filter(Boolean);
  ['分数', '小数', '应用题', '计算', '面积', '周长', '时间', '单位', '除法', '乘法'].forEach(t => {
    if (raw.includes(t)) tokens.push(t);
  });
  return [...new Set(tokens.filter(t => t.length >= 2))];
}

function matchesKnowledgePoint(questionKp, target = '') {
  const kp = questionKp || '';
  if (!target) return false;
  if (kp.includes(target) || target.includes(kp)) return true;
  const targetTokens = knowledgeTokens(target);
  const kpTokens = knowledgeTokens(kp);
  return targetTokens.some(t => kp.includes(t)) || kpTokens.some(t => target.includes(t));
}

function matchesWeakPoint(question, weakPoints) {
  const kp = question.knowledge_point || '';
  return weakPoints.some(w => matchesKnowledgePoint(kp, w));
}

function knowledgeFromCause(cause) {
  const items = Array.isArray(cause) ? cause : [];
  for (const item of items) {
    if (item && typeof item === 'object' && item.knowledgePoint) return item.knowledgePoint;
  }
  return '';
}

function isKnownKnowledgePoint(name) {
  const value = String(name || '').trim();
  return value && !['待判断考察点', '待判断', '未知', '未分类'].includes(value);
}

function rowKnowledgeNames(row) {
  const causes = parse(row.cause, []);
  const fromCause = Array.isArray(causes)
    ? causes.map(c => (typeof c === 'string' ? c : c?.knowledgePoint || c?.name)).filter(Boolean)
    : [];
  return [...new Set([row.knowledge_point, knowledgeFromCause(causes), ...fromCause].filter(isKnownKnowledgePoint))];
}

function rankQuestion(question, weakPoints, targetDifficulty, knowledgePoint = '') {
  let score = 0;
  const kp = question.knowledge_point || '';
  if (knowledgePoint && matchesKnowledgePoint(kp, knowledgePoint)) score += 160;
  if (matchesWeakPoint(question, weakPoints)) score += 100;
  if (question.difficulty === targetDifficulty) score += 20;
  if (question.type === '应用题') score += 3;
  return score;
}

function randomTieBreaker(seed = '') {
  const text = String(seed || Math.random());
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return (hash % 1000) / 1000;
}

function recentQuestionIds(homeworkRows, limit = 5) {
  const ids = new Set();
  homeworkRows.slice(0, limit).forEach(row => {
    parse(row.questions, []).forEach(q => {
      if (q.id) ids.add(Number(q.id));
    });
  });
  return ids;
}

function normalizeDifficultyMix(input, fallbackDifficulty) {
  const defaultMix = fallbackDifficulty === '提升'
    ? { '基础': 0.3, '提升': 0.5, '挑战': 0.2 }
    : fallbackDifficulty === '挑战'
    ? { '基础': 0.2, '提升': 0.3, '挑战': 0.5 }
    : { '基础': 0.6, '提升': 0.3, '挑战': 0.1 };
  const mix = input && typeof input === 'object' ? input : defaultMix;
  return ['基础', '提升', '挑战'].reduce((acc, key) => {
    acc[key] = Math.max(0, Number(mix[key]) || 0);
    return acc;
  }, {});
}

function normalizeWeakPointMix(input) {
  const mix = input && typeof input === 'object' ? input : { weak: 0.7, normal: 0.3 };
  return {
    weak: Math.max(0, Number(mix.weak) || 0),
    normal: Math.max(0, Number(mix.normal) || 0)
  };
}

function quotasFromMix(count, mix, keys) {
  const raw = keys.map(key => ({ key, value: count * mix[key] }));
  const quotas = Object.fromEntries(raw.map(r => [r.key, Math.floor(r.value)]));
  let remaining = count - Object.values(quotas).reduce((sum, n) => sum + n, 0);
  raw
    .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)))
    .forEach(r => {
      if (remaining > 0) {
        quotas[r.key] += 1;
        remaining -= 1;
      }
    });
  return quotas;
}

async function activeWeakPointsForStudent(studentId, fallback = [], ownerUserId) {
  const { rows } = await db.execute({
    sql: `SELECT mr.cause, q.knowledge_point
          FROM mistake_records mr
          LEFT JOIN questions q ON mr.question_id = q.id
          WHERE mr.student_id = ? AND mr.owner_user_id = ? AND COALESCE(mr.status, 'active') != 'mastered'`,
    args: [studentId, ownerUserId]
  });
  const counts = new Map();
  rows.forEach(row => {
    rowKnowledgeNames(row).forEach(name => counts.set(name, (counts.get(name) || 0) + 1));
  });
  const fromMistakes = [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  return fromMistakes.length ? fromMistakes.slice(0, 5) : (fallback || []).filter(isKnownKnowledgePoint);
}

r.post('/generate', async (req, res) => {
  const studentId = Number(req.body.studentId);
  const count = Math.min(Math.max(Number(req.body.count) || 5, 1), 20);
  const difficulty = req.body.difficulty || '基础';
  const weakPointMix = normalizeWeakPointMix(req.body.weakPointMix);
  const knowledgePoint = String(req.body.knowledgePoint || '').trim();
  const isSpecialPractice = !!knowledgePoint;
  const excludeIds = new Set((Array.isArray(req.body.excludeIds) ? req.body.excludeIds : []).map(Number).filter(Boolean));
  const seed = String(req.body.seed || Date.now());

  const { rows: studentRows } = await db.execute({ sql: 'SELECT * FROM students WHERE id = ? AND owner_user_id = ?', args: [studentId, req.user.id] });
  const student = studentRows[0];
  if (!student) return res.status(404).json({ error: '学生不存在' });

  const weakPoints = await activeWeakPointsForStudent(studentId, parse(student.weak_points, []), req.user.id);
  const { rows: homeworkRows } = await db.execute({
    sql: 'SELECT questions FROM homework WHERE student_id = ? AND owner_user_id = ? ORDER BY created_at DESC LIMIT 8',
    args: [studentId, req.user.id]
  });
  const recentIds = recentQuestionIds(homeworkRows, 5);
  const { ownerIds, systemBank } = await readableQuestionOwnerIds(req.user);
  const placeholders = ownerIds.map(() => '?').join(',');
  const { rows } = await db.execute({ sql: `SELECT * FROM questions WHERE status = 'approved' AND owner_user_id IN (${placeholders}) ORDER BY id DESC`, args: ownerIds });
  if (!rows.length) {
    const error = systemBank.enabled
      ? '题库里还没有已入库题目，请联系 test 账户维护系统题库'
      : '系统题库暂未配置，请先用 test 账户导入题库';
    return res.status(409).json({ error });
  }
  const ranked = rows
    .filter(q => !excludeIds.has(Number(q.id)) && !recentIds.has(Number(q.id)))
    .map(q => ({ q, score: rankQuestion(q, weakPoints, '', knowledgePoint), rand: randomTieBreaker(`${seed}:${q.id}`) }))
    .sort((a, b) => b.score - a.score || b.rand - a.rand || b.q.id - a.q.id);
  const fallbackRanked = rows
    .filter(q => !excludeIds.has(Number(q.id)))
    .map(q => ({ q, score: rankQuestion(q, weakPoints, '', knowledgePoint), rand: randomTieBreaker(`${seed}:fallback:${q.id}`) }))
    .sort((a, b) => b.score - a.score || b.rand - a.rand || b.q.id - a.q.id);

  const quotas = isSpecialPractice ? { weak: count, normal: 0 } : quotasFromMix(count, weakPointMix, ['weak', 'normal']);
  const selectedRanked = [];
  const usedIds = new Set();
  const addPicked = items => {
    items.forEach(item => {
      if (!usedIds.has(Number(item.q.id))) {
        selectedRanked.push(item);
        usedIds.add(Number(item.q.id));
      }
    });
  };
  if (isSpecialPractice) {
    addPicked(ranked.filter(item => matchesKnowledgePoint(item.q.knowledge_point, knowledgePoint)).slice(0, count));
  } else {
    addPicked(ranked.filter(item => matchesWeakPoint(item.q, weakPoints)).slice(0, quotas.weak || 0));
    addPicked(ranked.filter(item => !matchesWeakPoint(item.q, weakPoints)).slice(0, quotas.normal || 0));
  }
  if (selectedRanked.length < count) {
    addPicked(ranked.filter(item => !usedIds.has(Number(item.q.id))).slice(0, count - selectedRanked.length));
  }
  if (selectedRanked.length < count) {
    addPicked(fallbackRanked
      .filter(item => !usedIds.has(Number(item.q.id)))
      .slice(0, count - selectedRanked.length)
      .map(item => ({ ...item, reusedRecent: recentIds.has(Number(item.q.id)) })));
  }

  const selected = selectedRanked.slice(0, count).map(({ q, score }) => ({
    ...fmtQuestion(q),
    source: 'question_bank',
    reason: knowledgePoint && score >= 160
      ? `匹配专项知识点：${knowledgePoint}`
      : score >= 100
      ? `匹配薄弱点：${q.knowledge_point || '综合练习'}`
      : `来自题库：${q.knowledge_point || '综合练习'}`
  }));
  const reusedRecent = selectedRanked.filter(item => item.reusedRecent).length;
  const actualDifficulty = selected.reduce((acc, q) => {
    const key = q.difficulty || '未标注';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const actualWeakPointMix = selected.reduce((acc, q) => {
    const key = matchesWeakPoint({ knowledge_point: q.knowledgePoint }, weakPoints) || (knowledgePoint && matchesKnowledgePoint(q.knowledgePoint, knowledgePoint)) ? 'weak' : 'normal';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, { weak: 0, normal: 0 });
  const report = {
    requested: count,
    selected: selected.length,
    avoidedRecent: recentIds.size,
    reusedRecent,
    strictSelected: selected.length - reusedRecent,
    actualDifficulty,
    actualWeakPointMix,
    weakPointQuotas: quotas,
    shortage: Math.max(0, count - selected.length)
  };
  let credit;
  try {
    credit = await spendCredits(req.user.id, homeworkCost(selected.length), {
      title: '生成个性化作业',
      detail: `${student.name} · ${selected.length}题`,
      refType: 'homework_generate',
      refId: studentId,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, balance: err.balance, cost: err.cost });
  }

  res.json({
    ok: true,
    student: { id: student.id, name: student.name, grade: student.grade, weakPoints, knowledgePoint },
    weakPointMix,
    quotas,
    questions: selected,
    insufficient: selected.length < count,
    avoidedRecent: recentIds.size,
    report,
    credit,
    source: 'question_bank',
  });
});

r.post('/replace-question', async (req, res) => {
  const currentId = Number(req.body.currentId);
  const studentId = Number(req.body.studentId);
  const usedIds = new Set((Array.isArray(req.body.usedIds) ? req.body.usedIds : []).map(Number).filter(Boolean));
  if (currentId) usedIds.add(currentId);
  const knowledgePoint = String(req.body.knowledgePoint || '').trim();
  const difficulty = String(req.body.difficulty || '').trim();
  const seed = String(req.body.seed || Date.now());

  const { rows: studentRows } = studentId
    ? await db.execute({ sql: 'SELECT * FROM students WHERE id = ? AND owner_user_id = ?', args: [studentId, req.user.id] })
    : { rows: [] };
  const weakPoints = parse(studentRows[0]?.weak_points, []);
  const { ownerIds, systemBank } = await readableQuestionOwnerIds(req.user);
  const placeholders = ownerIds.map(() => '?').join(',');
  const { rows } = await db.execute({ sql: `SELECT * FROM questions WHERE status = 'approved' AND owner_user_id IN (${placeholders}) ORDER BY id DESC`, args: ownerIds });
  if (!rows.length) {
    return res.status(404).json({ error: systemBank.enabled ? '题库里没有可替换的题目' : '系统题库暂未配置，请先用 test 账户导入题库' });
  }
  const ranked = rows
    .filter(q => !usedIds.has(Number(q.id)))
    .map(q => {
      let score = rankQuestion(q, weakPoints, difficulty, knowledgePoint);
      if (difficulty && q.difficulty === difficulty) score += 60;
      if (knowledgePoint && matchesKnowledgePoint(q.knowledge_point, knowledgePoint)) score += 80;
      return { q, score, rand: randomTieBreaker(`${seed}:replace:${q.id}`) };
    })
    .sort((a, b) => b.score - a.score || b.rand - a.rand || b.q.id - a.q.id);
  const picked = ranked[0];
  if (!picked) return res.status(404).json({ error: '题库里没有可替换的题目' });
  res.json({
    ok: true,
    question: {
      ...fmtQuestion(picked.q),
      source: 'question_bank',
      reason: knowledgePoint ? `替换为同考察点：${picked.q.knowledge_point || knowledgePoint}` : `替换为题库题目：${picked.q.knowledge_point || '综合练习'}`
    }
  });
});

r.post('/', async (req, res) => {
  const studentId = Number(req.body.studentId);
  const questions = Array.isArray(req.body.questions) ? req.body.questions : [];
  if (!studentId || questions.length === 0) return res.status(400).json({ error: '缺少学生或题目' });
  const title = String(req.body.title || '').trim();
  const meta = req.body.meta && typeof req.body.meta === 'object' ? req.body.meta : {};
  const { rows } = await db.execute({
    sql: 'SELECT MAX(version) AS max_version FROM homework WHERE student_id = ? AND owner_user_id = ?',
    args: [studentId, req.user.id]
  });
  const version = Number(rows[0]?.max_version || 0) + 1;

  const result = await db.execute({
    sql: 'INSERT INTO homework (owner_user_id, student_id, questions, title, version, meta, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
    args: [req.user.id, studentId, JSON.stringify(questions), title, version, JSON.stringify(meta), req.body.status || 'draft']
  });
  res.json({ ok: true, id: Number(result.lastInsertRowid), version });
});

r.get('/student/:studentId', async (req, res) => {
  const { rows } = await db.execute({
    sql: 'SELECT * FROM homework WHERE student_id = ? AND owner_user_id = ? ORDER BY created_at DESC',
    args: [req.params.studentId, req.user.id]
  });
  res.json(rows.map(row => ({ ...row, questions: parse(row.questions, []), meta: parse(row.meta, {}) })));
});

r.delete('/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM homework WHERE id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  res.json({ ok: true });
});

export default r;
