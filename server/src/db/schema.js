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
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      content TEXT NOT NULL,
      type TEXT DEFAULT '计算题',
      difficulty TEXT DEFAULT '基础',
      knowledge_point TEXT DEFAULT '',
      answer TEXT DEFAULT '',
      status TEXT DEFAULT 'pending-review',
      source_image TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS student_node_status (
      student_id INTEGER,
      node_id TEXT,
      status TEXT DEFAULT 'untested',
      PRIMARY KEY (student_id, node_id)
    );
    CREATE TABLE IF NOT EXISTS homework (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      questions TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      pdf_path TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
    CREATE TABLE IF NOT EXISTS mistake_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER,
      question_id INTEGER,
      cause TEXT DEFAULT '[]',
      source TEXT DEFAULT 'manual',
      photo_path TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );
  `);
}
