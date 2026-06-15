import express from 'express';
import { creditSummary, grantCredits } from '../lib/credits.js';

const r = express.Router();

r.get('/', async (req, res) => {
  res.json({ ok: true, ...(await creditSummary(req.user.id)) });
});

r.post('/grant', async (req, res) => {
  if (process.env.ENABLE_CREDIT_GRANT !== 'true') {
    return res.status(403).json({ error: '当前环境未开放积分充值接口' });
  }
  const amount = Number(req.body.amount);
  if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: '充值积分必须大于 0' });
  res.json(await grantCredits(req.user.id, amount, {
    title: req.body.title || '人工充值',
    detail: req.body.detail || '',
    refType: 'manual',
  }));
});

export default r;
