import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
config({ path: join(dirname(fileURLToPath(import.meta.url)), '../.env') });
import express from 'express';
import cors from 'cors';
import { initDb } from './db/schema.js';
import studentsRouter from './routes/students.js';
import questionsRouter from './routes/questions.js';
import knowledgeMapRouter from './routes/knowledgeMap.js';
import mistakesRouter from './routes/mistakes.js';
import uploadRouter from './routes/upload.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.use('/api/students', studentsRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/knowledge-map', knowledgeMapRouter);
app.use('/api/mistakes', mistakesRouter);
app.use('/api/upload', uploadRouter);
app.get('/api/health', (req, res) => res.json({ ok: true }));

// 托管前端 HTML
const frontendDir = join(dirname(fileURLToPath(import.meta.url)), '../../');
app.use(express.static(frontendDir));
app.get('/', (req, res) => res.sendFile(join(frontendDir, 'AI学情工作台_v1.html')));

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';
initDb().then(() => {
  const server = app.listen(PORT, HOST, () => console.log(`Server running on http://${HOST}:${PORT}`));
  server.timeout = 300000; // 5分钟，给多页PDF识别留够时间
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });
