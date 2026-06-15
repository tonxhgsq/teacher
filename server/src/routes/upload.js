import express from 'express';
import multer from 'multer';
import { db } from '../db/schema.js';
import path from 'path';
import { decodeMaybeMojibake, decodeTextBuffer } from '../lib/textEncoding.js';
import { callAgentAi } from '../lib/agentAi.js';
import { normalizeMathText } from '../lib/mathText.js';
import { KNOWLEDGE_POINTS, KNOWLEDGE_POINT_SET, normalizeKnowledgePoint } from '../lib/knowledgeTaxonomy.js';
import { classifyCost, spendCredits } from '../lib/credits.js';
import { requireSystemQuestionBankAdmin } from '../lib/systemQuestionBank.js';

const r = express.Router();
r.use(requireSystemQuestionBankAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

// ── 各格式文本提取 ─────────────────────────────────────────
function parseCsv(buffer) {
  return decodeTextBuffer(buffer);
}

async function extractText(file) {
  const ext = path.extname(getUploadFileName(file)).toLowerCase();
  if (!['.csv', '.md'].includes(ext)) {
    throw new Error('题库导入当前只支持字段完整的 CSV、JSON 或 Markdown 文件。Excel 暂时关闭，避免未修复的 xlsx 解析安全风险。');
  }
  if (ext === '.csv') return parseCsv(file.buffer);
  if (ext === '.md') return decodeTextBuffer(file.buffer);
  throw new Error('不支持的文件类型');
}

function getUploadFileName(file) {
  return decodeMaybeMojibake(file.originalname);
}

// ── 结构化题库解析 ─────────────────────────────────────────
function parseTableRows(rows) {
  const cleanRows = rows
    .map(row => row.map(cell => String(cell ?? '').trim()))
    .filter(row => row.some(Boolean));
  if (cleanRows.length < 2) return [];
  const headers = cleanRows[0].map(normalizeHeader);
  return cleanRows.slice(1).map(cells => rowToQuestion(headers, cells)).filter(q => q.content);
}

function splitCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"' && quoted && next === '"') {
      cell += '"';
      i++;
    } else if (ch === '"') {
      quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += ch;
    }
  }
  cells.push(cell.trim());
  return cells.map(c => c.replace(/^"|"$/g, '').trim());
}

function parseDelimitedTable(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  const parseLine = delimiter === '\t' ? line => line.split('\t').map(c => c.trim()) : splitCsvLine;
  return parseTableRows(lines.map(parseLine));
}

function parseMarkdownTable(text) {
  const rows = text.split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => /^\|.+\|$/.test(l))
    .map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  if (rows.length < 2) return [];
  return parseTableRows([rows[0], ...rows.slice(2)]);
}

function parseJsonQuestionBank(buffer) {
  const utf8Text = buffer.toString('utf8').replace(/^﻿/, '').trim();
  const text = utf8Text || decodeTextBuffer(buffer).trim();
  if (!text) return [];
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    if (!utf8Text) throw new Error('JSON 文件格式不正确');
    try {
      data = JSON.parse(decodeTextBuffer(buffer).trim());
    } catch {
      throw new Error('JSON 文件格式不正确');
    }
  }
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data.questions)
      ? data.questions
      : Array.isArray(data.items)
        ? data.items
        : Array.isArray(data.data)
          ? data.data
          : [];
  if (!items.length) {
    if (data && typeof data === 'object' && ('root' in data || 'files' in data || 'questions' in data && !Array.isArray(data.questions))) {
      throw new Error('这个 JSON 更像导出统计或审计报告，不是题库题目文件。请上传具体题目 JSON，而不是 _audit_report 或汇总文件。');
    }
    throw new Error('JSON 中未找到题目数组，支持数组本身或 questions/items/data 字段');
  }
  return items.map(normalizeJsonQuestionItem).filter(q => q.content);
}

function normalizeJsonQuestionItem(item) {
  if (!item || typeof item !== 'object') return { content: String(item || '').trim() };
  const tags = item.tags && typeof item.tags === 'object' ? item.tags : {};
  const flat = {
    ...item,
    content: item.content ?? item.text ?? item.question ?? item.stem ?? '',
    answer: item.answer ?? item.solution ?? item.result ?? '',
    type: item.type ?? item.question_type ?? tags.question_type ?? '',
    difficulty: item.difficulty ?? tags.difficulty ?? '',
    knowledgePoint: item.knowledgePoint ?? item.knowledge_point ?? item.kp ?? tags.knowledgePoint ?? tags.subtopic ?? tags.topic ?? '',
    module: item.module ?? tags.module ?? '',
    chapter: item.chapter ?? tags.chapter ?? '',
    topic: item.topic ?? tags.topic ?? '',
    unit: item.unit ?? tags.unit ?? '',
    section: item.section ?? tags.section ?? item.number ?? '',
    keywords: item.keywords ?? tags.keywords ?? '',
    analysis: item.analysis ?? item.explanation ?? item.parse ?? '',
  };
  const data = Object.fromEntries(Object.entries(flat).map(([key, value]) => [normalizeHeader(key), Array.isArray(value) ? value.join('、') : String(value ?? '').trim()]));
  return {
    content: data.content || '',
    type: data.type || '',
    difficulty: normalizeDifficulty(data.difficulty),
    knowledgePoint: pickKnowledgePointFromFields(data),
    answer: data.answer || '',
    analysis: data.analysis || '',
    module: data.module || '',
    chapter: data.chapter || '',
    topic: data.topic || '',
    unit: data.unit || '',
    section: data.section || '',
    keywords: data.keywords || ''
  };
}

function normalizeHeader(header) {
  const h = String(header || '').trim().toLowerCase().replace(/\s+/g, '');
  if (['题目', '题干', '内容', 'question', 'content', 'stem'].includes(h)) return 'content';
  if (['答案', '参考答案', 'answer'].includes(h)) return 'answer';
  if (['考察点', '知识点', '考点', 'knowledgepoint', 'kp'].includes(h)) return 'knowledgePoint';
  if (['模块', 'module', '板块', '分类', '标签'].includes(h)) return 'module';
  if (['章节', '章', 'chapter'].includes(h)) return 'chapter';
  if (['专题', 'topic', '主题'].includes(h)) return 'topic';
  if (['单元', 'unit'].includes(h)) return 'unit';
  if (['小节', '节', 'section'].includes(h)) return 'section';
  if (['难度', 'difficulty'].includes(h)) return 'difficulty';
  if (['题型', '类型', 'type'].includes(h)) return 'type';
  if (['解析', '解题过程', '讲解', 'analysis', 'explanation'].includes(h)) return 'analysis';
  return h;
}

function pickKnowledgePointFromFields(data) {
  const explicit = String(data.knowledgePoint || '').trim();
  if (explicit) return explicit;
  const parts = [data.topic, data.chapter, data.unit, data.section, data.module]
    .map(v => String(v || '').trim())
    .filter(Boolean);
  if (!parts.length) return '';
  const deduped = parts.filter((part, index) => parts.indexOf(part) === index);
  if (deduped.length === 1) return deduped[0];
  return deduped.join(' / ');
}

function rowToQuestion(headers, cells) {
  const data = {};
  headers.forEach((h, i) => {
    if (h) data[h] = (cells[i] || '').trim();
  });
  return {
    content: data.content || '',
    type: data.type || '',
    difficulty: data.difficulty || '',
    knowledgePoint: pickKnowledgePointFromFields(data),
    answer: data.answer || '',
    analysis: data.analysis || '',
    module: data.module || '',
    chapter: data.chapter || '',
    topic: data.topic || '',
    unit: data.unit || '',
    section: data.section || '',
    keywords: data.keywords || ''
  };
}

// ── 文本切割成题目（非结构化兜底） ─────────────────────────
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
    content, type: '', difficulty: '', knowledgePoint: '', answer: ''
  }));
}

function parseQuestionBank(text, fileName) {
  const ext = path.extname(fileName).toLowerCase();
  const structured = ext === '.md'
    ? parseMarkdownTable(text)
    : ext === '.csv'
      ? parseDelimitedTable(text)
      : [];
  return structured.length ? structured : parseQuestions(text);
}

async function parseUploadedQuestionBank(file) {
  const ext = path.extname(getUploadFileName(file)).toLowerCase();
  if (ext === '.json') return parseJsonQuestionBank(file.buffer);
  const text = await extractText(file);
  if (!text || text.trim().length < 5) throw new Error('未能提取到有效文字');
  return parseQuestionBank(text, getUploadFileName(file));
}

function normalizeQuestionForImport(q) {
  const knowledgePoint = String(q.knowledgePoint || '').trim();
  return {
    content: normalizeMathText(q.content),
    type: String(q.type || '').trim(),
    difficulty: String(q.difficulty || '').trim(),
    knowledgePoint: normalizeKnowledgePoint(knowledgePoint) || knowledgePoint,
    answer: normalizeMathText(q.answer),
    analysis: normalizeMathText(q.analysis),
    module: String(q.module || '').trim(),
    chapter: String(q.chapter || '').trim(),
    topic: String(q.topic || '').trim(),
    unit: String(q.unit || '').trim(),
    section: String(q.section || '').trim(),
    keywords: Array.isArray(q.keywords) ? q.keywords.join('、') : String(q.keywords || '').trim(),
  };
}

function summarizeQuestions(questions) {
  const total = questions.length;
  const complete = questions.filter(q => q.content && q.answer && q.knowledgePoint).length;
  const knowledgePoints = [...new Set(questions.map(q => q.knowledgePoint).filter(Boolean))];
  const difficulties = countBy(questions, 'difficulty');
  const types = countBy(questions, 'type');
  return { total, complete, missing: total - complete, knowledgePoints, difficulties, types };
}

function countBy(list, key) {
  return list.reduce((acc, item) => {
    const value = item[key] || '未填写';
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function needsClassification(q) {
  return !normalizeKnowledgePoint(q.knowledgePoint);
}

function inferStandardKnowledgePointByCue(value) {
  const text = String(value || '');
  if (!text) return '';
  const hasPoint = point => KNOWLEDGE_POINT_SET.has(point);
  const rules = [
    [/做对\s*A.*做对\s*B.*做对\s*C|至少做对一道|只做对两题|三道题都做对/, '枚举法'],
    [/每相邻.*之间.*加入|每相邻.*之间.*插入|相邻两个.*之间/, '间隔问题'],
    [/至少.*(确保|保证|必定|一定).*(两个|存在|相同|同类)|抽屉|鸽巢/, '抽屉原理'],
    [/分子.*分母.*(相乘|乘积).*最简真分数|最简真分数.*共有/, '因数个数'],
    [/胜率|命中率|正确率|百分率/, '比例应用题'],
    [/从上往下.*方框|方框中.*等于.*下方|数阵图/, '数阵图'],
    [/两头.*添.*四位数|数字.*两头.*添|末三位|最后两位/, '加减法数字谜'],
    [/水池.*浸|圆柱.*浸|水面.*上升|浸湿/, '水中浸物'],
    [/长.*宽.*之比.*面积|面积.*之比|阴影部分.*面积/, '等积变形'],
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
    [/第一天.*一半.*第二天.*余下|第一天.*总数.*一半|第一天.*全部.*一半|第一天.*全书.*一半|剩下.*一半.*最后|余下.*一半.*还剩|倒推|还原/, '和差倍'],
    [/盈亏|多(?!少).*少|少(?!种|个|人|只|条|元|米|千米|厘米|平方|立方|次|位|张|本|页|天|小时|分钟).*多/, '盈亏问题'],
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
    [/电子钟|电子日历|时刻.*数字之和|年、月、日.*数字之和|日期.*数字之和|组成.*四位数.*概率|无重复数字.*四位数.*概率/, '枚举法'],
    [/绳子.*剪断.*概率|两端距离.*概率|铁球.*概率|飞镖.*概率|蜜蜂.*概率|安全飞行.*概率|概率/, '对应法'],
    [/相遇|追及|相向|同时出发|速度|路程|行程|甲地|乙地/, '基本相遇与追及'],
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
    [/最短路线|从.*点.*走到.*点|沿着线段走|只能沿.*方向走|必须经过.*点|不能经过.*点/, '标数法'],
    [/传球/, '传球法'],
    [/递推|上一步|前一步|第\d+步.*到达|走了\d+步.*到达|每一步/, '递推计数'],
    [/插空|不相邻|不能相邻/, '插空法'],
    [/捆绑|相邻.*排|必须相邻/, '捆绑法'],
    [/染色|颜色|小旗|信号|排成一行|取出.*按顺序|相邻部分不能|不同的栽种方法/, '加乘原理'],
    [/硬币.*支付|支付.*种|分给.*人|分成.*堆|每.*至少|至多.*种|多少种|几种|方法数|可能.*情况|不同.*方法|数位.*数字和|数字和为|选取.*不同.*和为|三条边.*整数|边长.*整数|最长边|围成.*三角形|不同.*选法|不同.*分法/, '枚举法'],
    [/3或者4的倍数|3或者5的倍数|既不能被.*整除|编号.*倍数|标号.*倍数|同时参加|都参加|既.*又|订.*杂志|参加.*比赛/, '枚举法'],
    [/邮票.*连接|撕邮票|图中.*三角形|图中.*正方形|右图.*三角形|下图.*三角形|下图.*正方形|共有.*三角形|共有.*正方形|数.*图形|图形.*个数|数一数/, '图形计数'],
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

function getQuestionContext(q, context = '') {
  return [
    context,
    q?.content,
    q?.knowledgePoint,
    q?.topic,
    q?.module,
    q?.chapter,
    q?.unit,
    q?.section,
    q?.keywords,
    q?.analysis,
  ].map(v => String(v || '').trim()).filter(Boolean).join(' ');
}

function fallbackKnowledgePointByContext(value) {
  const text = String(value || '');
  if (!text.trim()) return '';
  const contextRules = [
    [/计数|排列|组合|概率|多少种|几种|选法|方法数|可能性/, '枚举法'],
    [/应用|和差倍|鸡兔|盈亏|平均|年龄|工程|浓度|经济|比例/, '和差倍'],
    [/几何|图形|面积|周长|角|三角形|正方形|长方形|圆|扇形|体积/, '几何思想'],
    [/行程|相遇|追及|速度|路程|火车|流水|跑道/, '基本相遇与追及'],
    [/数论|整除|余数|质数|合数|因数|倍数|奇偶/, '整除特性'],
    [/组合问题|逻辑|策略|抽屉|最值|构造|数字谜|数阵|幻方/, '逻辑推理'],
    [/计算|算式|求值|简便|巧算|方程|数列|小数|分数/, '整数计算'],
  ];
  for (const [re, point] of contextRules) {
    if (re.test(text) && KNOWLEDGE_POINT_SET.has(point)) return point;
  }
  return KNOWLEDGE_POINT_SET.has('枚举法') ? '枚举法' : KNOWLEDGE_POINTS[0];
}

function coerceStandardKnowledgePoint(q, context = '') {
  const text = getQuestionContext(q, context);
  return normalizeKnowledgePoint(text)
    || inferStandardKnowledgePointByCue(text)
    || fallbackKnowledgePointByContext(text)
    || '待判断考察点';
}

function isRestorationHalfProblem(value) {
  const text = String(value || '');
  return /第一天.*一半.*第二天.*余下|第一天.*总数.*一半|第一天.*全部.*一半|第一天.*全书.*一半|剩下.*一半.*最后|余下.*一半.*还剩|倒推|还原/.test(text);
}

function ruleClassifyQuestion(q, context = '') {
  const text = getQuestionContext(q, context);
  const knowledgePoint = coerceStandardKnowledgePoint(q, context);

  let type = q.type || '填空题';
  if (/能不能|有没有可能|能否|为什么|说明理由|判断/.test(text)) type = '判断说明题';
  else if (/方框|填入|末三位|最后两位|数字谜|算式谜|竖式/.test(text)) type = '数字谜题';
  else if (/应用|实际|学校|学生|买了|文章|口袋|贺卡/.test(text)) type = '综合应用题';
  else if (/求|多少|共有|最大|最小|分别是|和是|积是/.test(text)) type = '计算求值题';

  let difficulty = q.difficulty || '基础';
  if (/同时|多个|若干|说明|相等|互换|全部|所有|最大.*最小|17.*19|29.*31|31.*37/.test(text)) difficulty = '挑战';
  else if (/两个条件|扩大|缩小|反推|可能|方框|A|B|a|b|余数/.test(text)) difficulty = '提升';

  return { ...q, knowledgePoint, type, difficulty };
}

function parseAiJsonArray(text) {
  const raw = String(text || '').trim();
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
  try {
    const data = JSON.parse(cleaned);
    return Array.isArray(data) ? data : Array.isArray(data.items) ? data.items : [];
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    try { return JSON.parse(match[0]); } catch { return []; }
  }
}

function preserveFileKnowledgePoints(questions, originals, context = '') {
  return questions.map((q, index) => ({
    ...q,
    knowledgePoint: coerceStandardKnowledgePoint({
      ...originals[index],
      ...q,
      knowledgePoint: q.knowledgePoint || originals[index]?.knowledgePoint || ''
    }, context)
  }));
}

async function classifyQuestionsWithAi(questions, { force = false, aiTimeoutMs = 45000, context = '' } = {}) {
  const normalized = questions.map(normalizeQuestionForImport).filter(q => q.content);
  const targets = normalized.map((q, index) => ({ ...q, index })).filter(q => force || needsClassification(q));
  if (!targets.length) return { questions: normalized, source: 'file-fields' };

  const byIndex = new Map(normalized.map((q, index) => [index, q]));
  const warnings = [];
  const standardText = KNOWLEDGE_POINTS.join('、');
  const decisionGuide = [
    '解方程、比例方程、含未知数、移项合并、分母含未知数 -> 方程',
    '定义新运算、按规则代入、运算符号自定义 -> 定义新运算',
    '等差数列、差相同、求项数或求和 -> 等差数列',
    '等比数列、比相同、连乘规律 -> 等比数列',
    '数表、循环排列、重复数字、交错求和、一般数列规律 -> 数列与数表',
    '余数、同余、除以某数所得余数、余数相同、中国剩余类条件 -> 余数问题',
    '整除、能被某数整除、整除特征、数位整除判断 -> 整除特性',
    '质数/合数判断 -> 质数与合数；质因数分解 -> 分解质因数；因数个数/约数个数 -> 因数个数',
    '最大公因数、最小公倍数、公因数、公倍数、大因数小倍数关系 -> 大因小倍',
    '分数裂项、拆项、约分、分式整体约分 -> 整数裂项 或 分数计算与比大小，按题意更贴近者选择',
    '整数/小数/分数/百分数四则混合、简便运算、乘法分配律、凑整巧算、速算规律 -> 整数计算 或 小数计算 或 分数计算与比大小，按题目主要对象选择',
    '不能自造新标签，不能返回“除法运算”等标准清单外标签',
    '只要题干不为空，就必须选择一个最贴近的标准二级分类；只有题干为空或明显不是数学题时才允许返回待判断考察点',
  ].join('；');
  try {
    for (let i = 0; i < targets.length; i += 20) {
      const batch = targets.slice(i, i + 20);
      const payload = batch.map(q => ({
        index: q.index,
        fileContext: context,
        content: q.content.slice(0, 500),
        answer: q.answer,
        currentKnowledgePoint: q.knowledgePoint,
        topic: q.topic,
        module: q.module,
        chapter: q.chapter,
        unit: q.unit,
        section: q.section,
        keywords: q.keywords,
        rule: q.knowledgePoint
          ? 'currentKnowledgePoint 是原始文件标签，可作为判断依据，但最终 knowledgePoint 必须从标准清单中选择。'
          : '请根据题干、文件名、模块、关键词从标准清单中选择最贴近的二级分类；题干不为空时不能返回“待判断考察点”。',
      }));
      try {
        console.log(`[upload:classify] ${batch.length} questions, indexes ${batch[0]?.index}-${batch[batch.length - 1]?.index}`);
        const reply = await callAgentAi([
          {
            role: 'system',
            content: `你是小学奥数题库整理助手。你的任务是根据题干、文件名、原始文件标签、模块、章节和关键词，把每道题归入以下标准二级分类之一：${standardText}。最终 knowledgePoint 只能填写标准清单中的原文，不能使用其他分类，不能自造标签，不能输出原始文件里的非标准标签。分类参考规则：${decisionGuide}。题干不为空时，即使不确定，也必须选择最贴近的标准二级分类；只有题干为空或明显不是数学题时才返回“待判断考察点”。只返回 JSON 数组，不要解释。`
          },
          {
            role: 'user',
            content: JSON.stringify(payload)
          }
        ], { maxTokens: 3200, timeoutMs: aiTimeoutMs });
        const items = parseAiJsonArray(reply);
        if (!items.length) throw new Error('AI 未返回可解析的分类');
        console.log(`[upload:classify] AI returned ${items.length} items`);
        items.forEach(item => {
          const index = Number(item.index);
          if (!byIndex.has(index)) return;
          const old = byIndex.get(index);
          const textForCue = getQuestionContext(old, context);
          const cueKnowledgePoint = inferStandardKnowledgePointByCue(textForCue);
          const aiKnowledgePoint = normalizeKnowledgePoint(item.knowledgePoint || item.考察点);
          byIndex.set(index, {
            ...old,
            knowledgePoint: isRestorationHalfProblem(textForCue)
              ? '和差倍'
              : cueKnowledgePoint || aiKnowledgePoint || coerceStandardKnowledgePoint(old, context),
            difficulty: old.difficulty,
            type: old.type,
          });
        });
      } catch (err) {
        console.warn('[upload:classify] batch failed:', err.message);
        warnings.push(err.message);
        batch.forEach(q => {
          const current = byIndex.get(q.index);
          byIndex.set(q.index, ruleClassifyQuestion(current, context));
        });
      }
    }
    targets.forEach(q => {
      const current = byIndex.get(q.index);
      if (needsClassification(current)) {
        byIndex.set(q.index, ruleClassifyQuestion(current, context));
      }
    });
    const finalQuestions = preserveFileKnowledgePoints([...byIndex.values()], normalized, context);
    const finalPendingCount = finalQuestions.filter(q => needsClassification(q)).length;
    return {
      questions: finalQuestions,
      source: warnings.length ? 'mixed' : 'ai',
      warning: finalPendingCount ? warnings[0] : ''
    };
  } catch (err) {
    console.error('[upload:classify] AI failed:', err.message);
    const questions = normalized.map(q => force || needsClassification(q) ? ruleClassifyQuestion(q, context) : q);
    return { questions: preserveFileKnowledgePoints(questions, normalized, context), source: 'rules', warning: err.message };
  }
}

async function classifyLargeQuestionSet(questions, { context = '' } = {}) {
  const ruleQuestions = questions.map(q => ruleClassifyQuestion(normalizeQuestionForImport(q), context));
  const pendingCount = ruleQuestions.filter(q => needsClassification(q)).length;
  if (!pendingCount) {
    return {
      questions: ruleQuestions,
      source: 'rules',
      warning: '题量较大，已先用标准规则快速判断分类。'
    };
  }
  if (pendingCount <= 40) {
    const aiClassified = await classifyQuestionsWithAi(ruleQuestions, { force: false, aiTimeoutMs: 12000, context });
    const nextPendingCount = aiClassified.questions.filter(q => needsClassification(q)).length;
    return {
      ...aiClassified,
      source: nextPendingCount ? 'mixed' : 'rules+ai',
      warning: nextPendingCount
        ? `仍有 ${nextPendingCount} 道题未能自动判断分类，请老师手动确认。`
        : `规则已快速判断大部分题目，剩余 ${pendingCount} 道已用 AI 补充分类。`
    };
  }
  return {
    questions: preserveFileKnowledgePoints(ruleQuestions, questions.map(normalizeQuestionForImport), context),
    source: 'rules',
    warning: `题量较大，已按题干和文件主题选择最贴近的标准分类；建议老师抽查校准。`
  };
}

function normalizeDifficulty(value) {
  const text = String(value || '').trim();
  const numeric = Number(text);
  if (!Number.isNaN(numeric) && text !== '') {
    if (numeric >= 4) return '挑战';
    if (numeric >= 2) return '提升';
    return '基础';
  }
  if (text.includes('挑战') || text.includes('难') || text.toLowerCase() === 'hard') return '挑战';
  if (text.includes('提升') || text.includes('中') || text.toLowerCase() === 'medium') return '提升';
  if (text.includes('基础') || text.includes('易') || text.toLowerCase() === 'easy') return '基础';
  return text || '基础';
}

function defaultQuestionFields(q) {
  return {
    ...q,
    type: q.type || '计算题',
    difficulty: q.difficulty || '基础',
    knowledgePoint: coerceStandardKnowledgePoint(q)
  };
}

function questionFingerprint(content) {
  return normalizeMathText(content)
    .replace(/\s+/g, '')
    .replace(/[，。！？、；：,.!?;:]/g, '')
    .toLowerCase();
}

async function commitQuestionBatch({ ownerUserId, fileName, fileType, questions }) {
  const normalized = questions.map(q => defaultQuestionFields(normalizeQuestionForImport(q))).filter(q => q.content);
  if (!normalized.length) throw new Error('没有可入库的题目');
  const batchResult = await db.execute({
    sql: `INSERT INTO question_import_batches (owner_user_id, file_name, file_type, question_count, status) VALUES (?, ?, ?, ?, 'committed')`,
    args: [ownerUserId, fileName, fileType, normalized.length],
  });
  const batchId = Number(batchResult.lastInsertRowid);
  const inserted = [];
  const skipped = [];
  const seen = new Set();
  const { rows: existingRows } = await db.execute({
    sql: 'SELECT id, content FROM questions WHERE owner_user_id = ?',
    args: [ownerUserId],
  });
  existingRows.forEach(row => seen.add(questionFingerprint(row.content)));
  for (const [index, q] of normalized.entries()) {
    const fp = questionFingerprint(q.content);
    if (seen.has(fp)) {
      skipped.push({ content: q.content, reason: '重复题目，已跳过' });
      continue;
    }
    seen.add(fp);
    const r2 = await db.execute({
      sql: `INSERT INTO questions (owner_user_id, content, type, difficulty, knowledge_point, answer, status, source_file, source_type, import_batch_id, sort_order) VALUES (?, ?, ?, ?, ?, ?, 'approved', ?, ?, ?, ?)`,
      args: [ownerUserId, q.content, q.type, q.difficulty, q.knowledgePoint, q.answer, fileName, fileType, batchId, index + 1],
    });
    inserted.push({ id: Number(r2.lastInsertRowid), ...q, status: 'approved', sourceFile: fileName, sourceType: fileType, importBatchId: batchId, sortOrder: index + 1 });
  }
  if (inserted.length !== normalized.length) {
    await db.execute({
      sql: `UPDATE question_import_batches SET question_count = ? WHERE id = ? AND owner_user_id = ?`,
      args: [inserted.length, batchId, ownerUserId],
    });
  }
  return { batchId, inserted, skipped };
}

r.post('/preview', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: '没有收到文件' });

  const results = [];
  for (const file of req.files) {
    const fileName = getUploadFileName(file);
    const fileType = path.extname(fileName).replace('.', '').toLowerCase();
    try {
      const questions = (await parseUploadedQuestionBank(file)).map(normalizeQuestionForImport);
      if (!questions.length) throw new Error('未解析到题目，请检查表头是否包含题目/答案/考察点等字段');
      results.push({
        file: fileName,
        fileType,
        count: questions.length,
        source: 'parsed',
        warning: '',
        summary: summarizeQuestions(questions),
        questions,
      });
    } catch (err) {
      console.error(`[upload:preview] ${fileName} failed:`, err.message);
      results.push({ file: fileName, fileType, error: err.message });
    }
  }
  res.json({ ok: true, mode: 'preview', results });
});

r.post('/commit', async (req, res) => {
  const imports = Array.isArray(req.body.imports) ? req.body.imports : [];
  if (!imports.length) return res.status(400).json({ error: '没有可入库的题目' });

  const results = [];
  for (const item of imports) {
    const fileName = decodeMaybeMojibake(String(item.file || item.fileName || '未命名题库.md'));
    const fileType = String(item.fileType || path.extname(fileName).replace('.', '').toLowerCase());
    try {
      const questions = Array.isArray(item.questions) ? item.questions : [];
      const { batchId, inserted, skipped } = await commitQuestionBatch({ ownerUserId: req.user.id, fileName, fileType, questions });
      results.push({ file: fileName, fileType, batchId, count: inserted.length, skippedCount: skipped.length, skipped, questions: inserted });
    } catch (err) {
      console.error(`[upload:commit] ${fileName} failed:`, err.message);
      results.push({ file: fileName, fileType, error: err.message });
    }
  }
  res.json({ ok: true, mode: 'commit', results });
});

r.post('/classify', async (req, res) => {
  const imports = Array.isArray(req.body.imports) ? req.body.imports : [];
  const force = Boolean(req.body.force);
  if (!imports.length) return res.status(400).json({ error: '没有可分类的题目' });

  const results = [];
  for (const item of imports) {
    const fileName = decodeMaybeMojibake(String(item.file || item.fileName || '未命名题库.md'));
    const fileType = String(item.fileType || path.extname(fileName).replace('.', '').toLowerCase());
    try {
      const questions = Array.isArray(item.questions) ? item.questions : [];
      const context = `${fileName} ${item.module || ''} ${item.topic || ''} ${item.chapter || ''}`;
      const classified = questions.length > 60
        ? await classifyLargeQuestionSet(questions, { context })
        : await classifyQuestionsWithAi(questions, { force, aiTimeoutMs: 10000, context });
      const credit = await spendCredits(req.user.id, classifyCost(classified.questions.length), {
        title: 'AI 补全题库分类',
        detail: `${fileName} · ${classified.questions.length}道题`,
        refType: 'question_classify',
        refId: fileName,
      });
      results.push({
        file: fileName,
        fileType,
        count: classified.questions.length,
        source: classified.source,
        warning: classified.warning,
        summary: summarizeQuestions(classified.questions),
        questions: classified.questions,
        credit,
      });
    } catch (err) {
      console.error(`[upload:classify] ${fileName} failed:`, err.message);
      results.push({ file: fileName, fileType, error: err.message });
    }
  }
  res.json({ ok: true, mode: 'classify', results });
});

// ── 主路由 ─────────────────────────────────────────────────
r.post('/', upload.array('files', 20), async (req, res) => {
  if (!req.files || req.files.length === 0)
    return res.status(400).json({ error: '没有收到文件' });

  const results = [];
  for (const file of req.files) {
    const fileName = getUploadFileName(file);
    try {
      const questions = await parseUploadedQuestionBank(file);
      if (!questions.length) throw new Error('未解析到题目，请检查表头是否包含题目/答案/考察点等字段');
      const ext = path.extname(fileName).replace('.', '').toLowerCase();
      const { batchId, inserted, skipped } = await commitQuestionBatch({ ownerUserId: req.user.id, fileName, fileType: ext, questions });
      results.push({ file: fileName, count: inserted.length, skippedCount: skipped.length, skipped, questions: inserted });
    } catch (err) {
      console.error(`[upload] ${fileName} failed:`, err.message);
      results.push({ file: fileName, error: err.message });
    }
  }
  res.json({ ok: true, results });
});

export default r;
