import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('..', import.meta.url));
const html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'src/app.js'), 'utf8');

const required = [
  ['stylesheet link', /<link\s+rel="stylesheet"\s+href="\/src\/styles\.css(?:\?[^"]+)?">/],
  ['deferred app script', /<script\s+src="\/src\/app\.js(?:\?[^"]+)?"\s+defer><\/script>/],
  ['workspace root', /id="workspace-app"/],
  ['landing root', /id="landing-page"/],
];

for (const [label, pattern] of required) {
  if (!pattern.test(html)) throw new Error(`missing ${label}`);
}

if (/<style>/.test(html) || /<script>\s*\/\//.test(html)) {
  throw new Error('index.html should not contain the legacy inline CSS/JS blocks');
}
if (!css.includes(':root') || css.length < 1000) throw new Error('styles.css looks incomplete');
if (!js.includes('DOMContentLoaded') || js.length < 1000) throw new Error('app.js looks incomplete');

console.log('frontend check ok');
