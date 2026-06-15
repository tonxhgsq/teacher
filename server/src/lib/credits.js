import { db } from '../db/schema.js';

export const CREDIT_COSTS = {
  mistakeOcr: 5,
  mistakeAnalyze: 3,
  homeworkBase: 8,
  homeworkPerQuestion: 1,
  questionClassifyBase: 3,
  questionClassifyPerQuestion: 0,
};

const INITIAL_BALANCE = Number(process.env.INITIAL_CREDITS || 1280);

export function homeworkCost(count) {
  return CREDIT_COSTS.homeworkBase + Math.max(0, Number(count) || 0) * CREDIT_COSTS.homeworkPerQuestion;
}

export function classifyCost(count) {
  return CREDIT_COSTS.questionClassifyBase + Math.max(0, Number(count) || 0) * CREDIT_COSTS.questionClassifyPerQuestion;
}

export async function ensureCreditAccount(ownerUserId) {
  await db.execute({
    sql: `INSERT INTO credit_accounts (owner_user_id, balance)
          VALUES (?, ?)
          ON CONFLICT(owner_user_id) DO NOTHING`,
    args: [ownerUserId, INITIAL_BALANCE],
  });
  const { rows } = await db.execute({
    sql: 'SELECT balance FROM credit_accounts WHERE owner_user_id = ?',
    args: [ownerUserId],
  });
  return Number(rows[0]?.balance || 0);
}

export async function creditSummary(ownerUserId, limit = 20) {
  const balance = await ensureCreditAccount(ownerUserId);
  const { rows } = await db.execute({
    sql: `SELECT id, amount, balance_after, type, title, detail, ref_type, ref_id, created_at
          FROM credit_transactions
          WHERE owner_user_id = ?
          ORDER BY id DESC
          LIMIT ?`,
    args: [ownerUserId, limit],
  });
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todayUsed = rows
    .filter(row => String(row.created_at || '').startsWith(todayPrefix) && Number(row.amount) < 0)
    .reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0);
  return { balance, todayUsed, records: rows };
}

export async function spendCredits(ownerUserId, cost, { title, detail = '', refType = '', refId = '' } = {}) {
  const amount = Math.max(0, Number(cost) || 0);
  await ensureCreditAccount(ownerUserId);
  return {
    ok: true,
    cost: 0,
    originalCost: amount,
    skipped: true,
    freeUse: true,
    title,
    detail,
    refType,
    refId: String(refId || ''),
    ...(await creditSummary(ownerUserId, 8))
  };
}

export async function grantCredits(ownerUserId, amount, { title, detail = '', refType = '', refId = '' } = {}) {
  const value = Math.max(0, Number(amount) || 0);
  const balance = await ensureCreditAccount(ownerUserId);
  const nextBalance = balance + value;
  await db.execute({
    sql: `UPDATE credit_accounts
          SET balance = ?, updated_at = datetime('now','localtime')
          WHERE owner_user_id = ?`,
    args: [nextBalance, ownerUserId],
  });
  await db.execute({
    sql: `INSERT INTO credit_transactions
          (owner_user_id, amount, balance_after, type, title, detail, ref_type, ref_id)
          VALUES (?, ?, ?, 'grant', ?, ?, ?, ?)`,
    args: [ownerUserId, value, nextBalance, title || '积分充值', detail, refType, String(refId || '')],
  });
  return { ok: true, ...(await creditSummary(ownerUserId, 8)) };
}
