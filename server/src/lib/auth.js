import crypto from 'crypto';
import { promisify } from 'util';
import { db } from '../db/schema.js';

const scrypt = promisify(crypto.scrypt);
const SESSION_DAYS = 14;

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export async function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = await scrypt(password, salt, 64);
  return { hash: derived.toString('hex'), salt };
}

export async function verifyPassword(password, salt, expectedHash) {
  const { hash } = await hashPassword(password, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(expectedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function publicUser(row) {
  return row ? { id: Number(row.id), username: row.username, email: row.email } : null;
}

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.execute({
    sql: 'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    args: [hashToken(token), userId, expires.toISOString()]
  });
  return { token, expiresAt: expires.toISOString() };
}

export async function requireAuth(req, res, next) {
  const header = req.get('authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const { rows } = await db.execute({
    sql: `SELECT u.id, u.username, u.email, s.expires_at
          FROM auth_sessions s
          JOIN users u ON u.id = s.user_id
          WHERE s.token_hash = ?`,
    args: [hashToken(token)]
  });
  const session = rows[0];
  if (!session || Date.parse(session.expires_at) <= Date.now()) {
    if (session) {
      await db.execute({ sql: 'DELETE FROM auth_sessions WHERE token_hash = ?', args: [hashToken(token)] });
    }
    return res.status(401).json({ error: 'unauthorized' });
  }
  req.user = publicUser(session);
  next();
}

