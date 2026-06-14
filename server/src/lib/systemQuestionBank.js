import { db } from '../db/schema.js';

export const SYSTEM_QUESTION_BANK_OWNER = process.env.SYSTEM_QUESTION_BANK_OWNER || 'test';
export const SYSTEM_QUESTION_BANK_COST = 0;

export function isSystemQuestionBankAdmin(user) {
  return String(user?.username || '') === SYSTEM_QUESTION_BANK_OWNER;
}

export async function systemQuestionBankOwnerId() {
  const { rows } = await db.execute({
    sql: 'SELECT id FROM users WHERE username = ? LIMIT 1',
    args: [SYSTEM_QUESTION_BANK_OWNER],
  });
  return Number(rows[0]?.id || 0);
}

export async function systemQuestionBankStatus(user) {
  const ownerId = await systemQuestionBankOwnerId();
  const isAdmin = isSystemQuestionBankAdmin(user);
  if (!ownerId) {
    return { enabled: false, ownerId: 0, isAdmin, unlocked: false, cost: SYSTEM_QUESTION_BANK_COST };
  }
  if (isAdmin || Number(user?.id) === ownerId) {
    return { enabled: true, ownerId, isAdmin: true, unlocked: true, cost: 0 };
  }
  return { enabled: true, ownerId, isAdmin: false, unlocked: true, cost: 0 };
}

export async function unlockSystemQuestionBank(user) {
  const status = await systemQuestionBankStatus(user);
  if (!status.enabled) {
    const err = new Error('系统题库暂未配置');
    err.status = 404;
    throw err;
  }
  if (status.unlocked) return { alreadyUnlocked: true, status };
  await db.execute({
    sql: `INSERT INTO system_question_bank_access (owner_user_id, bank_owner_user_id)
          VALUES (?, ?)
          ON CONFLICT(owner_user_id) DO NOTHING`,
    args: [user.id, status.ownerId],
  });
  return { alreadyUnlocked: false, status: { ...status, unlocked: true, cost: 0 } };
}

export async function readableQuestionOwnerIds(user) {
  const status = await systemQuestionBankStatus(user);
  const ids = new Set([Number(user.id)]);
  if (status.enabled && status.unlocked && status.ownerId) ids.add(status.ownerId);
  return { ownerIds: [...ids], systemBank: status };
}

export function requireSystemQuestionBankAdmin(req, res, next) {
  if (isSystemQuestionBankAdmin(req.user)) return next();
  return res.status(403).json({ error: '只有 test 账户可以上传或修改系统题库' });
}
