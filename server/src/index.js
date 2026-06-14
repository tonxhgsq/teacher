import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });
import express from 'express';
import cors from 'cors';
import { initDb } from './db/schema.js';
import authRouter from './routes/auth.js';
import studentsRouter from './routes/students.js';
import questionsRouter from './routes/questions.js';
import knowledgeMapRouter from './routes/knowledgeMap.js';
import mistakesRouter from './routes/mistakes.js';
import uploadRouter from './routes/upload.js';
import homeworkRouter from './routes/homework.js';
import agentRouter from './routes/agent.js';
import feishuRouter from './routes/feishu.js';
import creditsRouter from './routes/credits.js';
import { restoreFeishuChannels } from './lib/feishuChannels.js';
import { requireAuth } from './lib/auth.js';
import { createRateLimit } from './lib/rateLimit.js';
import { corsOptions, securityHeaders } from './lib/security.js';

const app = express();
if (process.env.TRUST_PROXY === 'true') app.set('trust proxy', 1);
app.use(securityHeaders);
app.use(cors(corsOptions()));
app.use(express.json({ limit: '10mb' }));

const tenMinutes = 10 * 60 * 1000;
const oneHour = 60 * 60 * 1000;
const emailKey = req => String(req.body?.email || req.ip || '').trim().toLowerCase();
app.use('/api/auth/send-code', createRateLimit({ windowMs: tenMinutes, max: 5, keyPrefix: 'auth:send-code', key: emailKey }));
app.use('/api/auth/login', createRateLimit({ windowMs: tenMinutes, max: 12, keyPrefix: 'auth:login' }));
app.use('/api/auth', authRouter);
app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', requireAuth);
app.use('/api/agent', createRateLimit({ windowMs: tenMinutes, max: 30, keyPrefix: 'ai:agent' }));
app.use('/api/mistakes/analyze', createRateLimit({ windowMs: tenMinutes, max: 20, keyPrefix: 'ai:mistakes' }));
app.use('/api/upload/classify', createRateLimit({ windowMs: tenMinutes, max: 20, keyPrefix: 'ai:upload-classify' }));
app.use('/api/upload', createRateLimit({ windowMs: oneHour, max: 80, keyPrefix: 'upload' }));
app.use('/api/questions/:id/source-image', createRateLimit({ windowMs: oneHour, max: 80, keyPrefix: 'question-image' }));
app.use('/api/homework/generate', createRateLimit({ windowMs: tenMinutes, max: 60, keyPrefix: 'homework:generate' }));
app.use('/api/students', studentsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/knowledge-map', knowledgeMapRouter);
app.use('/api/mistakes', mistakesRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/homework', homeworkRouter);
app.use('/api/agent', agentRouter);
app.use('/api/feishu', feishuRouter);
app.use('/api/credits', creditsRouter);

// 托管拆分后的前端工程。旧单文件仍保留在仓库根目录作为 legacy 参照。
const repoDir = join(dirname(fileURLToPath(import.meta.url)), '../../');
const frontendDir = join(repoDir, 'frontend/src');
const noStore = (res) => res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
app.use('/src', express.static(frontendDir, { setHeaders: noStore }));
app.use(express.static(frontendDir, { setHeaders: noStore }));
app.get('/', (req, res) => {
  noStore(res);
  res.sendFile(join(frontendDir, 'index.html'));
});
app.get('/legacy.html', (req, res) => res.sendFile(join(repoDir, 'AI学情工作台_v1.html')));

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
initDb().then(async () => {
  const server = app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
  server.timeout = 300000; // 给较大题库导入和 AI 处理留够时间
  await restoreFeishuChannels();
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });
