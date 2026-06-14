import express from 'express';
import { db } from '../db/schema.js';
import { callAgentAi } from '../lib/agentAi.js';
import { CREDIT_COSTS, spendCredits } from '../lib/credits.js';
import { KNOWLEDGE_POINTS, KNOWLEDGE_POINT_SET, normalizeKnowledgePoint, findKnowledgeCategory } from '../lib/knowledgeTaxonomy.js';
import { readableQuestionOwnerIds } from '../lib/systemQuestionBank.js';

const r = express.Router();
const parse = (s, fb) => { try { return JSON.parse(s); } catch { return fb; } };
function extractJson(raw) {
  const text = String(raw || '').trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  let start = text.indexOf('{');
  let end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) {
    start = text.indexOf('[');
    end = text.lastIndexOf(']');
  }
  if (start === -1 || end === -1 || end < start) throw new Error('未找到 JSON');
  return JSON.parse(text.slice(start, end + 1));
}
const isKnownKnowledgePoint = name => {
  const value = String(name || '').trim();
  return value && !['待判断考察点', '待判断', '未知', '未分类'].includes(value);
};

r.get('/student/:studentId', async (req, res) => {
  const { rows } = await db.execute({
    sql: `SELECT mr.*, COALESCE(NULLIF(mr.content, ''), q.content, '') AS content, q.knowledge_point, q.type
          FROM mistake_records mr
          LEFT JOIN questions q ON mr.question_id = q.id
          WHERE mr.student_id = ? AND mr.owner_user_id = ?
          ORDER BY mr.created_at DESC`,
    args: [req.params.studentId, req.user.id]
  });
  res.json(rows.map(r => ({ ...r, cause: parse(r.cause, []) })));
});

r.post('/', async (req, res) => {
  const { studentId, questionId, content, cause, source, photoPath } = req.body;
  const result = await db.execute({
    sql: `INSERT INTO mistake_records (owner_user_id, student_id, question_id, content, cause, source, photo_path) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [req.user.id, studentId, questionId || null, content || '', JSON.stringify(cause || []), source || 'manual', photoPath || null]
  });

  if (questionId) {
    const { ownerIds } = await readableQuestionOwnerIds(req.user);
    const placeholders = ownerIds.map(() => '?').join(',');
    const { rows: qRows } = await db.execute({ sql: `SELECT knowledge_point FROM questions WHERE id = ? AND owner_user_id IN (${placeholders})`, args: [questionId, ...ownerIds] });
    const kp = qRows[0]?.knowledge_point;
    if (kp) {
      await db.execute({ sql: 'UPDATE students SET weak_points = ? WHERE id = ? AND owner_user_id = ?', args: [JSON.stringify([kp]), studentId, req.user.id] });
    }
  }

  res.json({ id: Number(result.lastInsertRowid) });
});

r.put('/:id/status', async (req, res) => {
  const status = String(req.body?.status || '').trim();
  if (!['active', 'mastered'].includes(status)) return res.status(400).json({ error: '状态无效' });
  const masteredAt = status === 'mastered' ? "datetime('now','localtime')" : 'NULL';
  const { rows } = await db.execute({ sql: 'SELECT id FROM mistake_records WHERE id = ? AND owner_user_id = ?', args: [req.params.id, req.user.id] });
  if (!rows[0]) return res.status(404).json({ error: '错题记录不存在' });
  await db.execute({
    sql: `UPDATE mistake_records SET status = ?, mastered_at = ${masteredAt} WHERE id = ? AND owner_user_id = ?`,
    args: [status, req.params.id, req.user.id]
  });
  res.json({ ok: true, id: Number(req.params.id), status });
});

r.post('/ocr', (req, res) => {
  res.status(410).json({
    error: '错题 OCR 已下线。请从已生成作业中选择题目并标记对错。',
    code: 'MISTAKE_OCR_DISABLED'
  });
});

function inferKnowledgePoint(text, weakPoints = []) {
  const content = String(text || '');
  const direct = normalizeKnowledgePoint(content) || inferStandardKnowledgePointByCue(content);
  if (direct) return direct;
  const matched = weakPoints.map(normalizeKnowledgePoint).find(Boolean);
  return matched || '待判断考察点';
}

function inferStandardKnowledgePointByCue(value) {
  const text = String(value || '');
  if (!text) return '';
  const hasPoint = point => KNOWLEDGE_POINT_SET.has(point);
  const rules = [
    [/定义新运算|新运算|⊕|⊙|★|[∨∧]|表示.*取大|表示.*取小|按.*规则.*运算/, '定义新运算'],
    [/解.*方程|方程|未知数|移项|合并同类项/, '方程'],
    [/等差数列|公差|差相同|连续自然数|相邻.*多|相邻.*少|每天.*比.*前一天|上层.*下层|下层.*上层/, '等差数列'],
    [/等比数列|公比|比相同/, '等比数列'],
    [/数列|数表|找规律|规律|第\d+项|前\d+项|…|\.{3,}|个9|个0|交错|循环排列/, '数列与数表'],
    [/余数|同余|除以\d+.*余|除以[一二三四五六七八九十百千万]+.*余|余数相同|所得的余数/, '余数问题'],
    [/整除|能被|被.+整除|整除特性/, '整除特性'],
    [/质数|合数/, '质数与合数'],
    [/分解质因数|质因数/, '分解质因数'],
    [/因数个数|约数个数/, '因数个数'],
    [/最大公因数|最小公倍数|公因数|公倍数|倍数.*因数/, '大因小倍'],
    [/循环小数/, '循环小数'],
    [/不定方程/, '不定方程'],
    [/奇数|偶数|奇偶/, '奇数与偶数'],
    [/鸡兔同笼|兔.*鸡|鸡.*兔/, '鸡兔同笼'],
    [/盈亏|多.*少|少.*多/, '盈亏问题'],
    [/周期|每隔|循环.*第|星期|余下.*天/, '周期问题'],
    [/间隔|植树|锯木|楼梯|敲钟/, '间隔问题'],
    [/方阵/, '方阵'],
    [/平均数|平均/, '平均数'],
    [/年龄|岁/, '年龄问题'],
    [/页码|页数|编页/, '页码问题'],
    [/牛吃草|草场|草每天生长/, '牛吃草问题'],
    [/工程|工作效率|合作完成|单独完成|修.*路|完成.*工程/, '工程问题'],
    [/浓度|盐水|糖水|溶液|含盐|含糖/, '浓度问题'],
    [/利润|售价|成本|打折|折扣|原价|赚|亏|利息/, '经济问题'],
    [/比例|按.*比分|正比|反比/, '比例应用题'],
    [/分数.*应用|用了.*还剩|占.*几分之|比.*多.*几分之|比.*少.*几分之/, '分数应用题'],
    [/相遇|追及|速度|路程|时间|行程|甲地|乙地/, '基本相遇与追及'],
    [/火车|过桥|隧道/, '火车过桥'],
    [/流水|顺水|逆水|船速|水速/, '流水行船'],
    [/环形|跑道|环路/, '环形跑道'],
    [/时钟|钟面|分针|时针/, '时钟问题'],
    [/发车|班车|公交/, '间隔发车'],
    [/扶梯|电梯/, '扶梯问题'],
    [/接送/, '接送问题'],
    [/空中加油/, '空中加油'],
    [/多人.*相遇|多次相遇/, '多人多次相遇'],
    [/分段.*行程|前.*速度.*后.*速度/, '分段行程'],
    [/行程.*比例|速度比|路程比/, '比例行程'],
    [/点线角|角度|∠|平行|垂直/, '点线角'],
    [/周长/, '周长'],
    [/方格|格点|小正方形|网格/, '格点面积'],
    [/等积|面积相等|阴影.*面积|求.*面积|三角形.*面积|梯形.*面积/, '等积变形'],
    [/旋转|平移|翻折|轴对称|对称/, '几何变换'],
    [/勾股|直角三角形/, '勾股定理'],
    [/鸟头/, '鸟头模型'],
    [/燕尾/, '燕尾模型'],
    [/沙漏/, '沙漏模型'],
    [/圆|扇形|半径|直径|弧长/, '圆与扇形'],
    [/长方体|立方体|体积|表面积/, '长方体与立方体'],
    [/水中|浸入|浸没|水面上升/, '水中浸物'],
    [/枚举|一一列举/, '枚举法'],
    [/树形图/, '树形图'],
    [/加法原理|乘法原理|加乘原理/, '加乘原理'],
    [/标数法/, '标数法'],
    [/递推/, '递推计数'],
    [/传球/, '传球法'],
    [/插空/, '插空法'],
    [/捆绑/, '捆绑法'],
    [/数.*图形|图形.*个数|共有.*三角形|共有.*长方形|数一数/, '图形计数'],
    [/对应法|一一对应/, '对应法'],
    [/数字谜|竖式|算式谜|加减法.*谜/, '加减法数字谜'],
    [/乘除法.*谜|乘法.*谜|除法.*谜/, '乘除法数字谜'],
    [/数阵图/, '数阵图'],
    [/幻方/, '幻方'],
    [/统筹|最优安排|最省时间|烙饼|过河/, '统筹最优问题'],
    [/必胜|策略|取胜/, '必胜策略'],
    [/逻辑推理|真假话|说谎|推理/, '逻辑推理'],
    [/最大|最小|至多|至少|最值/, '最值问题'],
    [/抽屉|鸽巢/, '抽屉原理'],
    [/构造|证明|论证/, '构造与论证'],
  ];
  for (const [re, point] of rules) {
    if (re.test(text) && hasPoint(point)) return point;
  }
  const looksLikeArithmetic = /计算|简便运算|巧算|速算|脱式|求值|[+\-×÷=]/.test(text);
  if (looksLikeArithmetic) {
    if (/[\/⁄]|分数|百分数|%|％|\d+\s*又\s*\d+/.test(text) && hasPoint('分数计算与比大小')) return '分数计算与比大小';
    if (/\d+\.\d+|小数/.test(text) && hasPoint('小数计算')) return '小数计算';
    if (hasPoint('整数计算')) return '整数计算';
  }
  return '';
}

function buildKnowledgeStatsFromItems(itemAnalyses, historyWeakPoints) {
  const history = new Set(historyWeakPoints || []);
  const stats = new Map();
  (itemAnalyses || []).forEach(analysisItem => {
    const name = normalizeKnowledgePoint(analysisItem?.knowledgePoint) || '待判断考察点';
    const stat = stats.get(name) || { name, count: 0, isNew: !history.has(name) };
    stat.count += 1;
    stats.set(name, stat);
  });
  return [...stats.values()].sort((a, b) => b.count - a.count || Number(b.isNew) - Number(a.isNew));
}

function buildKnowledgeStats(wrongTexts, weakPoints, historyWeakPoints) {
  const itemAnalyses = wrongTexts.map((text, index) => ({
    index: index + 1,
    knowledgePoint: inferKnowledgePoint(text, weakPoints)
  }));
  return buildKnowledgeStatsFromItems(itemAnalyses, historyWeakPoints);
}

function buildCategoryStats(itemAnalyses) {
  const stats = new Map();
  (itemAnalyses || []).forEach(item => {
    const category = findKnowledgeCategory(item?.knowledgePoint)?.label || '待判断';
    stats.set(category, (stats.get(category) || 0) + 1);
  });
  return [...stats.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

function knowledgeFromCause(cause) {
  const list = Array.isArray(cause) ? cause : [];
  for (const item of list) {
    if (typeof item === 'string' && item.trim()) return item.trim();
    if (item?.knowledgePoint) return String(item.knowledgePoint).trim();
    if (item?.name) return String(item.name).trim();
  }
  return '';
}

function normalizeCauseName(name) {
  const value = String(name || '').trim();
  if (!value) return '';
  if (value.includes('审题')) return '审题类';
  if (value.includes('计算')) return '计算类';
  if (value.includes('建模') || value.includes('列式')) return '建模类';
  if (value.includes('概念')) return '概念类';
  if (value.includes('粗心') || value.includes('习惯')) return '粗心类';
  return value;
}

function buildCausePercent(items) {
  const counts = {};
  let total = 0;
  items.forEach(item => {
    const causes = Array.isArray(item.causes) && item.causes.length ? item.causes : ['待判断'];
    causes.forEach(cause => {
      const name = normalizeCauseName(cause) || '待判断';
      counts[name] = (counts[name] || 0) + 1;
      total += 1;
    });
  });
  if (!total) return {};
  const entries = Object.entries(counts);
  let used = 0;
  const result = {};
  entries.forEach(([name, count], index) => {
    const value = index === entries.length - 1 ? 100 - used : Math.round(count / total * 100);
    result[name] = value;
    used += value;
  });
  return result;
}

// AI 分析错题 → 只返回薄弱点二级分类
const ANALYZE_PROMPT = `你是一位小学数学教研助手。二级分类只能使用这份小奥 2026 标准二级分类：${KNOWLEDGE_POINTS.join('、')}。不能使用其他分类，不能自造标签，尤其不能输出“除法运算”等非标准标签。
请根据题意在标准清单中选择最贴切的二级分类；确实无法判断时返回“待判断考察点”。一级分类不用输出，系统会根据二级分类自动派生。

只分析薄弱点分类，不要分析错因，不要输出诊断，不要输出改进建议。
返回字段：
1. weakPoints: 涉及的薄弱二级分类（中文短语数组，3-6个，只能从标准二级分类中选择；无法判断时用"待判断考察点"）
2. knowledgeStats: 本次各二级分类错误数量数组，每项包含 name、count、isNew。isNew 表示该二级分类是否不在学生历史薄弱点中
3. itemAnalyses: 逐题判断数组，必须与题目顺序一一对应。每项只包含 index（从1开始）和 knowledgePoint。knowledgePoint 只能从标准二级分类中选择

只返回 JSON 对象，不加解释：
{"weakPoints":[...],"knowledgeStats":[{"name":"分数应用题","count":2,"isNew":true}],"itemAnalyses":[{"index":1,"knowledgePoint":"分数应用题"}]}`;

function fallbackAnalyze(wrongTexts, student) {
  // 规则版：从题目内容关键词推测知识点
  const historyWeakPoints = [];
  const itemAnalyses = wrongTexts.map((text, index) => ({
    index: index + 1,
    knowledgePoint: inferKnowledgePoint(text)
  }));
  const knowledgeStats = buildKnowledgeStatsFromItems(itemAnalyses, historyWeakPoints);
  const weakPoints = knowledgeStats.map(item => item.name).filter(isKnownKnowledgePoint);
  const displayWeak = weakPoints.length ? weakPoints : ['待判断考察点'];
  return {
    weakPoints: displayWeak,
    knowledgeStats,
    categoryStats: buildCategoryStats(itemAnalyses),
    itemAnalyses,
    fallback: true
  };
}

r.post('/analyze', async (req, res) => {
  const { studentId, wrongTexts } = req.body;
  if (!Array.isArray(wrongTexts) || wrongTexts.length === 0)
    return res.status(400).json({ error: '请提供至少一道错题' });

  // 取学生档案
  const { rows } = await db.execute({ sql: 'SELECT * FROM students WHERE id = ? AND owner_user_id = ?', args: [studentId, req.user.id] });
  const student = rows[0];
  if (!student) return res.status(404).json({ error: '学生不存在' });
  const { rows: historyRows } = await db.execute({
    sql: `SELECT cause FROM mistake_records WHERE student_id = ? AND owner_user_id = ? ORDER BY created_at DESC LIMIT 80`,
    args: [studentId, req.user.id]
  });
  const historyWeakPoints = [...new Set(historyRows.map(row => knowledgeFromCause(parse(row.cause, []))).filter(Boolean))];

  const profile = {
    name: student.name,
    grade: student.grade,
    historyWeakPoints,
  };
  const userText = `学生档案：${JSON.stringify(profile, null, 2)}\n\n本次做错的题目（共 ${wrongTexts.length} 道）：\n${wrongTexts.map((t,i)=>`${i+1}. ${t}`).join('\n')}\n\n请按要求返回 JSON。`;

  try {
    const raw = await callAgentAi([
      { role: 'system', content: ANALYZE_PROMPT },
      { role: 'user', content: userText }
    ], { maxTokens: 4000, timeoutMs: 45000 });
    const result = extractJson(raw);
    const itemAnalyses = wrongTexts.map((text, index) => {
      const aiItem = Array.isArray(result.itemAnalyses)
        ? result.itemAnalyses.find(item => Number(item.index) === index + 1) || result.itemAnalyses[index]
        : null;
      const knowledgePoint = normalizeKnowledgePoint(aiItem?.knowledgePoint) || inferKnowledgePoint(text) || '待判断考察点';
      return { index: index + 1, knowledgePoint };
    });
    const knowledgeStats = buildKnowledgeStatsFromItems(itemAnalyses, profile.historyWeakPoints);
    const weakPoints = knowledgeStats.map(item => item.name).filter(isKnownKnowledgePoint);
    const credit = await spendCredits(req.user.id, CREDIT_COSTS.mistakeAnalyze, {
      title: 'AI 分析错题薄弱点',
      detail: `${student.name} · ${wrongTexts.length}道错题`,
      refType: 'mistake_analyze',
      refId: studentId,
    });
    res.json({
      ok: true,
      ...result,
      weakPoints: weakPoints.length ? weakPoints : ['待判断考察点'],
      knowledgeStats,
      categoryStats: buildCategoryStats(itemAnalyses),
      itemAnalyses,
      fallback: false,
      credit
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message, balance: err.balance, cost: err.cost });
    }
    console.warn('[mistakes/analyze] AI 失败，使用规则版兜底：', err.message);
    res.json({ ok: true, ...fallbackAnalyze(wrongTexts, student) });
  }
});

// 确认分析结果，写入学生档案
r.post('/commit', async (req, res) => {
  const { studentId, weakPoints, wrongTexts, mistakeItems } = req.body;
  const { rows } = await db.execute({ sql: 'SELECT * FROM students WHERE id = ? AND owner_user_id = ?', args: [studentId, req.user.id] });
  const student = rows[0];
  if (!student) return res.status(404).json({ error: '学生不存在' });

  const normalizedItems = Array.isArray(mistakeItems) && mistakeItems.length
    ? mistakeItems
        .map(item => ({
          content: String(item.content || '').trim(),
          questionId: Number(item.questionId) || null,
          source: String(item.source || 'homework').trim() || 'homework',
          knowledgePoint: normalizeKnowledgePoint(item.knowledgePoint) || '待判断考察点'
        }))
        .filter(item => item.content)
    : (wrongTexts || []).map(text => ({
        content: String(text || '').trim(),
        knowledgePoint: '待判断考察点'
      })).filter(item => item.content);

  // 薄弱点只来自本次错题分析，避免把旧种子数据误当成真实薄弱点。
  const itemWeakPoints = normalizedItems.map(item => normalizeKnowledgePoint(item.knowledgePoint) || '待判断考察点').filter(isKnownKnowledgePoint);
  const merged = [...new Set([...(weakPoints || []).map(point => normalizeKnowledgePoint(point) || '待判断考察点'), ...itemWeakPoints].filter(isKnownKnowledgePoint))];

  // 近期错误（保留最近10条）
  const recentErrors = parse(student.recent_errors, []);
  normalizedItems.forEach(item => {
    const t = item.content;
    const desc = t.length > 30 ? t.slice(0, 30) + '…' : t;
    if (!recentErrors.includes(desc)) recentErrors.unshift(desc);
  });
  const trimmed = recentErrors.slice(0, 10);

  await db.execute({
    sql: 'UPDATE students SET weak_points = ?, recent_errors = ? WHERE id = ? AND owner_user_id = ?',
    args: [JSON.stringify(merged), JSON.stringify(trimmed), studentId, req.user.id]
  });

  // 给每道错题建一条记录
  for (const item of normalizedItems) {
    await db.execute({
      sql: `INSERT INTO mistake_records (owner_user_id, student_id, question_id, content, cause, source) VALUES (?, ?, ?, ?, ?, ?)`,
      args: [req.user.id, studentId, item.questionId || null, item.content, JSON.stringify([{ knowledgePoint: item.knowledgePoint || '待判断考察点' }]), item.source || 'homework']
    });
  }

  res.json({ ok: true, weakPoints: merged });
});

export default r;
