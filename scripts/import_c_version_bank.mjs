import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { db, initDb } from '../server/src/db/schema.js';
import { normalizeMathText } from '../server/src/lib/mathText.js';
import { findKnowledgeCategory, KNOWLEDGE_POINT_SET } from '../server/src/lib/knowledgeTaxonomy.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const OWNER_USER_ID = 5;
const JSON_DIR = '/Users/tang/Desktop/题库整理_final_hybrid/2024_乐读七巧板_C版';
const PDF_DIR = '/Users/tang/Desktop/titi/2024 年乐读七巧板 C版讲义及详解';
const OUT_DIR = join(ROOT, 'frontend/src/uploads/question-images/c-version');
const OUT_URL = '/uploads/question-images/c-version';
const TMP_DIR = join(ROOT, 'tmp/c_version_import');

const FILES = [
  { key: '几何专题', batch: '几何专题 C版', pdf: '几何专题 C版.pdf' },
  { key: '计数专题', batch: '计数专题 C版', pdf: '计数专题  C版.pdf' },
  { key: '计算专题', batch: '计算专题 C版', pdf: '计算专题 C版.pdf' },
  { key: '数论专题', batch: '数论专题 C版', pdf: '数论专题 C版.pdf' },
  { key: '行程专题', batch: '行程专题 C版', pdf: '行程专题 C版.pdf' },
  { key: '应用专题', batch: '应用专题 C版', pdf: '应用专题 C版.pdf' },
  { key: '组合专题', batch: '组合专题 C版', pdf: '组合专题 C版.pdf' },
];

const MANUAL_CROPS = new Map([
  ['C_行程_037', { page: 17, box: [2465, 770, 2675, 1015] }],
  ['C_行程_039', { page: 18, box: [1130, 305, 1305, 585] }],
  ['C_行程_041', { page: 18, box: [1110, 1485, 1315, 1765] }],
  ['C_行程_077', { page: 34, box: [870, 750, 1265, 930] }],
  ['C_行程_081', { page: 36, box: [880, 1485, 1268, 1735] }],
  ['C_行程_082', { page: 37, box: [2215, 510, 2670, 780] }],
  ['C_行程_083', { page: 37, box: [2200, 1085, 2675, 1430] }],
  ['C_行程_084', { page: 38, box: [985, 330, 1280, 635] }],
  ['C_行程_090', { page: 41, box: [2415, 480, 2690, 665] }],
  ['C_行程_091', { page: 41, box: [2435, 935, 2680, 1225] }],
  ['C_行程_092', { page: 41, box: [2380, 1400, 2665, 1810] }],
  ['C_行程_093', { page: 42, box: [1045, 335, 1295, 595] }],
  ['C_行程_095', { page: 43, box: [2445, 310, 2690, 565] }],
  ['C_行程_096', { page: 43, box: [2445, 725, 2690, 980] }],
  ['C_行程_097', { page: 43, box: [2445, 1160, 2690, 1430] }],
  ['C_行程_098', { page: 44, box: [1040, 640, 1305, 835] }],
  ['C_行程_102', { page: 46, box: [1010, 420, 1310, 650] }],
  ['C_行程_103', { page: 46, box: [1050, 1045, 1300, 1310] }],
  ['C_行程_104', { page: 47, box: [2310, 480, 2685, 645] }],
  ['C_行程_105', { page: 47, box: [2110, 1170, 2670, 1395] }],
  ['C_应用_035', { page: 22, box: [105, 640, 365, 930] }],
  ['C_应用_047', { page: 28, box: [95, 1205, 690, 1515] }],
  ['C_应用_048', { page: 29, box: [1520, 520, 1865, 785] }],
]);

function cleanStem(value) {
  let text = normalizeMathText(value || '');
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = text
      .replace(/^\s*例\s*\d+(?:\s*[（(]\d+[）)])?\s*[：:、.]?\s*/u, '')
      .replace(/^\s*练一练\s*[：:、.]?\s*/u, '')
      .trim();
  }
  return text.replace(/[\uFFFD]/g, '').trim();
}

function mapDifficulty(value) {
  const n = Number(value || 0);
  if (n >= 4) return '挑战';
  if (n >= 3) return '提升';
  return '基础';
}

function mapType(value) {
  const text = String(value || '');
  if (text.includes('证明')) return '证明题';
  if (text.includes('解答')) return '解答题';
  if (text.includes('填空')) return '填空题';
  if (text.includes('选择')) return '选择题';
  return '计算题';
}

function has(text, ...patterns) {
  return patterns.some(pattern => pattern.test(text));
}

function firstValid(...points) {
  return points.find(point => KNOWLEDGE_POINT_SET.has(point)) || points[0] || '';
}

function classify(topic, subtopic, text) {
  if (topic === '应用') topic = '应用题';
  if (topic === '组合问题') topic = '组合';
  const t = `${subtopic || ''} ${text || ''}`;
  let point = '';

  if (topic === '计算') {
    if (has(t, /定义|新运算|⊙|⊕|★|规定/)) point = '定义新运算';
    else if (has(t, /方程|解下列方程|未知数|x[=＋+\-×÷]/i)) point = '方程';
    else if (has(t, /等比|公比|几何数列/)) point = '等比数列';
    else if (has(t, /等差|公差|数列|第\d+项|前\d+项/)) point = '等差数列';
    else if (has(t, /高斯|⌊|⌋|⌈|⌉/)) point = '高斯记号';
    else if (has(t, /裂项|2018|2019|通项|1\/\d+\s*-\s*1\/\d+/)) point = '整数裂项';
    else if (has(t, /小数|0\.|\d\.\d|循环小数|[\u0307]/)) point = '小数计算';
    else if (has(t, /分数|\/|比大小|化简|繁分数/)) point = '分数计算与比大小';
    else point = '整数计算';
  } else if (topic === '几何') {
    if (has(t, /水中浸物|浸|容器|水面|水深|注水/)) point = '水中浸物';
    else if (has(t, /长方体|正方体|立方体|体积|表面积|棱长/)) point = '长方体与立方体';
    else if (has(t, /圆|扇形|半径|直径|弧|圆心角/)) point = '圆与扇形';
    else if (has(t, /燕尾/)) point = '燕尾模型';
    else if (has(t, /沙漏/)) point = '沙漏模型';
    else if (has(t, /鸟头/)) point = '鸟头模型';
    else if (has(t, /等高|高相等/)) point = '等高模型';
    else if (has(t, /勾股|直角三角形|平方/)) point = '勾股定理';
    else if (has(t, /格点|方格|格线|网格/)) point = '格点面积';
    else if (has(t, /一半|中点|面积的一半/)) point = '一半模型';
    else if (has(t, /平移|旋转|翻折|对称|剪拼|拼成|割补/)) point = '几何变换';
    else if (has(t, /面积|阴影|等积/)) point = '等积变形';
    else if (has(t, /周长/)) point = '周长';
    else if (has(t, /角|∠|平行|垂直|度/)) point = '点线角';
    else point = '几何思想';
  } else if (topic === '应用题') {
    if (has(t, /工程|工作|效率|完工|修路/)) point = '工程问题';
    else if (has(t, /浓度|溶液|盐水|含盐|酒精/)) point = '浓度问题';
    else if (has(t, /利润|售价|成本|进价|折扣|盈利|亏损/)) point = '经济问题';
    else if (has(t, /牛吃草|草场|长草/)) point = '牛吃草问题';
    else if (has(t, /页码|页数|编号/)) point = '页码问题';
    else if (has(t, /年龄|岁/)) point = '年龄问题';
    else if (has(t, /平均/)) point = '平均数';
    else if (has(t, /方阵|队列|排成/)) point = '方阵';
    else if (has(t, /间隔|植树|锯木|敲钟/)) point = '间隔问题';
    else if (has(t, /周期|循环|每隔/)) point = '周期问题';
    else if (has(t, /盈亏|多.*少|不够|剩余/)) point = '盈亏问题';
    else if (has(t, /鸡兔|头.*脚|脚.*头/)) point = '鸡兔同笼';
    else if (has(t, /比例|比是|按.*比|成正比|成反比/)) point = '比例应用题';
    else if (has(t, /分数|几分之|\/\d/)) point = '分数应用题';
    else point = '和差倍';
  } else if (topic === '数论') {
    if (has(t, /不定方程|整数解|方程.*整数/)) point = '不定方程';
    else if (has(t, /最大公因数|最小公倍数|公倍数|公因数|倍数/)) point = '大因小倍';
    else if (has(t, /循环小数|小数点|循环节|[\u0307]/)) point = '循环小数';
    else if (has(t, /因数个数|约数个数|多少个因数/)) point = '因数个数';
    else if (has(t, /分解质因数|质因数/)) point = '分解质因数';
    else if (has(t, /质数|合数|素数/)) point = '质数与合数';
    else if (has(t, /余数|同余|除以.*余/)) point = '余数问题';
    else if (has(t, /奇数|偶数|奇偶/)) point = '奇数与偶数';
    else point = '整除特性';
  } else if (topic === '计数') {
    if (has(t, /对应/)) point = '对应法';
    else if (has(t, /图形|三角形|正方形|长方形|线段|角|共有.*个/)) point = '图形计数';
    else if (has(t, /捆绑|相邻|在一起/)) point = '捆绑法';
    else if (has(t, /插空|不相邻/)) point = '插空法';
    else if (has(t, /传球|传递/)) point = '传球法';
    else if (has(t, /递推|前一项|后一项/)) point = '递推计数';
    else if (has(t, /标数|路线|路径|走法/)) point = '标数法';
    else if (has(t, /树形图/)) point = '树形图';
    else if (has(t, /乘法原理|加法原理|分步|分类|排列|组合/)) point = '加乘原理';
    else point = '枚举法';
  } else if (topic === '行程') {
    if (has(t, /比例|速度比|时间比|路程比/)) point = '比例行程';
    else if (has(t, /分段|先.*后|途中|折返/)) point = '分段行程';
    else if (has(t, /多人|多次相遇|第\d+次相遇/)) point = '多人多次相遇';
    else if (has(t, /加油|飞机/)) point = '空中加油';
    else if (has(t, /接送|往返接/)) point = '接送问题';
    else if (has(t, /扶梯|电梯|自动扶梯/)) point = '扶梯问题';
    else if (has(t, /发车|班车|间隔/)) point = '间隔发车';
    else if (has(t, /时钟|钟面|分针|时针/)) point = '时钟问题';
    else if (has(t, /环形|圆形跑道|跑道/)) point = '环形跑道';
    else if (has(t, /流水|顺流|逆流|静水|水速/)) point = '流水行船';
    else if (has(t, /火车|过桥|隧道/)) point = '火车过桥';
    else point = '基本相遇与追及';
  } else if (topic === '组合') {
    if (has(t, /构造|证明|一定存在|反例/)) point = '构造与论证';
    else if (has(t, /抽屉|至少.*相同|必有/)) point = '抽屉原理';
    else if (has(t, /最大|最小|至多|至少|最值|最优化/)) point = '最值问题';
    else if (has(t, /逻辑|真假|说谎|推理/)) point = '逻辑推理';
    else if (has(t, /必胜|游戏|策略|轮流/)) point = '必胜策略';
    else if (has(t, /统筹|安排|方案|总时间|过河/)) point = '统筹最优问题';
    else if (has(t, /幻方/)) point = '幻方';
    else if (has(t, /数阵|填入.*圆|填数|阵图/)) point = '数阵图';
    else if (has(t, /乘法竖式|除法竖式|算式谜|□.*[×÷]/)) point = '乘除法数字谜';
    else if (has(t, /数字谜|竖式|□.*[+\-]/)) point = '加减法数字谜';
    else point = '找规律';
  }

  const normalized = findKnowledgeCategory(point)?.knowledgePoint || '';
  if (normalized) return normalized;
  return firstValid(point, '枚举法');
}

function needsSourceImage(entry, text) {
  const raw = `${entry.number || ''} ${entry.text || ''} ${text || ''}`;
  if (has(raw, /如图|下图|图中|图所示|图形|阴影|方格|格点|表格|数表|数阵|路线图|路径图|钟面|棋盘|圆圈|球体|正方体|长方体|示意图|右图|左图/)) return true;
  return false;
}

function fingerprint(value) {
  return normalizeMathText(value)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function pageImagePath(key, page) {
  return join(OUT_DIR, `${key}-p${String(page).padStart(3, '0')}.png`);
}

function pageImageUrl(key, page) {
  return `${OUT_URL}/${key}-p${String(page).padStart(3, '0')}.png`;
}

function questionImagePath(key, id) {
  return join(OUT_DIR, 'questions', `${key}-${id}.png`);
}

function questionImageUrl(key, id) {
  return `${OUT_URL}/questions/${key}-${id}.png`;
}

function sourceImageExists(url) {
  if (!url) return false;
  return existsSync(join(ROOT, 'frontend/src', url.replace(/^\//, '')));
}

async function deleteExistingBatch(fileName) {
  const result = await db.execute({
    sql: 'SELECT id FROM question_import_batches WHERE owner_user_id = ? AND file_name = ?',
    args: [OWNER_USER_ID, fileName],
  });
  for (const row of result.rows) {
    await db.execute({ sql: 'DELETE FROM questions WHERE owner_user_id = ? AND import_batch_id = ?', args: [OWNER_USER_ID, row.id] });
    await db.execute({ sql: 'DELETE FROM question_import_batches WHERE owner_user_id = ? AND id = ?', args: [OWNER_USER_ID, row.id] });
  }
}

function renderSourceImages(manifest) {
  if (!manifest.length) return;
  mkdirSync(TMP_DIR, { recursive: true });
  const manifestPath = join(TMP_DIR, 'page_crops_manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  execFileSync('python3', [join(ROOT, 'scripts/render_c_version_page_crops.py'), manifestPath], { stdio: 'inherit' });
}

function cropQuestionImages(pages) {
  if (!pages.length) return;
  mkdirSync(TMP_DIR, { recursive: true });
  const manifestPath = join(TMP_DIR, 'question_crops_manifest.json');
  writeFileSync(manifestPath, JSON.stringify(pages, null, 2));
  execFileSync('python3', [join(ROOT, 'scripts/crop_c_version_question_figures.py'), manifestPath], { stdio: 'inherit' });
}

async function main() {
  await initDb();
  mkdirSync(OUT_DIR, { recursive: true });
  mkdirSync(TMP_DIR, { recursive: true });

  const renderManifestByKey = new Map();
  const cropPages = new Map();
  const imports = [];

  for (const file of FILES) {
    const jsonPath = join(JSON_DIR, `${file.key}.json`);
    const pdfPath = join(PDF_DIR, file.pdf);
    if (!existsSync(jsonPath)) throw new Error(`missing json: ${jsonPath}`);
    if (!existsSync(pdfPath)) throw new Error(`missing pdf: ${pdfPath}`);
    const source = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const questions = [];

    for (const entry of source) {
      const content = cleanStem(entry.text);
      if (!content) continue;
      const topic = entry.tags?.topic || file.key.replace('专题', '');
      const subtopic = entry.tags?.subtopic || '';
      const knowledgePoint = classify(topic, subtopic, content);
      const manualCrop = MANUAL_CROPS.get(entry.id);
      const imageNeeded = Boolean(manualCrop) || needsSourceImage(entry, content);
      let sourceImage = '';
      if (imageNeeded && entry.page) {
        const pageOut = pageImagePath(file.key, entry.page);
        const questionOut = questionImagePath(file.key, entry.id);
        sourceImage = questionImageUrl(file.key, entry.id);
        const pageKey = `${file.key}:${entry.page}`;
        renderManifestByKey.set(pageKey, { pdf: pdfPath, page: entry.page, out: pageOut });
        if (!cropPages.has(pageKey)) {
          cropPages.set(pageKey, {
            key: file.key,
            page: entry.page,
            page_image: pageOut,
            questions: [],
          });
        }
        cropPages.get(pageKey).questions.push({ id: entry.id, out: questionOut, box: manualCrop?.box });
      }
      questions.push({
        id: entry.id,
        page: entry.page,
        number: entry.number || '',
        content,
        type: mapType(entry.tags?.question_type),
        difficulty: mapDifficulty(entry.tags?.difficulty),
        knowledgePoint,
        answer: cleanStem(entry.answer || ''),
        sourceImage,
      });
    }

    imports.push({ ...file, jsonPath, pdfPath, questions });
  }

  const manifest = [...renderManifestByKey.values()];
  renderSourceImages(manifest);
  cropQuestionImages([...cropPages.values()]);

  const summary = [];

  for (const item of imports) {
    await deleteExistingBatch(item.batch);
    const batch = await db.execute({
      sql: 'INSERT INTO question_import_batches (owner_user_id, file_name, file_type, question_count, status) VALUES (?, ?, ?, ?, ?)',
      args: [OWNER_USER_ID, item.batch, 'pdf', item.questions.length, 'committed'],
    });
    const batchId = Number(batch.lastInsertRowid);
    let inserted = 0;

    for (const q of item.questions) {
      await db.execute({
        sql: `INSERT INTO questions
          (owner_user_id, content, type, difficulty, knowledge_point, answer, status, source_image, source_file, source_type, import_batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          OWNER_USER_ID,
          q.content,
          q.type,
          q.difficulty,
          q.knowledgePoint,
          q.answer,
          'approved',
          sourceImageExists(q.sourceImage) ? q.sourceImage : '',
          item.batch,
          'pdf',
          batchId,
        ],
      });
      inserted += 1;
    }
    await db.execute({
      sql: 'UPDATE question_import_batches SET question_count = ? WHERE id = ?',
      args: [inserted, batchId],
    });
    summary.push({ file: item.batch, jsonQuestions: item.questions.length, inserted });
  }

  const out = join(TMP_DIR, 'import_summary.json');
  writeFileSync(out, JSON.stringify({ summary, renderedImages: manifest.length }, null, 2));
  console.log(JSON.stringify({ summary, renderedImages: manifest.length, summaryFile: out }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
