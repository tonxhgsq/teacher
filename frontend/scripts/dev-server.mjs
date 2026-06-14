import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = fileURLToPath(new URL('..', import.meta.url));
const src = path.join(root, 'src');
const port = Number(process.env.FRONTEND_PORT || 5173);

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const relative = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/src\//, '');
  const file = path.join(src, relative);
  if (!file.startsWith(src) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Frontend running at http://127.0.0.1:${port}`);
});
