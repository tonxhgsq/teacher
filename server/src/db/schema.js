import { createClient } from '@libsql/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __dir = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dir, '../../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

export const db = createClient({ url: `file:${join(dataDir, 'teacher.db')}` });

export async function initDb() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token_hash TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS email_verification_codes (
      email TEXT PRIMARY KEY,
      code TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS credit_accounts (
      owner_user_id INTEGER PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS credit_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT DEFAULT '',
      ref_type TEXT DEFAULT '',
      ref_id TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS agent_chat_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL,
      mode TEXT DEFAULT 'chat',
      user_message TEXT NOT NULL,
      context_messages TEXT DEFAULT '[]',
      assistant_reply TEXT DEFAULT '',
      status TEXT DEFAULT 'ok',
      error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER,
      name TEXT NOT NULL,
      grade TEXT DEFAULT '',
      status TEXT DEFAULT 'stable',
      weak_points TEXT DEFAULT '[]',
      error_causes TEXT DEFAULT '{}',
      homework_rate INTEGER DEFAULT 100,
      last_record TEXT,
      recent_errors TEXT DEFAULT '[]',
      notes TEXT DEFAULT '',
      suggestion TEXT DEFAULT '',
      feishu_group_id TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER,
      content TEXT NOT NULL,
      type TEXT DEFAULT '计算题',
      difficulty TEXT DEFAULT '基础',
      knowledge_point TEXT DEFAULT '',
      answer TEXT DEFAULT '',
      status TEXT DEFAULT 'pending-review',
      source_image TEXT,
      source_file TEXT DEFAULT '',
      source_type TEXT DEFAULT '',
      import_batch_id INTEGER,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS question_import_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER,
      file_name TEXT NOT NULL,
      file_type TEXT DEFAULT '',
      question_count INTEGER DEFAULT 0,
      status TEXT DEFAULT 'committed',
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS system_question_bank_access (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER NOT NULL UNIQUE,
      bank_owner_user_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (bank_owner_user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS student_node_status (
      owner_user_id INTEGER,
      student_id INTEGER,
      node_id TEXT,
      status TEXT DEFAULT 'untested',
      PRIMARY KEY (student_id, node_id)
    );
    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER,
      student_id INTEGER,
      questions TEXT NOT NULL,
      title TEXT DEFAULT '',
      version INTEGER DEFAULT 1,
      meta TEXT DEFAULT '{}',
      status TEXT DEFAULT 'draft',
      pdf_path TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS mistake_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER,
      student_id INTEGER,
      question_id INTEGER,
      content TEXT DEFAULT '',
      cause TEXT DEFAULT '[]',
      source TEXT DEFAULT 'manual',
      status TEXT DEFAULT 'active',
      mastered_at TEXT,
      photo_path TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS feishu_integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_user_id INTEGER,
      app_id TEXT NOT NULL UNIQUE,
      app_secret_encrypted TEXT NOT NULL,
      owner_open_id TEXT DEFAULT '',
      tenant_brand TEXT DEFAULT 'feishu',
      status TEXT DEFAULT 'created',
      last_error TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);

  await ensureColumn('questions', 'source_file', "TEXT DEFAULT ''");
  await ensureColumn('students', 'owner_user_id', "INTEGER");
  await ensureColumn('questions', 'owner_user_id', "INTEGER");
  await ensureColumn('question_import_batches', 'owner_user_id', "INTEGER");
  await ensureColumn('student_node_status', 'owner_user_id', "INTEGER");
  await ensureColumn('homework', 'owner_user_id', "INTEGER");
  await ensureColumn('mistake_records', 'owner_user_id', "INTEGER");
  await ensureColumn('feishu_integrations', 'owner_user_id', "INTEGER");
  await ensureColumn('questions', 'source_type', "TEXT DEFAULT ''");
  await ensureColumn('questions', 'import_batch_id', "INTEGER");
  await ensureColumn('questions', 'sort_order', "INTEGER DEFAULT 0");
  await ensureColumn('homework', 'title', "TEXT DEFAULT ''");
  await ensureColumn('homework', 'version', "INTEGER DEFAULT 1");
  await ensureColumn('homework', 'meta', "TEXT DEFAULT '{}'");
  await ensureColumn('mistake_records', 'content', "TEXT DEFAULT ''");
  await ensureColumn('mistake_records', 'status', "TEXT DEFAULT 'active'");
  await ensureColumn('mistake_records', 'mastered_at', "TEXT");
  await ensureColumn('credit_transactions', 'detail', "TEXT DEFAULT ''");
  await ensureColumn('credit_transactions', 'ref_type', "TEXT DEFAULT ''");
  await ensureColumn('credit_transactions', 'ref_id', "TEXT DEFAULT ''");
  await ensureColumn('agent_chat_logs', 'mode', "TEXT DEFAULT 'chat'");
  await ensureColumn('agent_chat_logs', 'error', "TEXT DEFAULT ''");
}

async function ensureColumn(table, column, definition) {
  const { rows } = await db.execute(`PRAGMA table_info(${table})`);
  if (rows.some(row => row.name === column)) return;
  await db.execute(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
