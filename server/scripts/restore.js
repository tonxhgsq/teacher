import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { copyFile, mkdir, readdir, readFile, rm, stat } from 'fs/promises';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const serverDir = resolve(scriptDir, '..');
const repoDir = resolve(serverDir, '..');
const args = process.argv.slice(2);
const fromArg = args[args.indexOf('--from') + 1] || '';
const confirmed = args.includes('--yes');
const dbPath = resolve(repoDir, process.env.DB_PATH || 'data/teacher.db');
const uploadsDir = resolve(repoDir, process.env.QUESTION_IMAGES_DIR || 'frontend/src/uploads/question-images');
const backupRoot = resolve(repoDir, process.env.BACKUP_DIR || 'data/backups');
const restorePoint = resolve(backupRoot, `pre-restore-${new Date().toISOString().replace(/[:.]/g, '-')}`);

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

if (!fromArg) {
  throw new Error('请提供备份目录：npm run restore -- --from data/backups/teacher-backup-... [--yes]');
}

const backupDir = resolve(repoDir, fromArg);
const manifestPath = join(backupDir, 'manifest.json');
const backupDbPath = join(backupDir, 'teacher.db');
const backupImagesDir = join(backupDir, 'question-images');

if (!(await exists(manifestPath))) throw new Error(`备份 manifest 不存在：${manifestPath}`);
if (!(await exists(backupDbPath))) throw new Error(`备份数据库不存在：${backupDbPath}`);

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const actualHash = await sha256(backupDbPath);
if (manifest.database?.sha256 && actualHash !== manifest.database.sha256) {
  throw new Error('备份数据库校验失败：sha256 不一致');
}

console.log(`restore source: ${backupDir}`);
console.log(`database: ${manifest.database?.bytes || 0} bytes`);
console.log(`question images: ${manifest.questionImages?.files || 0} files`);
console.log(`target db: ${dbPath}`);
console.log(`target images: ${uploadsDir}`);

if (!confirmed) {
  console.log('dry run only: add --yes to restore and overwrite current database/images');
  process.exit(0);
}

await mkdir(restorePoint, { recursive: true });
if (await exists(dbPath)) await copyFile(dbPath, join(restorePoint, 'teacher.db'));
if (await exists(uploadsDir)) await copyDirectory(uploadsDir, join(restorePoint, 'question-images'));

await mkdir(dirname(dbPath), { recursive: true });
await copyFile(backupDbPath, dbPath);
await rm(uploadsDir, { recursive: true, force: true });
await copyDirectory(backupImagesDir, uploadsDir);

console.log(`restore ok: ${backupDir}`);
console.log(`previous state saved to: ${restorePoint}`);
