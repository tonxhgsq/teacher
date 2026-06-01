import express from 'express';
import multer from 'multer';
import { db } from '../db/schema.js';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const r = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|xlsx|xls|csv|docx|doc|md|txt)$/i;
    cb(null, allowed.test(file.originalname));
  }
});

// ── 百度 OCR ──────────────────────────────────────────────
let baiduToken = null;
let baiduTokenExpiry = 0;

async function getBaiduToken() {
  if (baiduToken && Date.now() < baiduTokenExpiry) return baiduToken;
  const resp = await fetch(
    `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${process.env.BAIDU_OCR_API_KEY}&client_secret=${process.env.BAIDU_OCR_SECRET_KEY}`
  );
  const data = await resp.json();
  if (!data.access_token) throw new Error('百度 OCR 获取 token 失败：' + JSON.stringify(data));
  baiduToken = data.access_token;
  baiduTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return baiduToken;
}

async function baiduOcr(imageBuffer) {
  const token = await getBaiduToken();
  const base64 = imageBuffer.toString('base64').replaceAll('+', '%2B').replaceAll('/', '%2F');
  const resp = await fetch(
    `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `image=${base64}&detect_direction=false&paragraph=false`,
    }
  );
  const data = await resp.json();
  if (data.error_code) throw new Error('百度 OCR 错误：' + data.error_msg);
  return data.words_result.map(w => w.words).join('\n');
}

async function baiduOcrPdfPage(token, base64, pageNum) {
  const resp = await fetch(
    `https://aip.baidubce.com/rest/2.0/ocr/v1/accurate_basic?access_token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `pdf_file_num=${pageNum}&pdf_file=${base64}`,
      signal: AbortSignal.timeout(30000),
    }
  );
  const data = await resp.json();
  if (data.error_code) throw new Error('百度 OCR PDF 错误：' + data.error_msg);
  return data;
}

async function baiduOcrPdf(pdfBuffer) {
  const token = await getBaiduToken();
  const base64 = pdfBuffer.toString('base64').replaceAll('+', '%2B').replaceAll('/', '%2F');
  const first = await baiduOcrPdfPage(token, base64, 1);
  const totalPages = Math.min(first.pdf_file_size || 1, 20);
  const texts = [first.words_result.map(w => w.words).join('\n')];
  for (let i = 2; i <= totalPages; i++) {
    await new Promise(res => setTimeout(res, 600)); // 免费版 QPS 限制
    const data = await baiduOcrPdfPage(token, base64, i);
    texts.push(data.words_result.map(w => w.words).join('\n'));
  }
  return texts.join('\n');
}

// ── 各格式文本提取 ─────────────────────────────────────────
const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

async function extractText(file) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (IMAGE_EXTS.has(ext)) return baiduOcr(file.buffer);
  if (ext === '.pdf') return baiduOcrPdf(file.buffer);
  if (['.xlsx', '.xls', '.csv'].includes(ext)) {
    const XLSX = require('xlsx');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const lines = [];
    wb.SheetNames.forEach(name => {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '' });
      rows.forEach(row => lines.push(row.join('\t')));
    });
    return lines.join('\n');
  }
  if (['.docx', '.doc'].includes(ext)) {
    const result = await require('mammoth').extractRawText({ buffer: file.buffer });
    return result.value;
  }
  if (['.md', '.txt'].includes(ext)) return file.buffer.toString('utf-8');
  throw new Error('不支持的文件类型');
}

// ── 文本切割成题目 ─────────────────────────────────────────
function parseQuestions(text) {
  const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 3);
  const questions = [];
  let buf = '';
  for (const line of lines) {
    if (/^[\d（(][\d.、）)]\s*/.test(line) && buf) {
      questions.push(buf.trim());
      buf = line;
    } else {
      buf = buf ? buf + ' ' + line : line;
    }
  }
  if (buf) questions.push(buf.trim());
  return (questions.length ? questions : lines).map(content => ({
    content, type: '计算题', difficulty: '基础', knowledgePoint: '', answer: ''
  }));
}

// ── 主路由 ─────────────────────────────────────────────────
r.post('/', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: '没有收到文件' });

  const results = [];
  for (const file of req.files) {
    try {
      const text = await extractText(file);
      if (!text || text.trim().length < 5) throw new Error('未能提取到有效文字');
      const questions = parseQuestions(text);
      const inserted = [];
      for (const q of questions) {
        const r2 = await db.execute({
          sql: `INSERT INTO questions (content, type, difficulty, knowledge_point, answer, status) VALUES (?, ?, ?, ?, ?, 'pending-ocr')`,
          args: [q.content, q.type, q.difficulty, q.knowledgePoint, q.answer],
        });
        inserted.push({ id: Number(r2.lastInsertRowid), ...q, status: 'pending-ocr' });
      }
      results.push({ file: file.originalname, count: inserted.length, questions: inserted });
    } catch (err) {
      console.error(`[upload] ${file.originalname} failed:`, err.message);
      results.push({ file: file.originalname, error: err.message });
    }
  }
  res.json({ ok: true, results });
});

export default r;
