import express from 'express';
import { db } from '../db/schema.js';

const r = express.Router();
const parse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
const fmt = s => ({
  ...s,
  weakPoints: parse(s.weak_points, []),
  errorCauses: parse(s.error_causes, {}),
  recentErrors: parse(s.recent_errors, []),
  weak_points: undefined, error_causes: undefined, recent_errors: undefined
});

r.get('/', async (req, res) => {
  const { rows } = await db.execute('SELECT * FROM students ORDER BY id');
  res.json(rows.map(fmt));
});

r.get('/:id', async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT * FROM students WHERE id = ?', args: [req.params.id] });
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(fmt(rows[0]));
});

r.post('/', async (req, res) => {
  const { name, grade, status, weakPoints, errorCauses, homeworkRate, notes, suggestion, feishuGroupId } = req.body;
  const result = await db.execute({
    sql: `INSERT INTO students (name, grade, status, weak_points, error_causes, homework_rate, notes, suggestion, feishu_group_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [name, grade || '', status || 'stable', JSON.stringify(weakPoints || []),
      JSON.stringify(errorCauses || {}), homeworkRate ?? 100, notes || '', suggestion || '', feishuGroupId || null]
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
  await db.execute({ sql: `UPDATE students SET ${fields.join(', ')} WHERE id = ?`, args });
  res.json({ ok: true });
});

r.delete('/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM students WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

export default r;
