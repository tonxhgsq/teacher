import express from 'express';
import { db } from '../db/schema.js';
import { callAgentAi, streamAgentAi } from '../lib/agentAi.js';
import { buildTeacherAgentMessages } from '../lib/agentContext.js';

const r = express.Router();

function normalizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter(m => ['user', 'assistant'].includes(m.role) && String(m.content || m.text || '').trim())
    .slice(-10)
    .map(m => ({ role: m.role, content: String(m.content || m.text).trim().slice(0, 1200) }));
}

function latestUserMessage(messages) {
  return [...messages].reverse().find(m => m.role === 'user')?.content || '';
}

async function logAgentChat(ownerUserId, { mode, messages, reply = '', status = 'ok', error = '' }) {
  await db.execute({
    sql: `INSERT INTO agent_chat_logs
          (owner_user_id, mode, user_message, context_messages, assistant_reply, status, error)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [
      ownerUserId,
      mode,
      latestUserMessage(messages).slice(0, 1200),
      JSON.stringify(messages).slice(0, 8000),
      String(reply || '').slice(0, 12000),
      status,
      String(error || '').slice(0, 1200),
    ],
  });
}

r.get('/logs', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const { rows } = await db.execute({
    sql: `SELECT id, mode, user_message, assistant_reply, status, error, created_at
          FROM agent_chat_logs
          WHERE owner_user_id = ?
          ORDER BY id DESC
          LIMIT ?`,
    args: [req.user.id, limit],
  });
  res.json({ ok: true, logs: rows });
});

r.post('/chat', async (req, res) => {
  const messages = normalizeMessages(req.body.messages);
  if (messages.length === 0) return res.status(400).json({ error: '请先输入问题' });

  try {
    const aiMessages = await buildTeacherAgentMessages(messages, req.user.id);
    const reply = await callAgentAi(aiMessages);
    await logAgentChat(req.user.id, { mode: 'chat', messages, reply });
    res.json({ ok: true, reply });
  } catch (err) {
    console.error('[agent/chat]', err.message);
    await logAgentChat(req.user.id, { mode: 'chat', messages, status: 'error', error: err.message });
    res.status(500).json({ error: err.message });
  }
});

r.post('/chat/stream', async (req, res) => {
  const messages = normalizeMessages(req.body.messages);
  if (messages.length === 0) return res.status(400).json({ error: '请先输入问题' });

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const aiMessages = await buildTeacherAgentMessages(messages, req.user.id);
    let reply = '';
    await streamAgentAi(aiMessages, delta => {
      reply += delta;
      res.write(delta);
    });
    await logAgentChat(req.user.id, { mode: 'stream', messages, reply });
    res.end();
  } catch (err) {
    console.error('[agent/chat/stream]', err.message);
    await logAgentChat(req.user.id, { mode: 'stream', messages, status: 'error', error: err.message });
    res.write(`\n\n连接 AI 助教失败：${err.message}`);
    res.end();
  }
});

export default r;
