import express from 'express';
import { db } from '../db/schema.js';

const r = express.Router();

r.get('/student/:studentId', async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT node_id, status FROM student_node_status WHERE student_id = ?', args: [req.params.studentId] });
  const result = {};
  rows.forEach(row => { result[row.node_id] = row.status; });
  res.json(result);
});

r.put('/student/:studentId/:nodeId', async (req, res) => {
  const { status } = req.body;
  await db.execute({
    sql: `INSERT INTO student_node_status (student_id, node_id, status) VALUES (?, ?, ?)
          ON CONFLICT(student_id, node_id) DO UPDATE SET status = excluded.status`,
    args: [req.params.studentId, req.params.nodeId, status]
  });
  res.json({ ok: true });
});

export default r;
