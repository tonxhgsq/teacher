import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'src'), { recursive: true });

for (const file of ['index.html', 'styles.css', 'app.js']) {
  const from = file === 'index.html' ? path.join(src, file) : path.join(src, file);
  const to = file === 'index.html' ? path.join(dist, file) : path.join(dist, 'src', file);
  fs.copyFileSync(from, to);
}

console.log('frontend build ok: dist/');
