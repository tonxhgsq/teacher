import crypto from 'crypto';
import express from 'express';
import { db } from '../db/schema.js';
import { createSession, hashPassword, hashToken, publicUser, verifyPassword, requireAuth } from '../lib/auth.js';
import { ensureCreditAccount } from '../lib/credits.js';
import { sendVerificationEmail } from '../lib/mailer.js';

const r = express.Router();
const normalizeEmail = value => String(value || '').trim().toLowerCase();
const normalizeUsername = value => String(value || '').trim();
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

r.post('/send-code', async (req, res) => {
  const email = normalizeEmail(req.body.email);
  if (!validEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  await db.execute({
    sql: `INSERT INTO email_verification_codes (email, code, expires_at)
          VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET code = excluded.code, expires_at = excluded.expires_at, created_at = datetime('now','localtime')`,
    args: [email, code, expires]
  });
  try {
    const mail = await sendVerificationEmail(email, code);
    res.json({ ok: true, devCode: mail.dev ? code : undefined, expiresAt: expires, delivery: mail.dev ? 'dev' : 'email' });
  } catch (err) {
    res.status(500).json({ error: err.message || '验证码邮件发送失败' });
  }
});

r.post('/register', async (req, res) => {
  const username = normalizeUsername(req.body.username);
  const email = normalizeEmail(req.body.email);
  const password = String(req.body.password || '');
  const code = String(req.body.code || '').trim();
  if (username.length < 2) return res.status(400).json({ error: '用户名至少 2 个字符' });
  if (!validEmail(email)) return res.status(400).json({ error: '邮箱格式不正确' });
  if (password.length < 8) return res.status(400).json({ error: '密码至少 8 位' });

  const { rows: codeRows } = await db.execute({
    sql: 'SELECT code, expires_at FROM email_verification_codes WHERE email = ?',
    args: [email]
  });
  const savedCode = codeRows[0];
  if (!savedCode || savedCode.code !== code || Date.parse(savedCode.expires_at) <= Date.now()) {
    return res.status(400).json({ error: '验证码不正确或已过期' });
  }

  const { rows: existing } = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ? OR email = ? LIMIT 1',
    args: [username, email]
  });
  if (existing[0]) return res.status(409).json({ error: '用户名或邮箱已存在' });

  const { hash, salt } = await hashPassword(password);
  const result = await db.execute({
    sql: 'INSERT INTO users (username, email, password_hash, password_salt) VALUES (?, ?, ?, ?)',
    args: [username, email, hash, salt]
  });
  await db.execute({ sql: 'DELETE FROM email_verification_codes WHERE email = ?', args: [email] });
  const user = { id: Number(result.lastInsertRowid), username, email };
  await ensureCreditAccount(user.id);
  const session = await createSession(user.id);
  res.json({ ok: true, user, ...session });
});

r.post('/login', async (req, res) => {
  const account = String(req.body.username || '').trim();
  const password = String(req.body.password || '');
  const { rows } = await db.execute({
    sql: 'SELECT * FROM users WHERE username = ? OR email = ? LIMIT 1',
    args: [account, normalizeEmail(account)]
  });
  const user = rows[0];
  if (!user || !(await verifyPassword(password, user.password_salt, user.password_hash))) {
    return res.status(401).json({ error: '账号或密码不正确' });
  }
  const session = await createSession(user.id);
  res.json({ ok: true, user: publicUser(user), ...session });
});

r.get('/me', requireAuth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

r.post('/logout', requireAuth, async (req, res) => {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (token) await db.execute({ sql: 'DELETE FROM auth_sessions WHERE token_hash = ?', args: [hashToken(token)] });
  res.json({ ok: true });
});

export default r;
