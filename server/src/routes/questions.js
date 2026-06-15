import express from 'express';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { dirname, extname, join } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { db } from '../db/schema.js';
import { decodeMaybeMojibake } from '../lib/textEncoding.js';
import { normalizeMathText } from '../lib/mathText.js';
import {
  readableQuestionOwnerIds,
  requireSystemQuestionBankAdmin,
  systemQuestionBankStatus,
  unlockSystemQuestionBank
} from '../lib/systemQuestionBank.js';

const r = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }
});

const repoDir = join(dirname(fileURLToPath(import.meta.url)), '../../../');
const questionImageDir = join(repoDir, 'frontend/src/uploads/question-images/manual');
const allowedImageTypes = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
  ['image/gif', '.gif']
]);

const fmt = (q, currentUserId) => ({
  ...q,
  content: normalizeMathText(q.content),
  answer: normalizeMathText(q.answer),
  knowledgePoint: q.knowledge_point,
  sourceImage: q.source_image,
  sourceFile: decodeMaybeMojibake(q.source_file),
  sourceType: q.source_type,
  importBatchId: q.import_batch_id,
  sortOrder: q.sort_order,
  isSystemQuestion: Number(q.owner_user_id || 0) !== Number(currentUserId || 0),
  knowledge_point: undefined,
  source_image: undefined,
  source_file: undefined,
  source_type: undefined,
  import_batch_id: undefined
});

r.get('/system-library/status', async (req, res) => {
  res.json({ ok: true, systemBank: await systemQuestionBankStatus(req.user) });
});

r.post('/system-library/unlock', async (req, res) => {
  try {
    const result = await unlockSystemQuestionBank(req.user);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, balance: err.balance, cost: err.cost });
  }
});

r.get('/', async (req, res) => {
  const { status } = req.query;
  const { ownerIds } = await readableQuestionOwnerIds(req.user);
  const placeholders = ownerIds.map(() => '?').join(',');
  const args = status ? [status, ...ownerIds] : ownerIds;
  const { rows } = status
    ? await db.execute({ sql: `SELECT * FROM questions WHERE status = ? AND owner_user_id IN (${placeholders}) ORDER BY source_file ASC, COALESCE(sort_order, id) ASC, id ASC`, args })
    : await db.execute({ sql: `SELECT * FROM questions WHERE owner_user_id IN (${placeholders}) ORDER BY source_file ASC, COALESCE(sort_order, id) ASC, id ASC`, args });
  res.json(rows.map(q => fmt(q, req.user.id)));
});

r.post('/', requireSystemQuestionBankAdmin, async (req, res) => {
  const { content, type, difficulty, knowledgePoint, answer, status, sourceFile, sourceType, sortOrder } = req.body;
  const result = await db.execute({
    sql: `INSERT INTO questions (owner_user_id, content, type, difficulty, knowledge_point, answer, status, source_file, source_type, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [req.user.id, normalizeMathText(content), type || '计算题', difficulty || '基础', knowledgePoint || '', normalizeMathText(answer), status || 'approved', sourceFile || '', sourceType || '', Number(sortOrder) || 0]
  });
  res.json({ id: Number(result.lastInsertRowid) });
});

r.put('/:id', requireSystemQuestionBankAdmin, async (req, res) => {
  const { content, type, difficulty, knowledgePoint, answer, status, sourceFile, sourceType, sortOrder } = req.body;
  const fields = [], args = [];
  if (content !== undefined) { fields.push('content = ?'); args.push(normalizeMathText(content)); }
  if (type !== undefined) { fields.push('type = ?'); args.push(type); }
  if (difficulty !== undefined) { fields.push('difficulty = ?'); args.push(difficulty); }
  if (knowledgePoint !== undefined) { fields.push('knowledge_point = ?'); args.push(knowledgePoint); }
  if (answer !== undefined) { fields.push('answer = ?'); args.push(normalizeMathText(answer)); }
  if (status !== undefined) { fields.push('status = ?'); args.push(status); }
  if (sourceFile !== undefined) { fields.push('source_file = ?'); args.push(sourceFile); }
  if (sourceType !== undefined) { fields.push('source_type = ?'); args.push(sourceType); }
  if (sortOrder !== undefined) { fields.push('sort_order = ?'); args.push(Number(sortOrder) || 0); }
  if (fields.length === 0) return res.json({ ok: true });
  args.push(req.params.id);
  args.push(req.user.id);
  await db.execute({ sql: `UPDATE questions SET ${fields.join(', ')} WHERE id = ? AND owner_user_id = ?`, args });
  res.json({ ok: true });
});

r.put('/order/batch', requireSystemQuestionBankAdmin, async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) return res.json({ ok: true, count: 0 });
  let count = 0;
  for (const item of items) {
    const id = Number(item.id);
    if (!id) continue;
    await db.execute({
      sql: 'UPDATE questions SET sort_order = ? WHERE id = ? AND owner_user_id = ?',
      args: [Number(item.sortOrder) || 0, id, req.user.id]
    });
    count += 1;
  }
  res.json({ ok: true, count });
});

r.post('/:id/source-image', requireSystemQuestionBankAdmin, upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择要替换的图片' });
  const ext = allowedImageTypes.get(req.file.mimetype) || extname(req.file.originalname || '').toLowerCase();
  if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext)) {
    return res.status(400).json({ error: '仅支持 PNG、JPG、WEBP、GIF 图片' });
  }
  const { rows } = await db.execute({
    sql: 'SELECT id FROM questions WHERE id = ? AND owner_user_id = ?',
    args: [req.params.id, req.user.id]
  });
  if (!rows.length) return res.status(404).json({ error: '题目不存在' });

  await mkdir(questionImageDir, { recursive: true });
  const safeExt = ext === '.jpeg' ? '.jpg' : ext;
  const fileName = `question-${req.params.id}-${Date.now()}${safeExt}`;
  await writeFile(join(questionImageDir, fileName), req.file.buffer);
  const sourceImage = `/uploads/question-images/manual/${fileName}`;
  await db.execute({
    sql: 'UPDATE questions SET source_image = ? WHERE id = ? AND owner_user_id = ?',
    args: [sourceImage, req.params.id, req.user.id]
  });
  const { rows: updated } = await db.execute({
    sql: 'SELECT * FROM questions WHERE id = ? AND owner_user_id = ?',
    args: [req.params.id, req.user.id]
  });
  res.json({ ok: true, question: fmt(updated[0], req.user.id) });
});

r.delete('/:id', requireSystemQuestionBankAdmin, async (req, res) => {
  await db.execute({ sql: 'DELETE FROM questions WHERE id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  res.json({ ok: true });
});

export default r;
