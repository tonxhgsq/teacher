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

async function legacySystemQuestionCount() {
  const { rows } = await db.execute('SELECT COUNT(*) AS count FROM questions WHERE owner_user_id IS NULL OR owner_user_id = 0');
  return Number(rows[0]?.count || 0);
}

export async function systemQuestionBankStatus(user) {
  const ownerId = await systemQuestionBankOwnerId();
  const isAdmin = isSystemQuestionBankAdmin(user);
  const legacyQuestionCount = await legacySystemQuestionCount();
  const legacySystemBank = legacyQuestionCount > 0;
  if (!ownerId) {
    return {
      enabled: legacySystemBank,
      ownerId: 0,
      isAdmin,
      unlocked: legacySystemBank,
      cost: legacySystemBank ? 0 : SYSTEM_QUESTION_BANK_COST,
      legacySystemBank,
      legacyQuestionCount
    };
  }
  if (isAdmin || Number(user?.id) === ownerId) {
    return { enabled: true, ownerId, isAdmin: true, unlocked: true, cost: 0, legacySystemBank, legacyQuestionCount };
  }
  return { enabled: true, ownerId, isAdmin: false, unlocked: true, cost: 0, legacySystemBank, legacyQuestionCount };
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
  return { ownerIds: [...ids], includeLegacySystemBank: Boolean(status.enabled && status.unlocked && status.legacySystemBank), systemBank: status };
}

export function buildQuestionOwnerWhere(ownerIds, includeLegacySystemBank, column = 'owner_user_id') {
  const ids = (ownerIds || []).map(Number).filter(id => Number.isFinite(id) && id > 0);
  const clauses = [];
  const args = [];
  if (ids.length) {
    clauses.push(`${column} IN (${ids.map(() => '?').join(',')})`);
    args.push(...ids);
  }
  if (includeLegacySystemBank) clauses.push(`(${column} IS NULL OR ${column} = 0)`);
  if (!clauses.length) return { sql: '1 = 0', args: [] };
  return { sql: `(${clauses.join(' OR ')})`, args };
}

export function requireSystemQuestionBankAdmin(req, res, next) {
  if (isSystemQuestionBankAdmin(req.user)) return next();
  return res.status(403).json({ error: '只有 test 账户可以上传或修改系统题库' });
}
