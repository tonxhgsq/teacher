import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { copyFile, mkdir, readdir, stat, writeFile } from 'fs/promises';
import { dirname, join, relative, resolve } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@libsql/client';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(scriptDir, '..');
const repoDir = resolve(serverDir, '..');
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const dbPath = resolve(repoDir, process.env.DB_PATH || 'data/teacher.db');
const uploadsDir = resolve(repoDir, process.env.QUESTION_IMAGES_DIR || 'frontend/src/uploads/question-images');
const backupRoot = resolve(repoDir, process.env.BACKUP_DIR || 'data/backups');
const backupDir = resolve(backupRoot, `teacher-backup-${timestamp}`);

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function sha256(path) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash('sha256');
    createReadStream(path)
      .on('data', chunk => hash.update(chunk))
      .on('error', reject)
      .on('end', () => resolveHash(hash.digest('hex')));
  });
}

async function copyDirectory(src, dest, stats = { files: 0, bytes: 0 }) {
  if (!(await exists(src))) return stats;
  await mkdir(dest, { recursive: true });
  for (const entry of await readdir(src, { withFileTypes: true })) {
    const from = join(src, entry.name);
    const to = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDirectory(from, to, stats);
    } else if (entry.isFile()) {
      await mkdir(dirname(to), { recursive: true });
      await copyFile(from, to);
      const info = await stat(from);
      stats.files += 1;
      stats.bytes += info.size;
    }
  }
  return stats;
}

async function backupDatabase(target) {
  await mkdir(dirname(target), { recursive: true });
  const dbUrl = `file:${dbPath}`;
  const escapedTarget = target.replace(/'/g, "''");
  try {
    const db = createClient({ url: dbUrl });
    await db.execute(`VACUUM INTO '${escapedTarget}'`);
    return 'sqlite-vacuum-into';
  } catch (err) {
    await copyFile(dbPath, target);
    return `file-copy-fallback: ${err.message}`;
  }
}

if (!(await exists(dbPath))) {
  throw new Error(`数据库不存在：${dbPath}`);
}

await mkdir(backupDir, { recursive: true });
const dbBackupPath = join(backupDir, 'teacher.db');
const dbMethod = await backupDatabase(dbBackupPath);
const dbInfo = await stat(dbBackupPath);
const uploadStats = await copyDirectory(uploadsDir, join(backupDir, 'question-images'));

const manifest = {
  app: 'AI 学情工作台',
  createdAt: new Date().toISOString(),
  backupDir,
  sources: {
    database: relative(repoDir, dbPath),
    questionImages: relative(repoDir, uploadsDir),
  },
  database: {
    file: 'teacher.db',
    method: dbMethod,
    bytes: dbInfo.size,
    sha256: await sha256(dbBackupPath),
  },
  questionImages: {
    dir: 'question-images',
    files: uploadStats.files,
    bytes: uploadStats.bytes,
  },
};

await writeFile(join(backupDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`backup ok: ${backupDir}`);
console.log(`database: ${manifest.database.bytes} bytes, ${manifest.database.method}`);
console.log(`question images: ${uploadStats.files} files, ${uploadStats.bytes} bytes`);
