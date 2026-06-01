import express from 'express';
import { db } from '../db/schema.js';

const r = express.Router();

r.get('/', async (req, res) => {
  const { status } = req.query;
  const { rows } = status
    ? await db.execute({ sql: 'SELECT * FROM questions WHERE status = ? ORDER BY id DESC', args: [status] })
    : await db.execute('SELECT * FROM questions ORDER BY id DESC');
  res.json(rows);
});

r.post('/', async (req, res) => {
  const { content, type, difficulty, knowledgePoint, answer, status } = req.body;
  const result = await db.execute({
    sql: `INSERT INTO questions (content, type, difficulty, knowledge_point, answer, status) VALUES (?, ?, ?, ?, ?, ?)`,
    args: [content, type || '计算题', difficulty || '基础', knowledgePoint || '', answer || '', status || 'pending-review']
  });
  res.json({ id: Number(result.lastInsertRowid) });
});

r.put('/:id', async (req, res) => {
  const { content, type, difficulty, knowledgePoint, answer, status } = req.body;
  const fields = [], args = [];
  if (content !== undefined) { fields.push('content = ?'); args.push(content); }
  if (type !== undefined) { fields.push('type = ?'); args.push(type); }
  if (difficulty !== undefined) { fields.push('difficulty = ?'); args.push(difficulty); }
  if (knowledgePoint !== undefined) { fields.push('knowledge_point = ?'); args.push(knowledgePoint); }
  if (answer !== undefined) { fields.push('answer = ?'); args.push(answer); }
  if (status !== undefined) { fields.push('status = ?'); args.push(status); }
  if (fields.length === 0) return res.json({ ok: true });
  args.push(req.params.id);
  await db.execute({ sql: `UPDATE questions SET ${fields.join(', ')} WHERE id = ?`, args });
  res.json({ ok: true });
});

r.delete('/:id', async (req, res) => {
  await db.execute({ sql: 'DELETE FROM questions WHERE id = ?', args: [req.params.id] });
  res.json({ ok: true });
});

export default r;
