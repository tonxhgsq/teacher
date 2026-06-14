import express from 'express';
import { db } from '../db/schema.js';
import { knowledgeTaxonomyForClient } from '../lib/knowledgeTaxonomy.js';

const r = express.Router();

r.get('/taxonomy', (req, res) => {
  res.json({ taxonomy: knowledgeTaxonomyForClient() });
});

r.get('/student/:studentId', async (req, res) => {
  const { rows } = await db.execute({ sql: 'SELECT node_id, status FROM student_node_status WHERE student_id = ? AND owner_user_id = ?', args: [req.params.studentId, req.user.id] });
  const result = {};
  rows.forEach(row => { result[row.node_id] = row.status; });
  res.json(result);
});

r.put('/student/:studentId/:nodeId', async (req, res) => {
  const { status } = req.body;
  await db.execute({
    sql: `INSERT INTO student_node_status (owner_user_id, student_id, node_id, status) VALUES (?, ?, ?, ?)
          ON CONFLICT(student_id, node_id) DO UPDATE SET owner_user_id = excluded.owner_user_id, status = excluded.status`,
    args: [req.user.id, req.params.studentId, req.params.nodeId, status]
  });
  res.json({ ok: true });
});

export default r;
