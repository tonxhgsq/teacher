import express from 'express';
import multer from 'multer';
import { db } from '../db/schema.js';
import { ocrImage } from '../lib/baiduOcr.js';
import { callMimo, extractJson } from '../lib/mimo.js';

const r = express.Router();
const parse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    cb(null, /\.(jpg|jpeg|png|webp)$/i.test(file.originalname));
  }
});

r.get('/student/:studentId', async (req, res) => {
  const { rows } = await db.execute({
    sql: `SELECT mr.*, q.content, q.knowledge_point, q.type
          FROM mistake_records mr
          LEFT JOIN questions q ON mr.question_id = q.id
          WHERE mr.student_id = ?
          ORDER BY mr.created_at DESC`,
    args: [req.params.studentId]
  });
  res.json(rows.map(r => ({ ...r, cause: parse(r.cause, []) })));
});

r.post('/', async (req, res) => {
  const { studentId, questionId, cause, source, photoPath } = req.body;
  const result = await db.execute({
    sql: `INSERT INTO mistake_records (student_id, question_id, cause, source, photo_path) VALUES (?, ?, ?, ?, ?)`,
    args: [studentId, questionId || null, JSON.stringify(cause || []), source || 'manual', photoPath || null]
  });

  if (questionId) {
    const { rows: qRows } = await db.execute({ sql: 'SELECT knowledge_point FROM questions WHERE id = ?', args: [questionId] });
    const kp = qRows[0]?.knowledge_point;
    if (kp) {
      const { rows: sRows } = await db.execute({ sql: 'SELECT weak_points FROM students WHERE id = ?', args: [studentId] });
      const weakPoints = parse(sRows[0]?.weak_points, []);
      if (!weakPoints.includes(kp)) {
        weakPoints.push(kp);
        await db.execute({ sql: 'UPDATE students SET weak_points = ? WHERE id = ?', args: [JSON.stringify(weakPoints), studentId] });
      }
    }
  }

  res.json({ id: Number(result.lastInsertRowid) });
});

// 上传作业照片 → OCR 识别成题目数组
r.post('/ocr', upload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '没有收到图片' });
  try {
    const text = await ocrImage(req.file.buffer);
    if (!text || text.trim().length < 5) return res.json({ ok: true, items: [], rawText: text });

    // 简单切分：按题号或换行
    const lines = text.split(/\n+/).map(l => l.trim()).filter(l => l.length > 2);
    const items = [];
    let buf = '';
    for (const line of lines) {
      if (/^[\d（(][\d.、）)]\s*/.test(line) && buf) {
        items.push(buf.trim());
        buf = line;
      } else {
        buf = buf ? buf + ' ' + line : line;
      }
    }
    if (buf) items.push(buf.trim());

    res.json({ ok: true, items: (items.length ? items : [text]).map((content, i) => ({ id: i + 1, content })), rawText: text });
  } catch (err) {
    console.error('[mistakes/ocr]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// AI 分析错题 → 返回薄弱点 + 错误原因
const ANALYZE_PROMPT = `你是一位小学数学教研助手。根据学生档案和这次做错的题目，分析出：
1. weakPoints: 涉及的薄弱知识点（中文短语数组，3-6个，如"分数应用题"、"单位换算"）
2. errorCauses: 错误原因分布（对象，键是原因类别，值是百分比0-100，所有值加起来=100）。原因类别只能从这5个里选：审题类、计算类、建模类、概念类、粗心类
3. diagnosis: 一句话诊断（30字以内）
4. suggestion: 一句话改进建议（40字以内）

只返回 JSON 对象，不加解释：
{"weakPoints":[...],"errorCauses":{"审题类":n,"计算类":n,...},"diagnosis":"...","suggestion":"..."}`;

function fallbackAnalyze(wrongTexts, student) {
  // 规则版：从题目内容关键词推测知识点
  const kpRules = [
    [/分数|分之|约分|通分/, '分数应用题'],
    [/小数|\.\d/, '小数运算'],
    [/百分|%/, '百分数'],
    [/面积|周长|长方形|正方形|三角形/, '图形面积'],
    [/单位|米|厘米|千克|分钟|小时/, '单位换算'],
    [/方程|未知数|x\s*=/, '方程'],
    [/比例|比/, '比与比例'],
    [/速度|路程|时间|甲乙/, '行程问题'],
    [/×|乘|倍/, '乘法运算'],
    [/÷|除/, '除法运算'],
  ];
  const weak = new Set();
  wrongTexts.forEach(t => {
    kpRules.forEach(([re, label]) => { if (re.test(t)) weak.add(label); });
  });
  const weakPoints = weak.size ? [...weak] : ['计算基础'];
  return {
    weakPoints,
    errorCauses: { 审题类: 30, 计算类: 35, 建模类: 20, 概念类: 10, 粗心类: 5 },
    diagnosis: `本次错题主要集中在${weakPoints.slice(0,2).join('、')}`,
    suggestion: `针对${weakPoints[0]}加强练习，下次作业重点跟进`,
    fallback: true
  };
}

r.post('/analyze', async (req, res) => {
  const { studentId, wrongTexts } = req.body;
  if (!Array.isArray(wrongTexts) || wrongTexts.length === 0)
    return res.status(400).json({ error: '请提供至少一道错题' });

  // 取学生档案
  const { rows } = await db.execute({ sql: 'SELECT * FROM students WHERE id = ?', args: [studentId] });
  const student = rows[0];
  if (!student) return res.status(404).json({ error: '学生不存在' });

  const profile = {
    name: student.name,
    grade: student.grade,
    historyWeakPoints: parse(student.weak_points, []),
  };
  const userText = `学生档案：${JSON.stringify(profile, null, 2)}\n\n本次做错的题目（共 ${wrongTexts.length} 道）：\n${wrongTexts.map((t,i)=>`${i+1}. ${t}`).join('\n')}\n\n请按要求返回 JSON。`;

  try {
    const raw = await callMimo(ANALYZE_PROMPT, userText, { retries: 3, retryDelayMs: 1500 });
    const result = extractJson(raw);
    res.json({ ok: true, ...result, fallback: false });
  } catch (err) {
    console.warn('[mistakes/analyze] AI 失败，使用规则版兜底：', err.message);
    res.json({ ok: true, ...fallbackAnalyze(wrongTexts, student) });
  }
});

// 确认分析结果，写入学生档案
r.post('/commit', async (req, res) => {
  const { studentId, weakPoints, errorCauses, wrongTexts } = req.body;
  const { rows } = await db.execute({ sql: 'SELECT * FROM students WHERE id = ?', args: [studentId] });
  const student = rows[0];
  if (!student) return res.status(404).json({ error: '学生不存在' });

  // 合并薄弱点（去重）
  const oldWeak = parse(student.weak_points, []);
  const merged = [...new Set([...oldWeak, ...(weakPoints || [])])];

  // 近期错误（保留最近10条）
  const recentErrors = parse(student.recent_errors, []);
  (wrongTexts || []).forEach(t => {
    const desc = t.length > 30 ? t.slice(0, 30) + '…' : t;
    if (!recentErrors.includes(desc)) recentErrors.unshift(desc);
  });
  const trimmed = recentErrors.slice(0, 10);

  await db.execute({
    sql: 'UPDATE students SET weak_points = ?, error_causes = ?, recent_errors = ? WHERE id = ?',
    args: [JSON.stringify(merged), JSON.stringify(errorCauses || {}), JSON.stringify(trimmed), studentId]
  });

  // 给每道错题建一条记录
  for (const text of wrongTexts || []) {
    await db.execute({
      sql: `INSERT INTO mistake_records (student_id, question_id, cause, source) VALUES (?, NULL, ?, 'photo')`,
      args: [studentId, JSON.stringify(Object.keys(errorCauses || {}))]
    });
  }

  res.json({ ok: true, weakPoints: merged });
});

export default r;
