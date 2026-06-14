import { spawn } from 'child_process';

const port = Number(process.env.FRONTEND_PORT || 5174);
const base = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ['scripts/dev-server.mjs'], {
  cwd: new URL('..', import.meta.url),
  env: { ...process.env, FRONTEND_PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
server.stdout.on('data', d => { output += d.toString(); });
server.stderr.on('data', d => { output += d.toString(); });

async function waitForIndex() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(base);
      if (res.ok) return res.text();
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 150));
  }
  throw new Error(`frontend did not start\n${output}`);
}

try {
  const html = await waitForIndex();
  const css = await (await fetch(`${base}/src/styles.css`)).text();
  const js = await (await fetch(`${base}/src/app.js`)).text();
  if (!html.includes('/src/styles.css') || !html.includes('/src/app.js')) throw new Error('index does not reference split assets');
  if (!css.includes('.landing-page')) throw new Error('css missing expected landing styles');
  if (!js.includes('DOMContentLoaded')) throw new Error('js missing app bootstrap');
  if (js.includes('http://localhost:3001/api')) throw new Error('frontend must not hard-code localhost API fallback');
  if (!js.includes('http://127.0.0.1:3001/api')) throw new Error('local frontend dev server must target the local backend API');
  if (!js.includes("'/api'")) throw new Error('frontend must default API calls to same-origin /api');
  console.log('frontend smoke ok');
} finally {
  server.kill('SIGTERM');
}
