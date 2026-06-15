// ============================================================
// API LAYER
// ============================================================
function resolveApiBase() {
  if (window.AI_WORKBENCH_API_BASE) return String(window.AI_WORKBENCH_API_BASE).replace(/\/$/, '');
  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  const isBackendPort = location.port === '3001';
  if (isLocalHost && !isBackendPort) return 'http://127.0.0.1:3001/api';
  return '/api';
}

const API = resolveApiBase();
let authToken = localStorage.getItem('teacher-auth-token') || '';

function apiHeaders(extra = {}) {
  return {
    ...extra,
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
  };
}

async function apiJson(r) {
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    if (r.status === 401 && authToken) handleAuthExpired();
    throw new Error(data.error || `请求失败：${r.status}`);
  }
  return data;
}

function apiErrorMessage(err) {
  if (err instanceof TypeError && String(err.message || '').includes('fetch')) {
    return '无法连接后端服务，请确认工作台服务已启动';
  }
  return err.message || '请稍后重试';
}

const api = {
  async get(path) {
    const r = await fetch(API + path, { headers: apiHeaders() });
    return apiJson(r);
  },
  async post(path, body) {
    const r = await fetch(API + path, { method: 'POST', headers: apiHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    return apiJson(r);
  },
  async put(path, body) {
    const r = await fetch(API + path, { method: 'PUT', headers: apiHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(body) });
    return apiJson(r);
  },
  async delete(path) {
    const r = await fetch(API + path, { method: 'DELETE', headers: apiHeaders() });
    return apiJson(r);
  }
};

// 颜色映射（数据库不存 color，前端按 status 派发）
const statusColors = { 'high-risk': '#e74c3c', 'follow-up': '#e67e22', 'progress': '#2980b9', 'stable': '#27ae60' };
function withColor(s) { return { ...s, color: statusColors[s.status] || '#9b8b7a' }; }

// ============================================================
// MOCK DATA（种子数据，仅首次写入数据库用）
// ============================================================
const mockData = {
  teacher: { name: "王老师", class: "三年级（2）班", subject: "小学数学" },
  students: [
    { id: 1, name: "张小雨", grade: "三年级", status: "high-risk", color: "#e74c3c",
      weakPoints: [],
      errorCauses: { "审题类": 45, "建模类": 30, "计算类": 25 },
      homeworkRate: 72, lastRecord: "2026-05-28",
      suggestion: "下次课重点练习分数应用题的审题步骤，建议用画图法辅助理解题意。",
      recentErrors: ["3/4 + 1/2 = 5/6（分母未通分）", "行程问题漏读速度条件", "千克与克换算错误"],
      notes: "上课注意力容易分散，需要多互动提问。家长反映在家做题时间不够。"
    },
    { id: 2, name: "李明浩", grade: "三年级", status: "follow-up", color: "#e67e22",
      weakPoints: [],
      errorCauses: { "建模类": 50, "计算类": 35, "习惯类": 15 },
      homeworkRate: 88, lastRecord: "2026-05-27",
      suggestion: "乘法竖式已有进步，本周重点攻克两步应用题的解题思路。",
      recentErrors: ["两步应用题列式错误", "三位数乘两位数进位遗漏"],
      notes: "学习态度认真，但解题思路不够灵活。"
    },
    { id: 3, name: "陈思琪", grade: "三年级", status: "progress", color: "#2980b9",
      weakPoints: [],
      errorCauses: { "概念类": 60, "计算类": 40 },
      homeworkRate: 95, lastRecord: "2026-05-28",
      suggestion: "时钟问题已基本掌握，可以适当增加难度，引入跨天推算。",
      recentErrors: ["跨小时时间差计算"],
      notes: "进步明显，上周时钟问题正确率从60%提升到85%。"
    },
    { id: 4, name: "王子轩", grade: "三年级", status: "stable", color: "#27ae60",
      weakPoints: [],
      errorCauses: { "计算类": 30, "习惯类": 20 },
      homeworkRate: 98, lastRecord: "2026-05-26",
      suggestion: "基础扎实，可以尝试奥数入门题目，培养数学思维。",
      recentErrors: ["偶尔粗心计算错误"],
      notes: "班级前三名，可以适当拔高。"
    },
    { id: 5, name: "刘雨桐", grade: "三年级", status: "high-risk", color: "#e74c3c",
      weakPoints: [],
      errorCauses: { "概念类": 55, "计算类": 30, "审题类": 15 },
      homeworkRate: 65, lastRecord: "2026-05-25",
      suggestion: "除法概念需要从头梳理，建议用实物分组的方式重新建立直觉。",
      recentErrors: ["有余数除法商写错位置", "余数大于除数", "应用题不知道用除法"],
      notes: "基础较弱，需要额外补课。家长配合度高。"
    },
    { id: 6, name: "赵浩然", grade: "三年级", status: "follow-up", color: "#e67e22",
      weakPoints: [],
      errorCauses: { "概念类": 70, "建模类": 30 },
      homeworkRate: 82, lastRecord: "2026-05-27",
      suggestion: "周长和面积的概念需要通过实际操作来区分，下次课带尺子量教室。",
      recentErrors: ["把周长公式用于面积计算", "不规则图形分割方法不对"],
      notes: "空间想象力较弱，需要多做图形题。"
    },
    { id: 7, name: "孙晓萌", grade: "三年级", status: "progress", color: "#2980b9",
      weakPoints: [],
      errorCauses: { "计算类": 65, "习惯类": 35 },
      homeworkRate: 90, lastRecord: "2026-05-28",
      suggestion: "小数点对齐的习惯已经养成，继续巩固，可以开始小数乘法预习。",
      recentErrors: ["小数点未对齐导致计算错误"],
      notes: "书写工整，计算习惯在改善中。"
    },
    { id: 8, name: "周天宇", grade: "三年级", status: "stable", color: "#27ae60",
      weakPoints: [],
      errorCauses: { "习惯类": 50, "计算类": 50 },
      homeworkRate: 93, lastRecord: "2026-05-26",
      suggestion: "基础稳定，重点提升计算速度，练习凑整法和补差法。",
      recentErrors: ["计算速度慢，考试时间不够"],
      notes: "理解能力强，但计算速度是短板。"
    }
  ],
  questions: [
    { id: 1, content: "小明有苹果24个，分给6个小朋友，每人分几个？", type: "应用题", difficulty: "基础", knowledgePoint: "平均数", answer: "4个", status: "approved" },
    { id: 2, content: "一个长方形长8厘米，宽5厘米，求周长和面积。", type: "计算题", difficulty: "基础", knowledgePoint: "周长", answer: "周长26cm，面积40cm²", status: "approved" },
    { id: 3, content: "3/4 + 1/4 = ？", type: "计算题", difficulty: "基础", knowledgePoint: "分数计算与比大小", answer: "1", status: "approved" },
    { id: 4, content: "火车上午8:30出发，行驶了3小时45分钟，几点到达？", type: "应用题", difficulty: "提升", knowledgePoint: "时钟问题", answer: "12:15", status: "approved" },
    { id: 5, content: "一件衣服原价120元，打八折后多少钱？", type: "应用题", difficulty: "提升", knowledgePoint: "经济问题", answer: "96元", status: "approved" },
    { id: 6, content: "计算：125 × 8 = ？（用简便方法）", type: "计算题", difficulty: "提升", knowledgePoint: "整数计算", answer: "1000", status: "approved" },
    { id: 7, content: "一个正方形边长6cm，求面积。", type: "计算题", difficulty: "基础", knowledgePoint: "几何思想", answer: "36cm²", status: "approved" },
    { id: 8, content: "小红有36张贴纸，比小明多12张，小明有多少张？", type: "应用题", difficulty: "基础", knowledgePoint: "和差倍", answer: "24张", status: "approved" },
    { id: 9, content: "0.5 + 0.35 = ？", type: "计算题", difficulty: "基础", knowledgePoint: "小数计算", answer: "0.85", status: "approved" },
    { id: 10, content: "一桶油重15千克，用去了2/5，还剩多少千克？", type: "应用题", difficulty: "提升", knowledgePoint: "分数应用题", answer: "9千克", status: "approved" }
  ],
  reminders: [
    { type: "urgent", text: "张小雨 新增分数应用题错题，需确认薄弱分类", student: 1 },
    { type: "urgent", text: "刘雨桐 连续3次整数计算错题集中，需专项归因", student: 5 },
    { type: "normal", text: "李明浩 和差倍专项练习已准备好，待发送", student: 2 },
    { type: "normal", text: "陈思琪 本周进步明显，可以发送鼓励反馈给家长", student: 3 },
    { type: "info", text: "题库已导入10道分数应用题，可用于专项练习" }
  ],
  knowledgeTree: [
    { id: 'calculation', label: '计算', icon: '计', children: [
      { id: 'calculation-topics', label: '二级分类', children: [
        { id: 'calculation-1', label: '整数计算' },
        { id: 'calculation-2', label: '等差数列' },
        { id: 'calculation-3', label: '小数计算' },
        { id: 'calculation-4', label: '定义新运算' },
        { id: 'calculation-5', label: '数列与数表' },
        { id: 'calculation-6', label: '整数裂项' },
        { id: 'calculation-7', label: '分数计算与比大小' },
        { id: 'calculation-8', label: '方程' },
        { id: 'calculation-9', label: '等比数列' },
        { id: 'calculation-10', label: '高斯记号' }
      ]}
    ]},
    { id: 'word-problem', label: '应用题', icon: '用', children: [
      { id: 'word-problem-topics', label: '二级分类', children: [
        { id: 'word-problem-1', label: '和差倍' },
        { id: 'word-problem-2', label: '鸡兔同笼' },
        { id: 'word-problem-3', label: '盈亏问题' },
        { id: 'word-problem-4', label: '周期问题' },
        { id: 'word-problem-5', label: '间隔问题' },
        { id: 'word-problem-6', label: '方阵' },
        { id: 'word-problem-7', label: '平均数' },
        { id: 'word-problem-8', label: '年龄问题' },
        { id: 'word-problem-9', label: '页码问题' },
        { id: 'word-problem-10', label: '牛吃草问题' },
        { id: 'word-problem-11', label: '分数应用题' },
        { id: 'word-problem-12', label: '比例应用题' },
        { id: 'word-problem-13', label: '工程问题' },
        { id: 'word-problem-14', label: '浓度问题' },
        { id: 'word-problem-15', label: '经济问题' }
      ]}
    ]},
    { id: 'geometry', label: '几何', icon: '几', children: [
      { id: 'geometry-topics', label: '二级分类', children: [
        { id: 'geometry-1', label: '点线角' },
        { id: 'geometry-2', label: '周长' },
        { id: 'geometry-3', label: '几何思想' },
        { id: 'geometry-4', label: '几何变换' },
        { id: 'geometry-5', label: '等积变形' },
        { id: 'geometry-6', label: '一半模型' },
        { id: 'geometry-7', label: '格点面积' },
        { id: 'geometry-8', label: '勾股定理' },
        { id: 'geometry-9', label: '等高模型' },
        { id: 'geometry-10', label: '鸟头模型' },
        { id: 'geometry-11', label: '燕尾模型' },
        { id: 'geometry-12', label: '沙漏模型' },
        { id: 'geometry-13', label: '圆与扇形' },
        { id: 'geometry-14', label: '长方体与立方体' },
        { id: 'geometry-15', label: '水中浸物' }
      ]}
    ]},
    { id: 'counting', label: '计数', icon: '数', children: [
      { id: 'counting-topics', label: '二级分类', children: [
        { id: 'counting-1', label: '枚举法' },
        { id: 'counting-2', label: '树形图' },
        { id: 'counting-3', label: '加乘原理' },
        { id: 'counting-4', label: '标数法' },
        { id: 'counting-5', label: '递推计数' },
        { id: 'counting-6', label: '传球法' },
        { id: 'counting-7', label: '插空法' },
        { id: 'counting-8', label: '捆绑法' },
        { id: 'counting-9', label: '图形计数' },
        { id: 'counting-10', label: '对应法' }
      ]}
    ]},
    { id: 'travel', label: '行程', icon: '行', children: [
      { id: 'travel-topics', label: '二级分类', children: [
        { id: 'travel-1', label: '基本相遇与追及' },
        { id: 'travel-2', label: '火车过桥' },
        { id: 'travel-3', label: '流水行船' },
        { id: 'travel-4', label: '环形跑道' },
        { id: 'travel-5', label: '时钟问题' },
        { id: 'travel-6', label: '间隔发车' },
        { id: 'travel-7', label: '扶梯问题' },
        { id: 'travel-8', label: '接送问题' },
        { id: 'travel-9', label: '空中加油' },
        { id: 'travel-10', label: '多人多次相遇' },
        { id: 'travel-11', label: '分段行程' },
        { id: 'travel-12', label: '比例行程' }
      ]}
    ]},
    { id: 'number-theory', label: '数论', icon: '论', children: [
      { id: 'number-theory-topics', label: '二级分类', children: [
        { id: 'number-theory-1', label: '奇数与偶数' },
        { id: 'number-theory-2', label: '整除特性' },
        { id: 'number-theory-3', label: '质数与合数' },
        { id: 'number-theory-4', label: '分解质因数' },
        { id: 'number-theory-5', label: '因数个数' },
        { id: 'number-theory-6', label: '循环小数' },
        { id: 'number-theory-7', label: '大因小倍' },
        { id: 'number-theory-8', label: '余数问题' },
        { id: 'number-theory-9', label: '不定方程' }
      ]}
    ]},
    { id: 'combinatorics', label: '组合问题', icon: '组', children: [
      { id: 'combinatorics-topics', label: '二级分类', children: [
        { id: 'combinatorics-1', label: '找规律' },
        { id: 'combinatorics-2', label: '加减法数字谜' },
        { id: 'combinatorics-3', label: '乘除法数字谜' },
        { id: 'combinatorics-4', label: '数阵图' },
        { id: 'combinatorics-5', label: '幻方' },
        { id: 'combinatorics-6', label: '统筹最优问题' },
        { id: 'combinatorics-7', label: '必胜策略' },
        { id: 'combinatorics-8', label: '逻辑推理' },
        { id: 'combinatorics-9', label: '最值问题' },
        { id: 'combinatorics-10', label: '抽屉原理' },
        { id: 'combinatorics-11', label: '构造与论证' }
      ]}
    ]}
  ],
  feedbackDrafts: {
    1: { status: "draft", text: "王老师您好！张小雨本周在分数应用题方面仍有困难，主要问题是审题时容易漏掉条件。建议在家练习时，先让孩子用自己的话复述题目，再动笔计算。下次课将重点练习审题方法，并安排同类题巩固。" },
    2: { status: "sent", text: "王老师您好！李明浩本周整数计算有明显进步，进位错误减少了很多。和差倍题还需要继续练习，下次课会专项训练数量关系。孩子上课认真，请继续保持！" },
    3: { status: "draft", text: "王老师您好！陈思琪本周进步非常明显！时钟问题正确率从60%提升到85%，非常棒！下次课将开始稍复杂的时间推算，难度会稍有提升，请家长鼓励孩子保持信心。" },
    5: { status: "none", text: "" },
    6: { status: "draft", text: "王老师您好！赵浩然本周在几何思想学习中遇到了困难，主要是周长和面积的概念容易混淆。下次课会用实物操作的方式帮助理解。建议在家用尺子量量家里的桌子，感受一下周长和面积的区别。" }
  }
};

// ============================================================
// STATE
// ============================================================
// mockData.students / mockData.questions 在 init 后由 API 数据填充
let currentStudent = null;
const validTabs = ['dashboard', 'students', 'homework', 'mistakes', 'agent', 'questions'];
function getStoredTab() {
  try {
    const tab = localStorage.getItem('teacher-current-tab');
    return validTabs.includes(tab) ? tab : 'dashboard';
  } catch (e) {
    return 'dashboard';
  }
}
let currentTab = getStoredTab();
let currentStudentFilter = 'all';
let studentListPage = 1;
let studentDeleteMode = false;
let kanbanData = { 'pending-ocr': [], 'pending-review': [], 'approved': [] };
let qSelectedFile = null;
let qFilters = { knowledgePoint: 'all' };
let qPage = 1;
let qImportPreview = null;
let qClassifyLoading = false;
let qFileClassifyLoading = '';
let qCategoryEditor = null;
let qSystemBankState = { enabled: true, unlocked: true, isAdmin: false, cost: 0 };
const qManualFileName = '手动添加题目.md';
let qInsertFileName = null;
let kmSelectedStudent = null;
let kmFocusedNode = null;
let kmFocusedSectionId = null;
let kmFullMapOpen = false;
let studentProfiles = {};
let studentProfileLoading = new Set();
let studentHistoryTab = 'recent7';
let homeworkFocusPoint = null;
let hwDraft = null;
let hwRecords = [];
let hwRecordPage = 1;
let hwPreviewMode = 'edit';
let hwSubTab = 'generate';
const creditState = {
  balance: 1280,
  todayUsed: 26,
  records: [
    { title: '生成个性化作业', cost: 12, time: '今天 09:42', detail: '张小雨 · 5题' },
    { title: 'AI 错题分析', cost: 6, time: '今天 09:18', detail: '2 道错题' },
    { title: 'AI 补全题库分类', cost: 3, time: '昨天 18:06', detail: '72 道题' }
  ]
};
const creditCosts = { homeworkBase: 8, homeworkPerQuestion: 1, uploadPerFile: 5, feedback: 3 };

// ============================================================
// UTILITIES
// ============================================================
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function renderCredits() {
  const pill = document.getElementById('credit-pill');
  const pillText = document.getElementById('credit-pill-text');
  if (pill) {
    if (pillText) pillText.textContent = `积分 ${creditState.balance}`;
    pill.classList.toggle('low', creditState.balance < 100);
  }
  const content = document.getElementById('credit-drawer-content');
  if (!content) return;
  content.innerHTML = `
    <div class="credit-balance">${creditState.balance}<span style="font-size:15px;margin-left:4px">积分</span></div>
    <div class="text-muted text-sm">${creditState.balance < 100 ? '余额偏低，建议及时补充。' : '余额充足，可继续使用 AI 功能。'}</div>
    <div class="credit-stat-grid">
      <div class="credit-stat">
        <div class="note-label">今日扣分</div>
        <div style="font-size:20px;font-weight:800">${creditState.todayUsed}</div>
      </div>
      <div class="credit-stat">
        <div class="note-label">当前策略</div>
        <div style="font-size:13px;line-height:1.7">题库、作业和 AI 功能暂不扣积分</div>
      </div>
    </div>
    <div class="card-title" style="margin-bottom:4px">积分记录</div>
    ${creditState.records.map(r => `
      <div class="credit-record">
        <div>
          <div class="credit-record-title">${r.title}</div>
          <div class="credit-record-meta">${r.detail} · ${r.time}</div>
        </div>
        <div class="credit-record-cost">${Number(r.cost || 0) ? `-${r.cost}` : '免费'}</div>
      </div>
    `).join('')}
  `;
}

function applyCreditSummary(summary) {
  if (!summary) return;
  if (Number.isFinite(Number(summary.balance))) creditState.balance = Number(summary.balance);
  if (Number.isFinite(Number(summary.todayUsed))) creditState.todayUsed = Number(summary.todayUsed);
  if (Array.isArray(summary.records)) {
    creditState.records = summary.records.map(r => ({
      title: r.title || '积分消耗',
      cost: Math.abs(Number(r.amount || r.cost || 0)),
      detail: r.detail || '',
      time: formatCreditTime(r.created_at || r.time),
    })).slice(0, 8);
  }
  renderCredits();
}

function formatCreditTime(value) {
  const text = String(value || '');
  if (!text) return '刚刚';
  if (text.includes('T')) return text.slice(5, 16).replace('T', ' ');
  return text.slice(5, 16) || text;
}

async function refreshCredits() {
  if (!authToken) return;
  try {
    const data = await api.get('/credits');
    applyCreditSummary(data);
  } catch (err) {
    console.warn('credits unavailable:', err.message);
  }
}

function toggleCreditDrawer(show) {
  document.getElementById('credit-mask')?.classList.toggle('show', show);
  document.getElementById('credit-drawer')?.classList.toggle('show', show);
  if (show) renderCredits();
}

function creditCostLabel(cost) {
  return '<span class="credit-cost">当前免费使用</span>';
}

function spendCredits(cost, title, detail) {
  renderCredits();
  return true;
}

function statusLabel(s) {
  const map = { 'high-risk': ['red', '需关注'], 'follow-up': ['orange', '待跟进'], 'progress': ['blue', '进步中'], 'stable': ['green', '稳定'] };
  const [cls, label] = map[s] || ['gray', s];
  return `<span class="pill ${cls}">${label}</span>`;
}

function avatarHtml(student, size = 34) {
  return `<div class="student-avatar" style="width:${size}px;height:${size}px;background:${student.color};font-size:${Math.round(size*0.38)}px;">${student.name[0]}</div>`;
}

function setDate() {
  const d = new Date();
  const days = ['日','一','二','三','四','五','六'];
  document.getElementById('topbar-date').textContent = `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 周${days[d.getDay()]}`;
}

// ============================================================
// TAB SWITCHING
// ============================================================
const tabTitles = {
  dashboard: '仪表盘', students: '学生管理',
  questions: '题库管理', homework: '作业生成', mistakes: '错题分析', agent: 'AI 助教'
};

function activateTab(name) {
  const safeName = validTabs.includes(name) ? name : 'dashboard';
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + safeName)?.classList.add('active');
  document.querySelector(`.nav-item[onclick*="'${safeName}'"]`)?.classList.add('active');
  document.getElementById('topbar-title').textContent = tabTitles[safeName];
  currentTab = safeName;
}

function switchTab(name) {
  activateTab(name);
  try {
    localStorage.setItem('teacher-current-tab', currentTab);
  } catch (e) {}
  renderTab(currentTab);
}

function renderTab(name) {
  const fns = {
    dashboard: renderDashboard,
    students: renderStudents,
    questions: renderQuestions,
    homework: renderHomework,
    mistakes: renderMistakes,
    agent: renderAgent
  };
  if (fns[name]) fns[name]();
}

function renderCurrentTab() {
  activateTab(currentTab || 'dashboard');
  renderTab(currentTab);
}

async function loadWorkspaceData() {
  let [students, systemBank, questions] = await Promise.all([
    api.get('/students'),
    loadQuestionSystemBankStatus(),
    api.get('/questions')
  ]);
  qSystemBankState = systemBank;
  ({ students, questions } = await seedIfEmpty(students, questions));
  mockData.students = students.map(withColor);
  mockData.questions = questions;
  await loadKnowledgeMapStatuses(mockData.students);
  kanbanData = {
    'pending-ocr': mockData.questions.filter(q => q.status === 'pending-ocr'),
    'pending-review': mockData.questions.filter(q => q.status === 'pending-review'),
    'approved': mockData.questions.filter(q => q.status === 'approved')
  };
  currentStudent = mockData.students[0];
  await loadFeishuIntegrationStatus();
}

async function loadQuestionSystemBankStatus() {
  try {
    const data = await api.get('/questions/system-library/status');
    return data.systemBank || { enabled: true, unlocked: true, isAdmin: false, cost: 0 };
  } catch (err) {
    console.warn('system question bank status unavailable:', err.message);
    return { enabled: true, unlocked: true, isAdmin: false, cost: 0 };
  }
}

async function enterWorkspace() {
  if (!currentUser) {
    showLandingAuth('login');
    return;
  }
  renderWorkspaceAccount();
  document.getElementById('landing-page')?.style.setProperty('display', 'none');
  document.getElementById('workspace-app')?.classList.remove('is-hidden');
  renderCurrentTab();
  try {
    await refreshCredits();
    await loadWorkspaceData();
    renderCurrentTab();
  } catch (e) {
    showToast((e.message || '工作台数据加载失败') + '，已先进入工作台');
  }
}

async function openWorkspaceEntry() {
  if (currentUser) {
    await enterWorkspace();
    return;
  }
  showLandingAuth('login');
}

function showLandingHome() {
  document.getElementById('workspace-app')?.classList.add('is-hidden');
  document.getElementById('landing-page')?.style.removeProperty('display');
  document.getElementById('landing-shell')?.classList.remove('auth-mode');
  document.getElementById('landing-home-main')?.style.removeProperty('display');
  document.getElementById('landing-foot')?.style.removeProperty('display');
  const authStage = document.getElementById('landing-auth-stage');
  if (authStage) {
    authStage.classList.remove('show');
    authStage.innerHTML = '';
  }
  document.getElementById('landing-login-btn')?.classList.remove('active');
  document.getElementById('landing-register-btn')?.classList.remove('active');
  renderLandingAccount();
  renderWorkspaceAccount();
}

let landingAuthMode = 'login';
let registerCodeState = { email: '', code: '' };
let currentUser = null;

function saveAuthSession(session) {
  authToken = session?.token || '';
  currentUser = session?.user || null;
  try {
    authToken ? localStorage.setItem('teacher-auth-token', authToken) : localStorage.removeItem('teacher-auth-token');
    localStorage.removeItem('teacher-current-user');
  } catch (e) {}
}

function clearAuthSession() {
  saveAuthSession(null);
}

function handleAuthExpired() {
  clearAuthSession();
  renderLandingAccount();
  renderWorkspaceAccount();
  document.getElementById('workspace-app')?.classList.add('is-hidden');
  document.getElementById('landing-page')?.style.removeProperty('display');
}

async function restoreCurrentUser() {
  if (!authToken) {
    currentUser = null;
    return false;
  }
  try {
    const data = await api.get('/auth/me');
    currentUser = data.user || null;
    return !!currentUser;
  } catch (e) {
    clearAuthSession();
    return false;
  }
}

function getUserInitial(name) {
  return String(name || 'T').trim().slice(0, 1).toUpperCase() || 'T';
}

function renderLandingAccount() {
  const area = document.getElementById('landing-account-area');
  if (!area) return;
  if (!currentUser) {
    area.innerHTML = `
      <div class="landing-auth" aria-label="登录注册">
        <button class="landing-auth-btn login" id="landing-login-btn" type="button" onclick="showLandingAuth('login'); return false;" onpointerdown="showLandingAuth('login'); return false;">登录</button>
        <button class="landing-auth-btn register" id="landing-register-btn" type="button" onclick="showLandingAuth('register'); return false;" onpointerdown="showLandingAuth('register'); return false;">注册</button>
      </div>
    `;
    const loginButton = document.getElementById('landing-login-btn');
    const registerButton = document.getElementById('landing-register-btn');
    const bindAuthButton = (button, mode) => {
      if (!button) return;
      const openAuth = event => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        showLandingAuth(mode);
      };
      button.addEventListener('click', openAuth);
      button.addEventListener('pointerdown', openAuth);
    };
    bindAuthButton(loginButton, 'login');
    bindAuthButton(registerButton, 'register');
    loginButton?.classList.toggle('active', landingAuthMode === 'login' && document.getElementById('landing-auth-stage')?.classList.contains('show'));
    registerButton?.classList.toggle('active', landingAuthMode === 'register' && document.getElementById('landing-auth-stage')?.classList.contains('show'));
    return;
  }
  area.innerHTML = renderUserPill('landing-user-menu');
}

function renderWorkspaceAccount() {
  const area = document.getElementById('workspace-account-area');
  if (!area) return;
  area.innerHTML = currentUser ? renderUserPill('workspace-user-menu') : '';
}

function renderUserPill(menuId) {
  const name = escapeHtml(currentUser?.username || 'test');
  return `
    <div class="landing-user">
      <button class="landing-user-pill" onclick="toggleUserMenu('${menuId}')" aria-label="用户菜单">
        <span class="landing-user-avatar">${getUserInitial(currentUser?.username)}</span>
        <span>${name}</span>
        <span class="landing-user-arrow">⌄</span>
      </button>
      <div class="landing-user-menu" id="${menuId}">
        <button type="button" onclick="showToast('个人设置后续开放')">个人设置</button>
        <button type="button" onclick="logoutLandingUser()">退出登录</button>
      </div>
    </div>
  `;
}

function toggleUserMenu(menuId) {
  document.getElementById(menuId)?.classList.toggle('show');
}

async function logoutLandingUser() {
  if (authToken) {
    try { await api.post('/auth/logout', {}); } catch (e) {}
  }
  clearAuthSession();
  document.getElementById('landing-user-menu')?.classList.remove('show');
  document.getElementById('workspace-user-menu')?.classList.remove('show');
  showLandingHome();
  showToast('已退出登录');
}

function showLandingAuth(mode = 'login') {
  landingAuthMode = mode === 'register' ? 'register' : 'login';
  document.getElementById('landing-shell')?.classList.add('auth-mode');
  document.getElementById('landing-auth-stage')?.classList.add('show');
  renderLandingAccount();
  renderLandingAuth();
}

function renderLandingAuth() {
  const stage = document.getElementById('landing-auth-stage');
  if (!stage) return;
  const isRegister = landingAuthMode === 'register';
  stage.innerHTML = `
    <div class="auth-showcase">
      <div class="auth-visual">
        <div class="auth-orbit"></div>
        <div class="auth-bubble one"></div>
        <div class="auth-bubble two"></div>
        <div class="auth-bubble three"></div>
      </div>
      <div class="auth-form-wrap">
        <div class="auth-form">
          <div class="auth-form-title">${isRegister ? '注册' : '登录'}</div>
          <div class="auth-field">
            <label class="auth-label">${isRegister ? '用户名' : '用户名或邮箱'}</label>
            <input class="auth-input" id="auth-username" placeholder="${isRegister ? '请输入用户名' : '请输入用户名或邮箱'}" autocomplete="username">
          </div>
          <div class="auth-field">
            <label class="auth-label">密码</label>
            <div class="auth-password-wrap">
              <input class="auth-input" id="auth-password" placeholder="${isRegister ? '输入密码，至少 8 位' : '请输入密码'}" type="password" autocomplete="${isRegister ? 'new-password' : 'current-password'}">
              <button class="auth-eye-btn is-hidden" type="button" onclick="togglePasswordVisible('auth-password', this)" aria-label="显示密码">${authEyeIcon(false)}</button>
            </div>
          </div>
          ${isRegister ? `
            <div class="auth-field">
              <label class="auth-label">确认密码</label>
              <div class="auth-password-wrap">
                <input class="auth-input" id="auth-confirm" placeholder="请再次输入密码" type="password" autocomplete="new-password">
                <button class="auth-eye-btn is-hidden" type="button" onclick="togglePasswordVisible('auth-confirm', this)" aria-label="显示密码">${authEyeIcon(false)}</button>
              </div>
            </div>
            <div class="auth-field">
              <label class="auth-label">邮箱</label>
              <div class="auth-input-row">
                <input class="auth-input" id="auth-email" placeholder="请输入邮箱地址" autocomplete="email" oninput="resetRegisterCodeIfEmailChanged()">
                <button class="auth-code-btn" type="button" onclick="sendRegisterCode()">获取验证码</button>
              </div>
            </div>
            <div class="auth-field">
              <label class="auth-label">验证码</label>
              <input class="auth-input" id="auth-code" placeholder="请输入邮箱验证码" inputmode="numeric" autocomplete="one-time-code">
            </div>
          ` : ''}
          <label class="auth-check">
            <input type="checkbox" id="auth-agree" ${isRegister ? '' : 'checked'}>
            <span>我已阅读并同意用户协议和隐私政策</span>
          </label>
          <button class="btn btn-primary auth-submit" onclick="submitLandingAuth()">${isRegister ? '注册' : '登录'}</button>
          <div class="auth-switch">
            ${isRegister ? '已有账户？' : '没有账户？'}
            <a onclick="showLandingAuth('${isRegister ? 'login' : 'register'}')">${isRegister ? '登录' : '注册'}</a>
          </div>
        </div>
      </div>
    </div>
  `;
  setTimeout(() => document.getElementById('auth-username')?.focus(), 50);
}

function getAuthEmailValue() {
  return String(document.getElementById('auth-email')?.value || '').trim();
}

function authEyeIcon(visible) {
  return visible
    ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18"/><path d="M10.6 10.6a3 3 0 0 0 3.8 3.8"/><path d="M9.4 5.4A10.5 10.5 0 0 1 12 5c6 0 9.5 7 9.5 7a16.4 16.4 0 0 1-2.2 3.1"/><path d="M6.5 6.8C3.7 8.7 2.5 12 2.5 12s3.5 7 9.5 7c1.4 0 2.7-.3 3.8-.9"/></svg>';
}

function togglePasswordVisible(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const shouldShow = input.type === 'password';
  input.type = shouldShow ? 'text' : 'password';
  if (button) {
    button.innerHTML = authEyeIcon(shouldShow);
    button.classList.toggle('is-hidden', !shouldShow);
    button.setAttribute('aria-label', shouldShow ? '隐藏密码' : '显示密码');
  }
}

function resetRegisterCodeIfEmailChanged() {
  const email = getAuthEmailValue();
  if (registerCodeState.email && registerCodeState.email !== email) {
    registerCodeState = { email: '', code: '' };
  }
}

async function sendRegisterCode() {
  const email = getAuthEmailValue();
  if (!email.includes('@')) {
    showToast('请先填写正确的邮箱');
    return;
  }
  try {
    const data = await api.post('/auth/send-code', { email });
    registerCodeState = { email, code: data.devCode || '' };
    showToast(data.delivery === 'email' ? '验证码已发送，请查看邮箱' : `开发验证码：${data.devCode}`);
  } catch (err) {
    showToast(err.message || '验证码发送失败');
  }
}

async function submitLandingAuth() {
  const username = String(document.getElementById('auth-username')?.value || '').trim();
  const password = String(document.getElementById('auth-password')?.value || '').trim();
  const agree = document.getElementById('auth-agree')?.checked;
  if (!agree) {
    showToast('请先同意用户协议和隐私政策');
    return;
  }
  if (landingAuthMode === 'login') {
    try {
      const data = await api.post('/auth/login', { username, password });
      saveAuthSession(data);
      renderLandingAccount();
      renderWorkspaceAccount();
      showToast('登录成功');
      await enterWorkspace();
    } catch (err) {
      showToast(err.message || '账号或密码不正确');
    }
    return;
  }
  const confirm = String(document.getElementById('auth-confirm')?.value || '').trim();
  const email = String(document.getElementById('auth-email')?.value || '').trim();
  const code = String(document.getElementById('auth-code')?.value || '').trim();
  if (!username || password.length < 8 || password !== confirm || !email.includes('@')) {
    showToast('请完整填写注册信息');
    return;
  }
  if (!registerCodeState.email || registerCodeState.email !== email) {
    showToast('请先获取邮箱验证码');
    return;
  }
  try {
    const data = await api.post('/auth/register', { username, email, password, code });
    registerCodeState = { email: '', code: '' };
    saveAuthSession(data);
    renderLandingAccount();
    renderWorkspaceAccount();
    showToast('注册成功，已进入工作台');
    await enterWorkspace();
  } catch (err) {
    showToast(err.message || '注册失败');
  }
}

// ============================================================
// DASHBOARD
// ============================================================
function renderDashboard() {
  const questionFiles = buildQuestionFiles();
  const priorityStudents = [...mockData.students]
    .filter(s => ['high-risk', 'follow-up'].includes(s.status) || getStudentActualWeakPoints(s).length > 1 || (s.recentErrors || []).length > 1)
    .sort((a, b) => {
      const rank = { 'high-risk': 0, 'follow-up': 1, progress: 2, stable: 3 };
      return (rank[a.status] ?? 9) - (rank[b.status] ?? 9)
        || (getStudentActualWeakPoints(b).length + (b.recentErrors || []).length) - (getStudentActualWeakPoints(a).length + (a.recentErrors || []).length);
    })
    .slice(0, 6);
  const todoGroups = buildDashboardTodoGroups();
  const todoCount = todoGroups.reduce((sum, group) => sum + group.items.length, 0);
  const weakDist = getClassWeakDistribution();

  document.getElementById('tab-dashboard').innerHTML = `
    <div class="kpi-grid dashboard-kpi mb-24">
      <div class="kpi-card">
        <div class="kpi-icon green">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>
        </div>
        <div>
          <div class="kpi-label">学生总数</div>
          <div class="kpi-value">${mockData.students.length}<span>人</span></div>
          <div class="kpi-change">当前在管学生</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon blue">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z"/></svg>
        </div>
        <div>
          <div class="kpi-label">题库数量</div>
          <div class="kpi-value">${mockData.questions.length}<span>题</span></div>
          <div class="kpi-change">${questionFiles.length} 个资料文件 · 可用于专项组卷</div>
        </div>
      </div>
      <div class="kpi-card">
        <div class="kpi-icon red">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/></svg>
        </div>
        <div>
          <div class="kpi-label">今日待办</div>
          <div class="kpi-value">${todoCount}<span>件</span></div>
          <div class="kpi-change">围绕错题、薄弱点和练习推进</div>
        </div>
      </div>
    </div>

    <div class="card mb-16 follow-table">
        <div class="flex items-center justify-between" style="margin-bottom:14px">
          <div class="card-title" style="margin:0">学生跟进</div>
          <button class="btn btn-secondary btn-sm" onclick="switchTab('students', document.querySelector('.nav-item[onclick*=\\'students\\']'))">全部学生 ›</button>
        </div>
        ${priorityStudents.length === 0 ? '<div class="empty-state" style="padding:24px"><div class="empty-text">今天没有高优先级学生动作</div></div>' : `
		          <table class="table">
            <thead><tr><th>学生</th><th>当前薄弱点</th><th>最近错题</th><th>下次建议</th><th>状态</th></tr></thead>
            <tbody>
              ${priorityStudents.map(s => {
                const primaryWeak = getStudentActualWeakPoints(s)[0] || '暂无薄弱点';
                const recentError = (s.recentErrors || [])[0] || '—';
                const suggestion = s.status === 'high-risk'
                  ? '优先确认薄弱分类'
                  : (s.recentErrors || []).length > 1
                    ? '错题订正+同类题'
                    : s.status === 'progress'
                      ? '5分钟限时训练'
                      : '关键词圈画训练';
                return `
                  <tr>
                    <td><div class="flex items-center gap-8">${avatarHtml(s, 24)}<a onclick="goToStudent(${s.id})">${s.name}</a></div></td>
                    <td>${primaryWeak}</td>
                    <td>${recentError}</td>
                    <td>${suggestion}</td>
                    <td>${statusLabel(s.status)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        `}
      </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="card">
        <div class="card-title" style="margin-bottom:14px">分类待办</div>
        ${todoGroups.map(({ label, items, color }) => `
          <div style="margin-bottom:14px">
            <div class="flex items-center gap-8" style="margin-bottom:8px">
              <span class="pill ${color}">${label}</span>
              <span class="text-muted text-sm">${items.length} 项</span>
            </div>
            ${items.length === 0 ? '<div class="text-muted text-sm">暂无</div>' : items.map(item => `
              <div class="todo-item"><span class="todo-check"></span><span>${item.text}</span></div>
            `).join('')}
          </div>
        `).join('')}
      </div>
      <div class="card donut-card">
        <div class="card-title" style="margin-bottom:14px">班级薄弱点分布 <span class="text-muted" style="font-weight:500">（本周）</span></div>
        <div class="donut-wrap">
          <div class="donut-chart" style="background:conic-gradient(${weakDist.segments})"></div>
          <div class="donut-legend">
            ${weakDist.rows.map(r => `
              <div class="donut-row">
                <span class="donut-dot" style="background:${r.color}"></span>
                <span class="donut-label">${r.label}</span>
                <span class="donut-percent">${r.percent}%</span>
                <span class="donut-count">(${r.count}人)</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="note-block" style="margin-top:14px;margin-bottom:0;font-size:13px;line-height:1.6">${weakDist.summary}</div>
      </div>
    </div>
  `;
  if (currentStudent) loadStudentProfile(currentStudent.id);
  mockData.students.forEach(s => loadStudentProfile(s.id));
}

function buildDashboardTodoGroups() {
  const students = mockData.students || [];
  const pendingMistakes = students
    .map(s => {
      const profile = studentProfiles[s.id];
      const pendingCount = profile && !profile.error ? (profile.unclassifiedMistakes || 0) : 0;
      if (!pendingCount) return null;
      return {
        text: `${s.name} 有 ${pendingCount} 条错题待确认二级分类`,
        score: (s.status === 'high-risk' ? 10 : 0) + pendingCount
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const practiceTasks = students
    .map(s => {
      const weakPoints = getStudentActualWeakPoints(s);
      if (!weakPoints.length) return null;
      const label = weakPoints.slice(0, 2).join('、');
      return {
        text: `${s.name} 有薄弱点「${label}」，可生成综合练习或薄弱点专项练习`,
        score: weakPoints.length + ((s.recentErrors || []).length ? 2 : 0)
      };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const reviewTasks = students
    .map(s => {
      const profile = studentProfiles[s.id];
      const comparison = profile && !profile.error ? profile.comparison || {} : {};
      const recentTotal = comparison.recentTotal || (s.recentErrors || []).length || 0;
      const delta = comparison.deltaTotal || 0;
      if (recentTotal <= 0 && !['follow-up', 'progress'].includes(s.status)) return null;
      const action = delta > 0
        ? `近 7 天错题增加 ${delta} 道，建议查看变化`
        : recentTotal > 0
          ? `近 7 天新增 ${recentTotal} 道错题，建议复盘跟进`
          : '学习状态有变化，建议复盘最近练习';
      return { text: `${s.name} ${action}`, score: delta + recentTotal };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return [
    { label: '待处理错题', items: pendingMistakes, color: 'red' },
    { label: '待生成练习', items: practiceTasks, color: 'orange' },
    { label: '待复盘跟进', items: reviewTasks, color: 'blue' }
  ];
}

function getClassWeakDistribution() {
  const aliases = [
    { label: '分数应用题', color: 'var(--blue)', keys: ['分数'] },
    { label: '计算准确率', color: 'var(--green)', keys: ['计算', '乘法', '除法', '小数', '速算'] },
    { label: '时钟问题', color: 'var(--orange)', keys: ['时钟', '时间'] },
    { label: '几何图形', color: 'var(--red)', keys: ['图形', '面积', '周长'] },
  ];
  const rows = aliases.map(a => ({
    label: a.label,
    color: a.color,
    count: mockData.students.filter(s => getStudentActualWeakPoints(s).some(w => a.keys.some(k => w.includes(k)))).length
  }));
  const matched = new Set();
  aliases.forEach(a => {
    mockData.students.forEach(s => {
      if (getStudentActualWeakPoints(s).some(w => a.keys.some(k => w.includes(k)))) matched.add(s.id);
    });
  });
  rows.push({ label: '其他', color: '#d8d2c5', count: Math.max(0, mockData.students.length - matched.size) });
  const total = Math.max(1, rows.reduce((sum, r) => sum + r.count, 0));
  let start = 0;
  const segments = rows.map(r => {
    const deg = Math.round(r.count / total * 360);
    const seg = `${r.color} ${start}deg ${start + deg}deg`;
    start += deg;
    return seg;
  }).join(', ');
  const withPercent = rows.map(r => ({ ...r, percent: Math.round(r.count / total * 100) }));
  const primary = [...withPercent].sort((a, b) => b.count - a.count)[0];
  const summary = primary?.count > 0
    ? `本周主要薄弱集中在${primary.label}，建议优先安排短练或课前复习。`
    : '本周暂无明显共性薄弱点。';
  return { rows: withPercent, segments, summary };
}

function goToStudent(id, goHomework) {
  currentStudent = mockData.students.find(s => s.id === id);
  const target = goHomework ? 'homework' : 'students';
  if (goHomework) hwSubTab = 'generate';
  const navEl = document.querySelector(`.nav-item[onclick*="'${target}'"]`);
  switchTab(target, navEl);
}

// ============================================================
// STUDENTS
// ============================================================
function renderStudents() {
  if (!['all', 'weak', 'no-weak'].includes(currentStudentFilter)) currentStudentFilter = 'all';
  if (!currentStudent) currentStudent = mockData.students[0] || null;
  const filteredStudents = getFilteredStudents();
  document.getElementById('tab-students').innerHTML = `
    <div class="student-layout">
      <div class="student-list-panel">
        <div class="student-list-header">
          <div class="student-list-top">
            <div class="student-list-title">学生列表</div>
            <div class="student-list-actions">
              <button class="btn btn-primary btn-sm" onclick="openStudentCreateModal()">+ 添加</button>
              <button class="btn btn-danger btn-sm student-delete-toggle ${studentDeleteMode ? 'active' : ''}" onclick="toggleStudentDeleteMode()">${studentDeleteMode ? '取消' : '删除'}</button>
            </div>
          </div>
          <input class="search-input" placeholder="搜索学生姓名..." oninput="filterStudents(this.value)" id="student-search">
          <div class="student-list-tools">
            ${renderStudentFilterButton('all', '全部')}
            ${renderStudentFilterButton('weak', '有薄弱点')}
            ${renderStudentFilterButton('no-weak', '无薄弱点')}
          </div>
        </div>
        <div id="student-list-items">
          ${renderStudentListItems(filteredStudents)}
        </div>
        <div id="student-list-pagination">${renderStudentPagination(filteredStudents.length)}</div>
      </div>
      <div id="student-detail">
        ${renderStudentDetail(currentStudent)}
      </div>
    </div>
  `;
  mockData.students.forEach(s => loadStudentProfile(s.id));
}

function renderStudentFilterButton(filter, label) {
  return `<button class="btn btn-sm student-filter-btn ${currentStudentFilter === filter ? 'active' : ''}" onclick="setStudentFilter('${filter}')">${label}</button>`;
}

function studentMatchesFilter(s, filter) {
  const weakPoints = getStudentActualWeakPoints(s);
  if (filter === 'weak') return weakPoints.length > 0;
  if (filter === 'no-weak') return weakPoints.length === 0;
  return true;
}

function getFilteredStudents() {
  const keyword = (document.getElementById('student-search')?.value || '').trim();
  return mockData.students.filter(s => {
    const weakPoints = getStudentActualWeakPoints(s);
    const inSearch = !keyword || s.name.includes(keyword) || weakPoints.some(w => w.includes(keyword));
    return inSearch && studentMatchesFilter(s, currentStudentFilter);
  });
}

function getStudentActualWeakPoints(s) {
  const profile = studentProfiles[s.id];
  if (profile && !profile.error) return cleanKnowledgeNames(profile.weakPoints);
  return [];
}

function getStandardKnowledgePointSet() {
  const points = [];
  const walk = nodes => (nodes || []).forEach(node => {
    if (node.children?.length) walk(node.children);
    else if (node.label) points.push(node.label);
  });
  walk(mockData.knowledgeTree);
  return new Set(points);
}

function isStandardKnowledgePoint(name) {
  const value = String(name || '').trim();
  return getStandardKnowledgePointSet().has(value);
}

function cleanKnowledgeNames(list) {
  return (list || []).map(name => String(name || '').trim()).filter(value =>
    value && !['待判断考察点', '待判断', '未知', '未分类'].includes(value) && isStandardKnowledgePoint(value)
  );
}

function renderStudentListItems(students) {
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(students.length / pageSize));
  studentListPage = Math.min(Math.max(1, studentListPage), totalPages);
  const pageStudents = students.slice((studentListPage - 1) * pageSize, studentListPage * pageSize);
  const placeholderRow = `
    <div class="student-item placeholder" aria-hidden="true">
      <div class="student-avatar"></div>
      <div class="student-info">
        <div class="student-item-main">
          <div class="student-name-status"><div class="student-name">占位学生</div></div>
          <div class="student-rate">0错题</div>
        </div>
        <div class="student-weakline">暂无明显薄弱点</div>
      </div>
    </div>
  `;
  if (!students.length) {
    return `
      <div class="student-item empty">
        <div class="student-info">
          <div class="student-name">没有匹配的学生</div>
          <div class="student-weakline">可以换个关键词或筛选条件</div>
        </div>
      </div>
      ${Array.from({ length: pageSize - 1 }).map(() => placeholderRow).join('')}
    `;
  }
  const rows = pageStudents.map(s => {
    const weakPoints = getStudentActualWeakPoints(s);
    return `
    <div class="student-item ${currentStudent && s.id === currentStudent.id ? 'active' : ''}" onclick="selectStudent(${s.id})">
      ${studentDeleteMode ? `<button class="student-delete-x" title="删除学生档案" onclick="deleteStudentArchive(event, ${s.id})">×</button>` : ''}
      ${avatarHtml(s)}
      <div class="student-info">
        <div class="student-item-main">
          <div class="student-name-status">
            <div class="student-name">${s.name}</div>
            ${statusLabel(s.status)}
          </div>
          <div class="student-rate ${(s.recentErrors || []).length > 1 ? 'low' : ''}">${(s.recentErrors || []).length}错题</div>
        </div>
        <div class="student-weakline">${weakPoints.join('、') || '暂无明显薄弱点'}</div>
      </div>
    </div>
  `;
  });
  const placeholders = Array.from({ length: Math.max(0, pageSize - pageStudents.length) }).map(() => placeholderRow);
  return rows.concat(placeholders).join('');
}

function renderStudentPagination(total) {
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  studentListPage = Math.min(Math.max(1, studentListPage), totalPages);
  return `
    <div class="student-list-pagination">
      <button class="student-page-btn" onclick="setStudentListPage(${studentListPage - 1})" ${studentListPage <= 1 ? 'disabled' : ''}>上一页</button>
      <div class="student-page-info">${studentListPage} / ${totalPages}</div>
      <button class="student-page-btn" onclick="setStudentListPage(${studentListPage + 1})" ${studentListPage >= totalPages ? 'disabled' : ''}>下一页</button>
    </div>
  `;
}

function setStudentListPage(page) {
  studentListPage = page;
  refreshStudentList();
}

function renderStudentDetail(s) {
  if (!s) return '<div class="card"><div class="text-muted text-sm">暂无学生数据</div></div>';
  return `
    <div>
      ${renderStudentInfoTab(s)}
    </div>
  `;
}

async function loadStudentProfile(studentId, force = false) {
  if (!studentId) return;
  if (studentProfiles[studentId] && !force && !studentProfiles[studentId].error) return;
  if (studentProfileLoading.has(studentId) && !force) return;
  studentProfileLoading.add(studentId);
  if (force) {
    studentProfiles[studentId] = null;
    const loadingEl = document.getElementById(`student-sediment-${studentId}`);
    const student = mockData.students.find(st => st.id === studentId);
    if (loadingEl && student) loadingEl.outerHTML = renderMistakeSedimentCard(student);
  }
  try {
    const data = await api.get('/students/' + studentId + '/learning-profile');
    if (data.error) throw new Error(data.error);
    studentProfiles[studentId] = data;
  } catch (err) {
    studentProfiles[studentId] = { error: err.message || '读取失败' };
  } finally {
    studentProfileLoading.delete(studentId);
  }
  const student = mockData.students.find(st => st.id === studentId);
  const el = document.getElementById(`student-sediment-${studentId}`);
  const detailEl = document.getElementById('student-detail');
  if (currentTab === 'students' && currentStudent?.id === studentId && student && detailEl) {
    detailEl.innerHTML = renderStudentDetail(student);
  } else if (student && el) {
    el.outerHTML = renderMistakeSedimentCard(student);
  }
  const list = document.getElementById('student-list-items');
  if (currentTab === 'students' && list) list.innerHTML = renderStudentListItems(getFilteredStudents());
  if (currentTab === 'dashboard') renderDashboard();
  if (currentTab === 'mistakes' && mistakeSession.studentId === studentId) {
    renderMistakes();
    refreshMistakeMain();
  }
}

async function refreshStudentProfile(studentId) {
  if (!studentId) return;
  try {
    const students = await api.get('/students');
    mockData.students = (students || []).map(withColor);
    currentStudent = mockData.students.find(st => st.id === studentId) || currentStudent || mockData.students[0] || null;
    if (!currentStudent) {
      renderStudents();
      showToast('暂无学生档案可刷新');
      return;
    }
    delete studentProfiles[studentId];
    const detailEl = document.getElementById('student-detail');
    if (detailEl) detailEl.innerHTML = renderStudentDetail(currentStudent);
    await loadStudentProfile(studentId, true);
    refreshStudentList();
    showToast('学生档案已刷新');
  } catch (err) {
    showToast('刷新失败：' + (err.message || '请稍后重试'));
  }
}

function formatShortDate(value) {
  if (!value) return '最近';
  const text = String(value);
  const m = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return text.slice(0, 10);
  return `${m[2]}/${m[3]}`;
}

function summarizeCause(cause) {
  if (!Array.isArray(cause)) return '';
  return cause.map(item => {
    if (typeof item === 'string') return item;
    return item?.knowledgePoint || item?.name || item?.reason || '';
  }).filter(Boolean).join('、');
}

function getTopCause(s) {
  return [getStudentActualWeakPoints(s)[0] || '暂无薄弱分类', 0];
}

function getStudentNextAction(s) {
  const weak = getStudentActualWeakPoints(s)[0] || '综合能力';
  if (s.status === 'high-risk') return `课前用 2 道${weak}题快速诊断，课后确认薄弱分类变化。`;
  if ((s.recentErrors || []).length > 1) return `优先复盘错题分类，再安排 3 道${weak}同类题。`;
  if (s.status === 'follow-up') return `下次课保留 8 分钟复盘${weak}，确认是否已稳定。`;
  if (s.status === 'progress') return `保持短练节奏，逐步提升${weak}题目难度。`;
  return `基础状态稳定，可加入 1 道拓展题保持挑战感。`;
}

function getStudentWeakDistributionRows(s) {
  const colors = ['#e87f74', '#e8b26a', '#7fb8e8', '#8bc79e', '#d8d2c5'];
  const profileStats = (studentProfiles[s.id]?.knowledgeStats || [])
    .filter(item => item && item.name && Number(item.count || 0) > 0);
  if (profileStats.length) {
    const total = profileStats.reduce((sum, item) => sum + Number(item.count || 0), 0) || 1;
    return profileStats.slice(0, 5).map((item, index) => ({
      name: item.name,
      percent: Math.max(1, Math.round(Number(item.count || 0) / total * 100)),
      count: Number(item.count || 0),
      color: colors[index % colors.length]
    }));
  }
  const weakPoints = getStudentActualWeakPoints(s);
  const each = weakPoints.length ? Math.round(100 / weakPoints.length) : 0;
  return weakPoints.slice(0, 5).map((name, index) => ({
    name,
    percent: index === weakPoints.length - 1 ? Math.max(1, 100 - each * (weakPoints.length - 1)) : each,
    count: null,
    color: colors[index % colors.length]
  }));
}

function getWeakDistributionSegments(rows) {
  let start = 0;
  return rows.map(row => {
    const deg = Math.max(1, Math.round((row.percent || 0) / 100 * 360));
    const segment = `${row.color} ${start}deg ${Math.min(360, start + deg)}deg`;
    start += deg;
    return segment;
  }).join(', ');
}

function renderStudentInfoTab(s) {
  const weakRows = getStudentWeakDistributionRows(s);
  const weakSegments = getWeakDistributionSegments(weakRows);
  const newWeak = studentProfiles[s.id]?.newWeakPoints || [];
  kmSelectedStudent = s.id;
  ensureFocusedNodeForStudent(s);
  return `
    <div class="student-profile-stack">
      <div class="card student-summary mb-16">
        <div class="student-summary-head">
          <div class="student-identity">
            ${avatarHtml(s, 52)}
            <div>
              <div class="student-title">${s.name}</div>
              <div class="text-muted">${s.grade} · ${statusLabel(s.status)} · 近期错题 ${(s.recentErrors || []).length} 道 · 薄弱点 ${getStudentActualWeakPoints(s).length} 个</div>
            </div>
          </div>
          <div class="student-actions">
            <button class="btn btn-primary btn-sm" onclick="goToStudent(${s.id}, true)">📄 出题</button>
            <button class="btn btn-secondary btn-sm" onclick="refreshStudentProfile(${s.id})">↻ 刷新</button>
          </div>
        </div>
        <div class="student-overview-body">
          <div class="student-weak-left-stack">
            <div class="student-weak-count-card">
              <div class="sediment-label">薄弱点数量</div>
              <div class="sediment-value">${weakRows.length}</div>
            </div>
            <div class="student-new-weak-card">
              <div class="sediment-label">新增薄弱点</div>
              <div>
                ${newWeak.length
                  ? newWeak.map(w => `<span class="tag weak">${escapeHtml(w)}</span>`).join('')
                  : '<span class="tag neutral">暂无新增，继续观察</span>'}
              </div>
            </div>
          </div>
          <div class="student-weak-distribution">
            <div class="note-label" style="margin-bottom:10px">薄弱点分布</div>
            ${weakRows.length ? `
              <div class="student-donut-wrap">
                <div class="student-donut-chart" style="background:conic-gradient(${weakSegments})"></div>
                <div class="student-donut-legend">
                  ${weakRows.map(item => `
                    <div class="donut-row">
                      <span class="donut-dot" style="background:${item.color}"></span>
                      <span class="donut-label">${escapeHtml(item.name)}</span>
                      <span class="donut-percent">${item.percent}%</span>
                      <span class="donut-count">${item.count ? `(${item.count}道)` : ''}</span>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : '<div class="sediment-empty" style="padding:12px 14px">暂无薄弱点记录，完成错题分析后会自动出现。</div>'}
          </div>
        </div>
      </div>
      ${renderMistakeSedimentCard(s)}
    </div>
  `;
}

function renderMistakeSedimentCard(s) {
  const profile = studentProfiles[s.id];
  if (!profile) {
    return `
      <div class="card mb-16" id="student-sediment-${s.id}">
        <div class="sediment-head">
          <div>
            <div class="card-title" style="margin-bottom:2px">错题沉淀</div>
            <div class="text-muted text-sm">正在整理该学生的错题记录和新增薄弱点</div>
          </div>
        </div>
        <div class="loading-wrap"><div class="spinner"></div>加载学情画像...</div>
      </div>
    `;
  }
  if (profile.error) {
    return `
      <div class="card mb-16" id="student-sediment-${s.id}">
        <div class="sediment-head">
          <div>
            <div class="card-title" style="margin-bottom:2px">错题沉淀</div>
            <div class="text-muted text-sm">暂时无法读取后端错题画像</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="loadStudentProfile(${s.id}, true)">重试</button>
        </div>
        <div class="sediment-empty">${profile.error}</div>
      </div>
    `;
  }
  const stats = profile.knowledgeStats || [];
  const comparison = profile.comparison || {};
  const recentMistakes = comparison.recentTotal || 0;
  const activeMistakes = profile.activeMistakes ?? Math.max(0, (profile.totalMistakes || 0) - (profile.masteredMistakes || 0));
  const masteredMistakes = profile.masteredMistakes || 0;
  return `
    <div class="card mb-16" id="student-sediment-${s.id}">
      <div class="sediment-head">
        <div>
          <div class="card-title" style="margin-bottom:2px">错题沉淀</div>
          <div class="text-muted text-sm">错题记录与掌握状态</div>
        </div>
      </div>
      <div>
        <div class="sediment-metrics" style="grid-template-columns:repeat(3, minmax(0, 1fr))">
          <div class="sediment-metric">
            <div class="sediment-metric-main">
              <div class="sediment-label">近7天新增错题</div>
              <div class="sediment-value">${recentMistakes}</div>
            </div>
            <button class="sediment-metric-link" onclick="showStudentHistoryModal(${s.id}, 'recent7')">查看近7天错题</button>
          </div>
          <div class="sediment-metric">
            <div class="sediment-metric-main">
              <div class="sediment-label">历史错题</div>
              <div class="sediment-value">${activeMistakes}</div>
            </div>
            <button class="sediment-metric-link" onclick="showStudentHistoryModal(${s.id}, 'history')">查看历史错题</button>
          </div>
          <div class="sediment-metric">
            <div class="sediment-metric-main">
              <div class="sediment-label">已掌握错题</div>
              <div class="sediment-value">${masteredMistakes}</div>
            </div>
            <button class="sediment-metric-link" onclick="showStudentHistoryModal(${s.id}, 'mastered')">查看已掌握错题</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderStudentHistoryCompare(comparison) {
  if (!comparison || (!comparison.recentTotal && !comparison.previousTotal && !(comparison.recentTrend || []).length)) return '';
  const delta = Number(comparison.deltaTotal || 0);
  const trend = comparison.recentTrend || [];
  const repeated = comparison.repeatedWeakPoints || [];
  return `
    <div class="sediment-trend">
      <div class="sediment-trend-card">
        <div class="sediment-trend-title">近 7 天变化</div>
        <div class="sediment-trend-main ${delta > 0 ? 'up' : delta < 0 ? 'down' : ''}">
          ${delta > 0 ? '+' : ''}${delta} 道
        </div>
        <div class="text-muted text-sm" style="margin-top:5px">近 7 天 ${comparison.recentTotal || 0} 道，前 7 天 ${comparison.previousTotal || 0} 道</div>
        ${trend.length ? `
          <div class="sediment-mini-list">
            ${trend.slice(0, 3).map(item => `
              <div class="sediment-mini-row">
                <span class="sediment-mini-name">${escapeHtml(item.name)}</span>
                <span class="sediment-delta ${item.delta > 0 ? 'up' : item.delta < 0 ? 'down' : ''}">${item.isNew ? '新增' : `${item.delta > 0 ? '+' : ''}${item.delta}`}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      <div class="sediment-trend-card">
        <div class="sediment-trend-title">反复薄弱点</div>
        ${repeated.length ? `
          <div class="sediment-mini-list" style="margin-top:0">
            ${repeated.slice(0, 4).map(item => `
              <div class="sediment-mini-row">
                <span class="sediment-mini-name">${escapeHtml(item.name)}</span>
                <span class="sediment-delta up">${item.count} 道</span>
              </div>
            `).join('')}
          </div>
        ` : '<div class="text-muted text-sm">暂无反复出现的薄弱点</div>'}
      </div>
    </div>
  `;
}

function renderStudentHistoryContent(student, profile) {
  if (!profile || profile.error) {
    return '<div class="sediment-empty">暂时无法读取该学生的错题变化。</div>';
  }
  const recentSeven = profile.recentSevenRecords || [];
  const active = profile.activeRecords || profile.recentRecords || [];
  const mastered = profile.masteredRecords || [];
  const historyHtml = renderStudentHistoryCompare(profile.comparison || {});
  if (!['recent7', 'history', 'mastered'].includes(studentHistoryTab)) studentHistoryTab = 'recent7';
  const renderRecords = (records, emptyText, action) => records.length ? `
    <div class="sediment-records" style="margin-top:0">
      ${records.map(item => `
        <div class="sediment-record with-action">
          <div class="sediment-date">${formatShortDate(item.masteredAt || item.createdAt)}</div>
          <div>
            <div class="student-weakline" style="white-space:normal;margin-bottom:3px">${escapeHtml(cleanKnowledgeNames([item.knowledgePoint])[0] || '考察点待确认')}</div>
            <div class="sediment-question">${escapeHtml(item.question || summarizeCause(item.cause) || '作业错题记录')}</div>
          </div>
          ${action === 'remove'
            ? `<button class="sediment-record-action danger" onclick="markMistakeMastered(${student.id}, ${item.id})">移除错题</button>`
            : action === 'restore'
              ? `<button class="sediment-record-action" onclick="restoreMistakeFollowUp(${student.id}, ${item.id})">恢复跟进</button>`
              : '<span></span>'}
        </div>
      `).join('')}
    </div>
  ` : `<div class="sediment-empty">${emptyText}</div>`;
  return `
    <div class="modal-tabs">
      <button class="modal-tab ${studentHistoryTab === 'recent7' ? 'active' : ''}" onclick="switchStudentHistoryTab(${student.id}, 'recent7')">近7天错题</button>
      <button class="modal-tab ${studentHistoryTab === 'history' ? 'active' : ''}" onclick="switchStudentHistoryTab(${student.id}, 'history')">历史错题</button>
      <button class="modal-tab ${studentHistoryTab === 'mastered' ? 'active' : ''}" onclick="switchStudentHistoryTab(${student.id}, 'mastered')">已掌握错题</button>
    </div>
    ${studentHistoryTab === 'recent7' ? `
      <div class="mb-16">
        <div class="note-label" style="margin-bottom:10px">近7天错题</div>
        ${renderRecords(recentSeven, '近7天暂无新增错题。', 'remove')}
      </div>
      ${historyHtml ? `
        <div>
          <div class="note-label" style="margin-bottom:10px">变化趋势</div>
          ${historyHtml}
        </div>
      ` : ''}
    ` : studentHistoryTab === 'history' ? `
      <div>
        <div class="note-label" style="margin-bottom:10px">历史错题</div>
        ${renderRecords(active, '暂无需要继续跟进的历史错题。', 'remove')}
      </div>
    ` : `
      <div>
        <div class="note-label" style="margin-bottom:10px">历史错题（已移除）</div>
        ${renderRecords(mastered, '暂无已掌握的历史错题。', 'restore')}
      </div>
    `}
  `;
}

function showStudentHistoryModal(studentId, tab) {
  const student = mockData.students.find(s => s.id === studentId);
  if (!student) return;
  const profile = studentProfiles[studentId];
  if (tab) studentHistoryTab = tab;
  else if (!document.getElementById('student-history-modal')?.classList.contains('show')) studentHistoryTab = 'recent7';
  document.getElementById('student-history-title').textContent = `${student.name} · 最近错题和变化`;
  document.getElementById('student-history-desc').textContent = `累计 ${profile?.totalMistakes || 0} 道错题，涉及 ${(profile?.knowledgeStats || []).length} 个考察点。`;
  document.getElementById('student-history-modal-content').innerHTML = renderStudentHistoryContent(student, profile);
  toggleStudentHistoryModal(true);
}

function switchStudentHistoryTab(studentId, tab) {
  studentHistoryTab = tab;
  showStudentHistoryModal(studentId);
}

async function updateMistakeRecordStatus(studentId, mistakeId, status) {
  try {
    await api.put(`/mistakes/${mistakeId}/status`, { status });
    delete studentProfiles[studentId];
    await loadStudentProfile(studentId, true);
    showStudentHistoryModal(studentId);
    const message = status === 'mastered'
      ? '已移出当前错题，后续出题不再按该错题薄弱点推荐'
      : '已恢复跟进，后续会重新计入薄弱点判断';
    showToast(message);
  } catch (err) {
    showToast('操作失败：' + err.message);
  }
}

function markMistakeMastered(studentId, mistakeId) {
  updateMistakeRecordStatus(studentId, mistakeId, 'mastered');
}

function restoreMistakeFollowUp(studentId, mistakeId) {
  updateMistakeRecordStatus(studentId, mistakeId, 'active');
}

function toggleStudentHistoryModal(show) {
  document.getElementById('student-history-modal')?.classList.toggle('show', !!show);
}

function selectStudent(id) {
  currentStudent = mockData.students.find(s => s.id === id);
  kmFullMapOpen = false;
  document.getElementById('student-detail').innerHTML = renderStudentDetail(currentStudent);
  loadStudentProfile(id);
  document.querySelectorAll('.student-item').forEach(el => el.classList.remove('active'));
  if (event?.currentTarget) event.currentTarget.classList.add('active');
}

function refreshStudentList() {
  const filtered = getFilteredStudents();
  const list = document.getElementById('student-list-items');
  if (list) list.innerHTML = renderStudentListItems(filtered);
  const pagination = document.getElementById('student-list-pagination');
  if (pagination) pagination.innerHTML = renderStudentPagination(filtered.length);
  document.querySelectorAll('.student-filter-btn').forEach(btn => btn.classList.remove('active'));
  const activeBtn = document.querySelector(`.student-filter-btn[onclick*="'${currentStudentFilter}'"]`);
  if (activeBtn) activeBtn.classList.add('active');
}

function filterStudents() {
  studentListPage = 1;
  refreshStudentList();
}

function setStudentFilter(filter) {
  currentStudentFilter = filter || 'all';
  studentListPage = 1;
  refreshStudentList();
}

function toggleStudentDeleteMode() {
  studentDeleteMode = !studentDeleteMode;
  renderStudents();
}

async function deleteStudentArchive(event, studentId) {
  event?.stopPropagation();
  const student = mockData.students.find(s => s.id === studentId);
  if (!student) return;
  const ok = window.confirm(`确定删除「${student.name}」的学生档案吗？\n\n删除后无法恢复，相关错题记录、作业记录和知识点状态也会一并删除。`);
  if (!ok) return;
  try {
    const result = await api.delete('/students/' + studentId);
    if (result?.error) throw new Error(result.error);
    delete studentProfiles[studentId];
    delete studentNodeStatus[studentId];
    mockData.students = mockData.students.filter(s => s.id !== studentId);
    if (currentStudent?.id === studentId) {
      currentStudent = mockData.students[0] || null;
      kmSelectedStudent = currentStudent?.id || null;
    }
    const filtered = getFilteredStudents();
    const totalPages = Math.max(1, Math.ceil(filtered.length / 7));
    studentListPage = Math.min(studentListPage, totalPages);
    renderStudents();
    showToast(`已删除学生档案：${student.name}`);
  } catch (err) {
    showToast('删除失败：' + (err.message || '请稍后重试'));
  }
}

function filterByStatus(status) {
  setStudentFilter(status || 'all');
}

function openStudentCreateModal() {
  document.getElementById('student-create-name').value = '';
  document.getElementById('student-create-grade').value = '三年级';
  document.getElementById('student-create-status').value = 'stable';
  document.getElementById('student-create-notes').value = '';
  toggleStudentCreateModal(true);
  setTimeout(() => document.getElementById('student-create-name')?.focus(), 50);
}

function toggleStudentCreateModal(show) {
  document.getElementById('student-create-modal')?.classList.toggle('show', !!show);
}

async function createStudent() {
  const name = document.getElementById('student-create-name').value.trim();
  const grade = document.getElementById('student-create-grade').value.trim() || '三年级';
  const status = document.getElementById('student-create-status').value || 'stable';
  const notes = document.getElementById('student-create-notes').value.trim();
  if (!name) {
    showToast('请填写学生姓名');
    return;
  }
  const btn = document.getElementById('student-create-submit');
  if (btn) { btn.disabled = true; btn.textContent = '添加中...'; }
  try {
    const data = await api.post('/students', {
      name,
      grade,
      status,
      weakPoints: [],
      errorCauses: {},
      homeworkRate: 100,
      recentErrors: [],
      notes,
      suggestion: ''
    });
    const students = await api.get('/students');
    mockData.students = students.map(withColor);
    studentProfiles = {};
    currentStudent = mockData.students.find(s => s.id === Number(data.id)) || mockData.students[mockData.students.length - 1] || currentStudent;
    currentStudentFilter = 'all';
    studentListPage = 1;
    toggleStudentCreateModal(false);
    renderStudents();
    showToast(`已添加学生：${name}`);
  } catch (err) {
    showToast('添加失败：' + err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '添加'; }
  }
}

// ============================================================
// KNOWLEDGE MAP
// ============================================================

// Per-student node status: { nodeId: 'mastered'|'weak'|'partial'|'untested' }
let studentNodeStatus = {
  1: { 'frac-concept':'partial','frac-add':'weak','frac-app':'weak','frac-compare':'partial','int-add-multi':'mastered','int-add-carry':'mastered','mul-vertical':'mastered','div-basic':'mastered','div-remainder':'mastered','div-vertical':'partial','length-basic':'mastered','length-km':'partial','weight-basic':'weak','time-calc':'partial','area':'partial','area-formula':'untested','wp-model':'weak','wp-2step-basic':'partial' },
  2: { 'mul-table':'mastered','mul-vertical':'partial','div-basic':'mastered','div-remainder':'mastered','wp-add':'mastered','wp-mul':'mastered','wp-2step-basic':'partial','wp-model':'weak','int-add-multi':'mastered','frac-concept':'untested','area':'partial','perimeter':'mastered' },
  3: { 'time-clock':'mastered','time-calc':'partial','time-cross':'weak','int-add-multi':'mastered','mul-table':'mastered','mul-vertical':'mastered','div-basic':'mastered','frac-concept':'untested','area':'partial','perimeter':'mastered' },
  4: { 'int-add-basic':'mastered','int-add-carry':'mastered','int-add-multi':'mastered','mul-table':'mastered','mul-vertical':'mastered','div-basic':'mastered','div-remainder':'mastered','div-vertical':'mastered','frac-concept':'mastered','frac-compare':'mastered','frac-add':'mastered','frac-app':'partial','dec-concept':'mastered','dec-add':'mastered','length-basic':'mastered','weight-basic':'mastered','time-calc':'mastered','perimeter':'mastered','area':'mastered','area-formula':'mastered','wp-add':'mastered','wp-mul':'mastered','wp-2step-basic':'mastered','wp-model':'mastered' },
  5: { 'int-add-basic':'mastered','int-add-carry':'partial','mul-table':'partial','mul-vertical':'untested','div-basic':'weak','div-remainder':'weak','div-vertical':'weak','frac-concept':'untested','area':'untested','perimeter':'partial','wp-add':'partial','wp-mul':'weak','wp-2step-basic':'untested','wp-model':'weak' },
  6: { 'int-add-multi':'mastered','mul-table':'mastered','mul-vertical':'mastered','div-basic':'mastered','frac-concept':'partial','perimeter':'partial','area':'weak','area-formula':'weak','shape-basic':'mastered','solid-basic':'partial','wp-add':'mastered','wp-mul':'mastered','wp-2step-basic':'partial','wp-model':'partial' },
  7: { 'int-add-multi':'mastered','mul-table':'mastered','mul-vertical':'mastered','div-basic':'mastered','dec-concept':'mastered','dec-add':'partial','length-basic':'mastered','weight-basic':'mastered','time-calc':'mastered','perimeter':'mastered','area':'mastered','wp-add':'mastered','wp-mul':'mastered' },
  8: { 'int-add-multi':'mastered','mul-table':'mastered','mul-vertical':'mastered','div-basic':'mastered','div-remainder':'mastered','frac-concept':'mastered','frac-add':'mastered','dec-add':'mastered','length-basic':'mastered','weight-basic':'mastered','time-calc':'mastered','perimeter':'mastered','area':'mastered','area-formula':'mastered','wp-add':'mastered','wp-mul':'mastered','wp-2step-basic':'mastered','wp-model':'mastered' }
};

function renderKMTree() {
  return mockData.knowledgeTree.map((domain, di) => {
    const allNodes = getAllNodes(domain);
    const weakCount = allNodes.filter(n => getNodeStatus(n.id) === 'weak').length;
    const masteredCount = allNodes.filter(n => getNodeStatus(n.id) === 'mastered').length;
    const isOpen = di === 0 || weakCount > 0;
    return `
      <div class="km-domain">
        <div class="km-domain-header" onclick="toggleDomain(this)">
          <span class="km-domain-icon">${domain.icon}</span>
          <span class="km-domain-label">${domain.label}</span>
          ${weakCount > 0 ? `<span class="pill red" style="font-size:11px">${weakCount} 个薄弱</span>` : ''}
          <span class="km-domain-stats">${masteredCount}/${allNodes.length} 已掌握</span>
          <span class="km-domain-toggle ${isOpen ? 'open' : ''}">▶</span>
        </div>
        <div class="km-domain-body ${isOpen ? 'open' : ''}">
          ${domain.children.map(cat => `
            <div class="km-category">
              <div class="km-category-label">${cat.label}</div>
              <div class="km-nodes">
                ${cat.children.map(node => renderKMNode(node)).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function getAllNodes(domain) {
  const nodes = [];
  domain.children.forEach(cat => cat.children.forEach(n => nodes.push(n)));
  return nodes;
}

function getAllKnowledgeNodes() {
  return mockData.knowledgeTree.flatMap(domain => getAllNodes(domain));
}

function getAllKnowledgeSections() {
  return mockData.knowledgeTree.flatMap(domain =>
    domain.children.map(cat => ({
      id: `${domain.id}:${cat.label}`,
      label: cat.label,
      domainLabel: domain.label,
      nodes: cat.children
    }))
  );
}

function getKnowledgeCategoryByPoint(point) {
  const value = String(point || '').trim();
  for (const domain of mockData.knowledgeTree || []) {
    for (const cat of domain.children || []) {
      if ((cat.children || []).some(node => node.label === value)) {
        return domain.label;
      }
    }
  }
  return '';
}

function getKnowledgeCategoryOptions() {
  return (mockData.knowledgeTree || []).map(domain => domain.label);
}

function getKnowledgePointsByCategory(category) {
  const domain = (mockData.knowledgeTree || []).find(item => item.label === category);
  return domain ? (domain.children || []).flatMap(cat => (cat.children || []).map(node => node.label)) : [];
}

function renderKnowledgeCategoryPill(point, questionId = null) {
  const category = getKnowledgeCategoryByPoint(point);
  const click = questionId ? ` onclick="openQuestionCategoryEditor(${questionId}, 'category')"` : '';
  return category
    ? `<button type="button" class="question-category-pill question-category-edit-trigger"${click}>${escapeHtml(category)}</button>`
    : `<button type="button" class="question-category-pill question-category-edit-trigger pending"${click}>待判断</button>`;
}

function renderKnowledgePointPill(point, questionId = null) {
  const click = questionId ? ` onclick="openQuestionCategoryEditor(${questionId}, 'point')"` : '';
  return isStandardKnowledgePoint(point)
    ? `<button type="button" class="question-category-pill question-category-edit-trigger"${click}>${escapeHtml(point)}</button>`
    : `<button type="button" class="question-category-pill question-category-edit-trigger pending"${click}>待判断考察点</button>`;
}

function qCategorySelectHtml(q) {
  const currentCategory = getKnowledgeCategoryByPoint(q.knowledgePoint);
  return `
    <select id="question-category-editor-${q.id}" class="question-edit-select" onchange="updateQuestionCategory(${q.id}, this.value)" onblur="closeQuestionCategoryEditorSoon()" aria-label="一级分类">
      <option value="" ${currentCategory ? '' : 'selected'}>待判断</option>
      ${getKnowledgeCategoryOptions().map(category => `<option value="${escapeHtml(category)}" ${currentCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
    </select>
  `;
}

function qPointSelectHtml(q) {
  const currentCategory = getKnowledgeCategoryByPoint(q.knowledgePoint);
  const options = currentCategory ? getKnowledgePointsByCategory(currentCategory) : qKnowledgePointOptions();
  return `
    <select id="question-point-editor-${q.id}" class="question-edit-select" onchange="updateQuestionField(${q.id}, 'knowledgePoint', this.value)" onblur="closeQuestionCategoryEditorSoon()" aria-label="二级分类">
      <option value="" ${isStandardKnowledgePoint(q.knowledgePoint) ? '' : 'selected'}>待判断考察点</option>
      ${options.map(point => `<option value="${escapeHtml(point)}" ${q.knowledgePoint === point ? 'selected' : ''}>${escapeHtml(point)}</option>`).join('')}
    </select>
  `;
}

function findKnowledgeSection(sectionId) {
  return getAllKnowledgeSections().find(section => section.id === sectionId) || null;
}

function findKnowledgeNode(nodeId) {
  return getAllKnowledgeNodes().find(node => node.id === nodeId) || null;
}

function findNodeByLabel(label) {
  return getAllKnowledgeNodes().find(node => node.label === label) || null;
}

function ensureFocusedNodeForStudent(s) {
  const currentStatus = kmFocusedNode ? (studentNodeStatus[s.id] || {})[kmFocusedNode.id] : null;
  if (kmFocusedNode && currentStatus) return;
  const weakNode = getStudentActualWeakPoints(s).map(findNodeByLabel).find(Boolean);
  if (weakNode) {
    kmFocusedNode = weakNode;
    return;
  }
  const statusMap = studentNodeStatus[s.id] || {};
  const firstTracked = getAllKnowledgeNodes().find(node => statusMap[node.id]);
  kmFocusedNode = firstTracked || getAllKnowledgeNodes()[0] || null;
}

function getStudentKeyNodes(s) {
  const statusMap = studentNodeStatus[s.id] || {};
  const fromWeakPoints = getStudentActualWeakPoints(s).map(findNodeByLabel).filter(Boolean);
  const fromStatus = getAllKnowledgeNodes().filter(node => ['weak', 'partial'].includes(statusMap[node.id]));
  const fromTracked = getAllKnowledgeNodes().filter(node => statusMap[node.id]).slice(0, 5);
  const seen = new Set();
  return [...fromWeakPoints, ...fromStatus, ...fromTracked].filter(node => {
    if (!node || seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  }).slice(0, 5);
}

function renderKMSummary(s) {
  const nodes = getStudentKeyNodes(s);
  if (!nodes.length) return '<div class="text-muted text-sm">暂无关键知识点记录，可展开完整图谱进行标记。</div>';
  return `
    <div class="km-summary">
      ${nodes.map(node => {
        const status = (studentNodeStatus[s.id] || {})[node.id] || 'untested';
        return `
          <button class="km-summary-node ${kmFocusedNode?.id === node.id ? 'active' : ''}" onclick="selectKMFocus(${s.id}, '${node.id}')">
            ${node.label}
            <span class="km-summary-status ${status}">${statusText(status)}</span>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function getNodeStatus(nodeId) {
  if (kmSelectedStudent === null) {
    // Class view: show worst status across all students
    const statuses = mockData.students.map(s => (studentNodeStatus[s.id] || {})[nodeId] || 'untested');
    if (statuses.includes('weak')) return 'weak';
    if (statuses.includes('partial')) return 'partial';
    if (statuses.every(s => s === 'mastered')) return 'mastered';
    return 'untested';
  }
  return (studentNodeStatus[kmSelectedStudent] || {})[nodeId] || 'untested';
}

function getNodeStudentCount(nodeId, status) {
  return mockData.students.filter(s => ((studentNodeStatus[s.id] || {})[nodeId] || 'untested') === status).length;
}

function statusText(status) {
  return { mastered: '已掌握', partial: '部分掌握', weak: '薄弱', untested: '未测试' }[status] || '未测试';
}

function getRelatedErrors(s, node) {
  if (!node) return [];
  const tokens = getKnowledgeTokens(node.label);
  const direct = (s.recentErrors || []).filter(e => tokens.some(t => e.includes(t)));
  return (direct.length ? direct : (s.recentErrors || []).slice(0, 2)).slice(0, 3);
}

function getRelatedQuestions(node) {
  if (!node) return [];
  const tokens = getKnowledgeTokens(node.label);
  return (mockData.questions || [])
    .filter(q => q.status === 'approved' && tokens.some(t => (q.knowledgePoint || '').includes(t) || (q.content || '').includes(t)))
    .slice(0, 3);
}

function getKnowledgeTokens(label = '') {
  const tokens = [label, ...label.split(/[与和、\s]/).filter(t => t.length >= 2)];
  ['分数', '小数', '应用题', '计算', '面积', '周长', '时间', '单位', '除法', '乘法'].forEach(t => {
    if (label.includes(t)) tokens.push(t);
  });
  return [...new Set(tokens)];
}

function getNodeActionSuggestion(status, nodeLabel) {
  if (status === 'weak') return `先安排 2 道${nodeLabel}基础题，再补 1 道同类变式题。`;
  if (status === 'partial') return `用限时短练确认${nodeLabel}是否稳定，重点看过程书写。`;
  if (status === 'mastered') return `可以加入 1 道${nodeLabel}提升题，避免重复刷基础题。`;
  return `建议先做 1 道${nodeLabel}诊断题，确认学生当前掌握状态。`;
}

function renderKMFocusPanel(s) {
  if (!kmFocusedNode) {
    return '<div class="km-focus-panel"><div class="text-muted text-sm">点击一个知识点查看处理建议</div></div>';
  }
  const status = (studentNodeStatus[s.id] || {})[kmFocusedNode.id] || 'untested';
  const relatedErrors = getRelatedErrors(s, kmFocusedNode);
  const relatedQuestions = getRelatedQuestions(kmFocusedNode);
  return `
    <div class="km-focus-panel">
      <div class="km-focus-head">
        <div>
          <div class="km-focus-title">${kmFocusedNode.label}</div>
          <div class="text-muted text-sm">当前状态：${statusText(status)} · ${getNodeActionSuggestion(status, kmFocusedNode.label)}</div>
        </div>
        <div class="flex gap-8" style="flex-wrap:wrap;justify-content:flex-end">
          <button class="btn btn-primary btn-sm" onclick="goHomeworkForNode(${s.id}, '${kmFocusedNode.id}')">生成专项练习</button>
          <button class="btn btn-secondary btn-sm" onclick="setNodeStatus(${s.id}, '${kmFocusedNode.id}', 'weak')">标为薄弱</button>
          <button class="btn btn-secondary btn-sm" onclick="setNodeStatus(${s.id}, '${kmFocusedNode.id}', 'mastered')">标为已掌握</button>
        </div>
      </div>
      <div class="km-focus-grid">
        <div class="km-focus-box">
          <div class="note-label" style="margin-bottom:8px">相关错题</div>
          ${relatedErrors.length ? `<ul class="km-focus-list">${relatedErrors.map(e => `<li>${e}</li>`).join('')}</ul>` : '<div class="text-muted text-sm">暂无相关错题记录</div>'}
        </div>
        <div class="km-focus-box">
          <div class="note-label" style="margin-bottom:8px">题库可用题</div>
          ${relatedQuestions.length ? `<ul class="km-focus-list">${relatedQuestions.map(q => `<li>${q.content}</li>`).join('')}</ul>` : '<div class="text-muted text-sm">题库暂无同知识点题目，可先生成诊断题</div>'}
        </div>
        <div class="km-focus-box">
          <div class="note-label" style="margin-bottom:8px">推荐教学动作</div>
          <ul class="km-focus-list">
            <li>课前 3 分钟口头复述知识点</li>
            <li>课堂做 1 道例题 + 1 道变式题</li>
            <li>课后记录是否仍出现同类错题</li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

function renderKMNode(node) {
  const status = getNodeStatus(node.id);
  let tooltip = '';
  if (kmSelectedStudent === null) {
    const weakStudents = mockData.students.filter(s => ((studentNodeStatus[s.id] || {})[node.id] || 'untested') === 'weak').map(s => s.name);
    tooltip = weakStudents.length > 0 ? `薄弱：${weakStudents.join('、')}` : statusText(status);
  } else {
    tooltip = statusText(status);
  }
  return `
    <div class="km-node ${status} ${kmFocusedNode?.id === node.id ? 'selected' : ''}" onclick="kmNodeClick('${node.id}', '${node.label}')">
      <div class="km-node-dot"></div>
      ${node.label}
      ${kmSelectedStudent === null && status === 'weak' ? `<span class="km-node-count">(${getNodeStudentCount(node.id, 'weak')}人)</span>` : ''}
      <div class="km-node-tooltip">${tooltip}</div>
    </div>
  `;
}

function toggleDomain(header) {
  const body = header.nextElementSibling;
  const toggle = header.querySelector('.km-domain-toggle');
  body.classList.toggle('open');
  toggle.classList.toggle('open');
}

function kmNodeClick(nodeId, nodeLabel) {
  kmFocusedNode = findKnowledgeNode(nodeId) || { id: nodeId, label: nodeLabel };
  if (kmSelectedStudent) {
    const current = (studentNodeStatus[kmSelectedStudent] || {})[nodeId] || 'untested';
    const cycle = { untested: 'partial', partial: 'mastered', mastered: 'weak', weak: 'untested' };
    if (!studentNodeStatus[kmSelectedStudent]) studentNodeStatus[kmSelectedStudent] = {};
    studentNodeStatus[kmSelectedStudent][nodeId] = cycle[current];
    // Sync back to student weakPoints
    syncWeakPoints(kmSelectedStudent);
    api.put(`/knowledge-map/student/${kmSelectedStudent}/${nodeId}`, { status: cycle[current] }).catch(() => {});
    document.getElementById('km-tree').innerHTML = renderKMTree();
    const s = mockData.students.find(st => st.id === kmSelectedStudent);
    const panel = document.getElementById('km-focus-panel');
    if (s && panel) panel.innerHTML = renderKMFocusPanel(s);
    const summary = document.getElementById('km-summary');
    if (s && summary) summary.innerHTML = renderKMSummary(s);
    showToast(`${nodeLabel} → ${['untested','partial','mastered','weak'].includes(cycle[current]) ? {untested:'未测试',partial:'部分掌握',mastered:'已掌握',weak:'薄弱'}[cycle[current]] : ''}`);
  } else {
    const weakStudents = mockData.students.filter(s => ((studentNodeStatus[s.id] || {})[nodeId] || 'untested') === 'weak').map(s => s.name);
    showToast(weakStudents.length ? `${nodeLabel} 薄弱学生：${weakStudents.join('、')}` : `${nodeLabel} 暂无薄弱学生`);
  }
}

function selectKMFocus(studentId, nodeId) {
  const s = mockData.students.find(st => st.id === studentId);
  if (!s) return;
  kmSelectedStudent = studentId;
  kmFocusedNode = findKnowledgeNode(nodeId) || kmFocusedNode;
  const summary = document.getElementById('km-summary');
  const panel = document.getElementById('km-focus-panel');
  if (summary) summary.innerHTML = renderKMSummary(s);
  if (panel) panel.innerHTML = renderKMFocusPanel(s);
}

function toggleStudentKMMap(studentId) {
  const s = mockData.students.find(st => st.id === studentId);
  if (!s) return;
  kmFullMapOpen = !kmFullMapOpen;
  document.getElementById('student-detail').innerHTML = renderStudentDetail(s);
}

function setNodeStatus(studentId, nodeId, status) {
  const s = mockData.students.find(st => st.id === studentId);
  if (!s) return;
  if (!studentNodeStatus[studentId]) studentNodeStatus[studentId] = {};
  studentNodeStatus[studentId][nodeId] = status;
  kmSelectedStudent = studentId;
  kmFocusedNode = findKnowledgeNode(nodeId) || kmFocusedNode;
  syncWeakPoints(studentId);
  api.put(`/knowledge-map/student/${studentId}/${nodeId}`, { status }).catch(() => {});
  const tree = document.getElementById('km-tree');
  if (tree) tree.innerHTML = renderKMTree();
  const panel = document.getElementById('km-focus-panel');
  if (panel) panel.innerHTML = renderKMFocusPanel(s);
  const summary = document.getElementById('km-summary');
  if (summary) summary.innerHTML = renderKMSummary(s);
  showToast(`${kmFocusedNode?.label || '知识点'} → ${statusText(status)}`);
}

function goHomeworkForNode(studentId, nodeId) {
  currentStudent = mockData.students.find(s => s.id === studentId) || currentStudent;
  homeworkFocusPoint = findKnowledgeNode(nodeId);
  goToStudent(studentId, true);
}

function syncWeakPoints(studentId) {
  const s = mockData.students.find(st => st.id === studentId);
  if (!s) return;
  const nodeStatus = studentNodeStatus[studentId] || {};
  const weakNodes = [];
  mockData.knowledgeTree.forEach(domain => {
    domain.children.forEach(cat => {
      cat.children.forEach(node => {
        if (nodeStatus[node.id] === 'weak') weakNodes.push(node.label);
      });
    });
  });
  s.weakPoints = weakNodes;
  api.put('/students/' + studentId, { weakPoints: weakNodes });
}

// ============================================================
// QUESTIONS (QUESTION BANK)
// ============================================================
function canManageSystemQuestionBank() {
  return qSystemBankState?.isAdmin || currentUser?.username === 'test';
}

function canReadSystemQuestionBank() {
  return true;
}

function renderQuestions() {
  const canManage = canManageSystemQuestionBank();
  const ocr = kanbanData['pending-ocr'];
  const review = kanbanData['pending-review'];
  const approved = kanbanData['approved'];
  const files = buildQuestionFiles();
  const allQuestions = [...ocr, ...review, ...approved];
  const stats = buildQuestionLibraryStats(allQuestions, files);

  document.getElementById('tab-questions').innerHTML = `
    ${canManage ? `<div class="mb-20">
      <div class="upload-zone" id="q-upload-zone" onclick="qTriggerUpload()">
        <div class="upload-icon" id="q-upload-icon">📤</div>
        <div class="upload-text" id="q-upload-text">上传题库并预览</div>
        <div class="upload-sub">支持 CSV、Markdown、JSON，先解析成题目预览，老师确认无误后再正式入库</div>
      </div>
      <input type="file" id="q-file-input" multiple accept=".csv,.md,.json" style="display:none" onchange="qHandleFiles(this.files)">
    </div>` : ''}

    ${canManage && qImportPreview ? renderQuestionImportPreview() : ''}

    <div class="library-stats">
      <div class="library-stat">
        <div class="library-stat-label">题库文件</div>
        <div class="library-stat-value">${files.length}</div>
      </div>
      <div class="library-stat">
        <div class="library-stat-label">题目总数</div>
        <div class="library-stat-value">${allQuestions.length}</div>
      </div>
      <div class="library-stat">
        <div class="library-stat-label">覆盖考察点</div>
        <div class="library-stat-value">${stats.knowledgePoints}</div>
      </div>
      <div class="library-stat">
        <div class="library-stat-label">可组卷题目</div>
        <div class="library-stat-value">${stats.readyQuestions}</div>
      </div>
    </div>

    ${qSelectedFile ? renderQuestionFileDetail(qSelectedFile) : `
      <div class="card">
        <div class="flex items-center justify-between" style="margin-bottom:14px;gap:12px;flex-wrap:wrap">
          <div>
            <div class="card-title" style="margin:0">${canManage ? '我的题库资料' : '系统自带题库'}</div>
            <div class="card-sub" style="margin:4px 0 0">${canManage ? '按教材资料文件管理题目，题目会用于错题匹配和专项组卷。' : '题库由 test 账户统一维护，可查看并用于专项组卷。'}</div>
          </div>
          <div class="flex items-center gap-8" style="flex-wrap:wrap;justify-content:flex-end">
            ${canManage ? `<button class="btn btn-primary btn-sm" onclick="showQuestionInsert('${escapeJs(qManualFileName)}')">添加题目</button>` : ''}
            <div class="text-muted text-sm">${stats.readyFiles} 个文件分类完成</div>
          </div>
        </div>
        ${files.length ? `
	          <table class="table library-file-table">
            <thead>
              <tr>
	                <th>题库名称</th><th>文件类型</th><th>已分类题目/题目数</th><th>状态</th><th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${files.map(f => `
                <tr>
                  <td>
                    ${canManage ? `<input class="library-file-name-input" value="${escapeHtml(qDisplayFileName(f.name))}" aria-label="题库名称"
                      onchange="renameQuestionFile('${escapeJs(f.name)}', this.value)"
                      onkeydown="if(event.key==='Enter'){event.preventDefault();this.blur();}">` : `<span>${escapeHtml(qDisplayFileName(f.name))}</span>`}
                  </td>
	                  <td>${qFileTypeLabel(f.ext)}</td>
	                  <td>
	                    <div class="library-coverage">
	                      <div class="library-track"><div class="library-fill" style="width:${Math.round(f.knowledgeDone / Math.max(1, f.total) * 100)}%"></div></div>
                      <span class="text-muted text-sm">${f.knowledgeDone}/${f.total}</span>
                    </div>
                  </td>
                  <td>${qFileStatusLabel(f)}</td>
                  <td>
                    <div style="display:flex;gap:10px;align-items:center;white-space:nowrap">
                      <a onclick="selectQuestionFile('${escapeJs(f.name)}')">查看</a>
                      ${canManage ? `<a onclick="deleteQuestionFile('${escapeJs(f.name)}')" style="color:var(--red)">删除</a>` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        ` : `
          <div class="empty-state" style="padding:36px">
            <div class="empty-icon">🗂️</div>
            <div class="empty-text">还没有题库文件</div>
            <div class="text-muted text-sm" style="margin-top:6px">${canManage ? '建议上传 CSV、Markdown 或 JSON，系统会按表格行或题目数组拆成题目。' : '系统题库暂无可用题目，请联系管理员维护。'}</div>
            ${canManage ? `<button class="btn btn-primary btn-sm" style="margin-top:14px" onclick="showQuestionInsert('${escapeJs(qManualFileName)}')">手动添加第一题</button>` : ''}
          </div>
        `}
      </div>
    `}
  `;
  if (canManage) qInitDragDrop();
}

function buildQuestionLibraryStats(questions, files) {
  const knowledgePoints = new Set(questions.map(q => q.knowledgePoint).filter(Boolean)).size;
  const readyQuestions = questions.filter(q => q.content && q.answer && q.knowledgePoint).length;
  const readyFiles = files.filter(f => f.total > 0 && f.knowledgeDone === f.total).length;
  return { knowledgePoints, readyQuestions, readyFiles };
}

function renderQuestionImportPreview() {
  const results = qImportPreview?.results || [];
  const okResults = results.filter(r => !r.error);
  const total = okResults.reduce((sum, r) => sum + (r.questions?.length || 0), 0);
  const fieldStats = buildImportFieldStats(okResults);
  return `
    <div class="card mb-20">
      <div class="flex items-center justify-between" style="gap:12px;flex-wrap:wrap;margin-bottom:14px">
        <div>
          <div class="card-title" style="margin:0">导入预览</div>
          <div class="card-sub" style="margin:4px 0 0">${okResults.length} 个文件 · ${total} 道题 · ${renderFieldStatsText(fieldStats, total)}</div>
	        </div>
	        <div class="flex gap-8">
	          <button class="btn btn-secondary btn-sm" onclick="cancelQuestionImportPreview()">取消</button>
	          <button class="btn btn-primary btn-sm" onclick="commitQuestionImportPreview()" ${total && !qClassifyLoading ? '' : 'disabled'}>确认入库</button>
	        </div>
	      </div>
	      ${renderImportClassificationProgress(total)}
      ${results.map((r, fileIndex) => r.error ? `
        <div class="note-block" style="border:1px solid var(--line)">
          <div style="font-weight:800;color:var(--red)">${escapeHtml(r.file)}</div>
          <div class="text-muted text-sm">${escapeHtml(r.error)}</div>
        </div>
      ` : `
        <div class="note-block" style="border:1px solid var(--line)">
          <div class="flex items-center justify-between" style="gap:12px;flex-wrap:wrap;margin-bottom:8px">
            <div>
              <div style="font-weight:900">${escapeHtml(r.file)}</div>
              <div class="text-muted text-sm">${r.questions.length} 道题 · ${r.summary.complete}/${r.summary.total} 字段完整</div>
              ${renderImportSourceHint(r)}
              ${r.warning ? `<div class="text-muted text-sm" style="color:var(--orange);margin-top:3px">部分考察点未能自动判断：${escapeHtml(r.warning)}</div>` : ''}
            </div>
            <span class="pill ${r.summary.missing ? 'orange' : 'green'}">${r.summary.missing ? `待检查 ${r.summary.missing} 道` : '可入库'}</span>
          </div>
          <div class="question-table-wrap" style="max-height:520px;overflow:auto;">
            <table class="table question-detail-table">
	              <colgroup>
	                <col>
	                <col class="question-answer-col">
	                <col class="question-category-col">
	                <col class="question-kp-col">
	              </colgroup>
	              <thead style="position:sticky;top:0;background:var(--panel);z-index:5">
	                <tr><th>题目</th><th>答案</th><th>一级分类</th><th>二级分类</th></tr>
	              </thead>
              <tbody>
                ${r.questions.map((q, questionIndex) => `
                  <tr>
                    <td class="question-cell">
                      ${qEditableQuestionHtml(`import-${fileIndex}-${questionIndex}`, q.content, `updateImportPreviewQuestion(${fileIndex}, ${questionIndex}, 'content', this.value)`)}
                    </td>
                    <td class="question-answer-cell">
                      <input class="question-edit-input" value="${escapeHtml(q.answer || '')}" onchange="updateImportPreviewQuestion(${fileIndex}, ${questionIndex}, 'answer', this.value)" aria-label="答案">
                    </td>
                    <td class="question-category-cell">
                      ${renderKnowledgeCategoryPill(q.knowledgePoint)}
                    </td>
                    <td class="question-kp-cell">
                      <select class="question-edit-select" onchange="updateImportPreviewQuestion(${fileIndex}, ${questionIndex}, 'knowledgePoint', this.value)" aria-label="考察点">
                        ${qGroupedOptionHtml(q.knowledgePoint, '选择考察点')}
                      </select>
                    </td>
	                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function buildImportFieldStats(results) {
  const questions = results.flatMap(r => r.questions || []);
  const fields = [
    ['content', '题目'],
    ['answer', '答案'],
    ['knowledgePoint', '考察点']
  ];
  return fields.map(([key, label]) => ({
    key,
    label,
    count: questions.filter(q => String(q[key] || '').trim()).length
  }));
}

function renderImportClassificationProgress(total) {
  if (!total) return '';
  const allQuestions = (qImportPreview?.results || []).flatMap(r => r.error ? [] : (r.questions || []));
  const progressUnits = allQuestions.reduce((sum, q) => {
    if (isStandardKnowledgePoint(q.knowledgePoint) || q._recognitionStatus === 'done') return sum + 1;
    if (q._recognitionStatus === 'running') return sum + Math.max(0, Math.min(0.9, Number(q._recognitionProgress || 0) / 100));
    return sum;
  }, 0);
  const completed = Number(qImportPreview?.classifyCompleted || 0);
  const classifyTotal = Number(qImportPreview?.classifyTotal || total);
  const denominator = Math.max(1, classifyTotal);
  const percent = Math.max(0, Math.min(100, Math.round(Math.max(completed, progressUnits) / denominator * 100)));
  const pendingCount = (qImportPreview?.results || []).reduce((sum, r) =>
    sum + ((r.questions || []).filter(q => !isStandardKnowledgePoint(q.knowledgePoint)).length), 0);
  const done = qImportPreview?.classified && pendingCount === 0;
  const running = qClassifyLoading;
  const state = done ? 'done' : running ? 'running' : 'pending';
  const status = done
    ? '分类完成'
    : running
    ? '正在按标准判断分类'
    : '等待自动分类';
  const countText = done
    ? `${total}/${total}`
    : `${Math.min(completed, denominator)}/${denominator}`;
  return `
    <div class="import-progress ${state}" style="--progress:${percent}%">
      <div class="import-progress-head">
        <span class="import-progress-status">${escapeHtml(status)}</span>
        <span class="import-progress-count">${escapeHtml(countText)}</span>
      </div>
      <div class="import-progress-track"><div class="import-progress-fill"></div></div>
    </div>
  `;
}

function renderImportSourceHint(result) {
  if (result.source === 'parsed') {
    return '<div class="text-muted text-sm" style="color:var(--orange);margin-top:3px">题目已解析，系统正在自动判断分类。</div>';
  }
  const questions = result.questions || [];
  const hasModuleFields = questions.some(q => q.module || q.topic || q.chapter || q.unit || q.section);
  if (hasModuleFields) {
    return '<div class="text-muted text-sm" style="color:var(--green);margin-top:3px">已按小奥 2026 标准逐题判断考察点，请老师确认后入库。</div>';
  }
  const hasKnowledgePoint = questions.some(q => q.knowledgePoint);
  if (hasKnowledgePoint) {
    return '<div class="text-muted text-sm" style="color:var(--green);margin-top:3px">已按小奥 2026 标准逐题判断考察点，请老师确认后入库。</div>';
  }
  return '<div class="text-muted text-sm" style="color:var(--orange);margin-top:3px">未能自动判断的题会标为“待判断考察点”，请老师手动选择后入库。</div>';
}

function renderRecognitionProgress(q) {
  const done = q._recognitionStatus === 'done' || isStandardKnowledgePoint(q.knowledgePoint);
  const running = q._recognitionStatus === 'running';
  const failed = q._recognitionStatus === 'failed';
  const percent = done ? 100 : running ? Number(q._recognitionProgress || 35) : 0;
  const state = done ? 'done' : running ? 'running' : 'pending';
  const label = done ? '完成' : running ? '识别中' : failed ? '待确认' : '未开始';
  const icon = done ? '✓' : running ? '…' : '!';
  return `
    <div class="recognition-progress ${state}" style="--progress:${percent}%">
      <div class="recognition-progress-head">
        <span>${label}</span>
        <span class="recognition-check">${icon}</span>
      </div>
      <div class="recognition-track"><div class="recognition-fill"></div></div>
    </div>
  `;
}

function renderFieldStatsText(stats, total) {
  if (!total) return '暂无题目';
  return stats.map(s => `${s.label} ${s.count}/${total}`).join(' · ');
}

function updateImportPreviewQuestion(fileIndex, questionIndex, field, value) {
  const item = qImportPreview?.results?.[fileIndex]?.questions?.[questionIndex];
  if (!item) return;
  item[field] = String(value ?? '').trim();
  refreshImportPreviewSummary(fileIndex);
  renderQuestions();
}

function refreshImportPreviewSummary(fileIndex) {
  const result = qImportPreview?.results?.[fileIndex];
  if (!result || result.error) return;
  const questions = result.questions || [];
  const complete = questions.filter(q => q.content && q.answer && q.knowledgePoint).length;
  const knowledgePoints = [...new Set(questions.map(q => q.knowledgePoint).filter(Boolean))];
  result.summary = {
    total: questions.length,
    complete,
    missing: questions.length - complete,
    knowledgePoints,
    difficulties: questions.reduce((acc, q) => {
      const key = q.difficulty || '未填写';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {}),
    types: questions.reduce((acc, q) => {
      const key = q.type || '未填写';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  };
}

function cancelQuestionImportPreview() {
  qImportPreview = null;
  renderQuestions();
}

function questionImportNeedsClassification() {
  return (qImportPreview?.results || []).some(r =>
    !r.error && (r.questions || []).some(q => !q.knowledgePoint)
  );
}

async function classifyQuestionImportPreview(force = false) {
  if (!qImportPreview?.results?.length || qClassifyLoading) return;
  const results = qImportPreview.results.filter(r => !r.error && Array.isArray(r.questions) && r.questions.length);
  if (!results.length) return;
  const jobs = [];
  results.forEach((result, fileIndex) => {
    result.questions.forEach((q, questionIndex) => {
      if (force || !isStandardKnowledgePoint(q.knowledgePoint)) {
        q._recognitionStatus = 'pending';
        q._recognitionProgress = 0;
        jobs.push({ fileIndex, questionIndex });
      } else {
        q._recognitionStatus = 'done';
        q._recognitionProgress = 100;
      }
    });
  });
  if (!jobs.length) return;
  qClassifyLoading = true;
  qImportPreview.classified = false;
  qImportPreview.classifyTotal = jobs.length;
  qImportPreview.classifyCompleted = 0;
  qImportPreview.classifyStatus = `正在按小奥 2026 标准识别分类：0/${jobs.length} 道。`;
  renderQuestions();
  let completed = 0;
  let failedBatches = 0;
  try {
    const ok = await classifyImportBatch(jobs, 0, jobs.length);
    if (!ok) failedBatches += 1;
    completed = jobs.length;
    qImportPreview.classifyCompleted = completed;
    [...new Set(jobs.map(job => job.fileIndex))].forEach(refreshImportPreviewSummary);
    qImportPreview.classifyStatus = `已识别 ${completed}/${jobs.length} 道。`;
    renderQuestions();
	    const pendingCount = qImportPreview.results.reduce((sum, r) => sum + ((r.questions || []).filter(q => !isStandardKnowledgePoint(q.knowledgePoint)).length), 0);
	    qImportPreview.classifyCompleted = jobs.length;
	    qImportPreview.classified = pendingCount === 0;
    if (pendingCount === 0) {
      qImportPreview.results.forEach(r => {
        if (r && !r.error) r.warning = '';
      });
    }
    qImportPreview.classifyStatus = failedBatches
      ? `分类完成，但有 ${pendingCount} 道题仍需手动确认；失败批次 ${failedBatches} 个。`
      : pendingCount
      ? `分类完成，还有 ${pendingCount} 道题需手动确认。`
      : '分类已完成，全部题目已打上一级分类和二级分类；请老师确认后再入库。';
    showToast(pendingCount ? `分类完成，${pendingCount} 道需确认` : '分类已完成');
  } catch (e) {
    qImportPreview.classifyStatus = '考察点判断失败：' + e.message;
    showToast('考察点判断失败：' + e.message);
  } finally {
    qClassifyLoading = false;
    renderQuestions();
  }
}

async function classifyImportBatch(batch, start, total) {
  batch.forEach(job => {
    const q = qImportPreview.results[job.fileIndex]?.questions?.[job.questionIndex];
    if (q) {
      q._recognitionStatus = 'running';
      q._recognitionProgress = 8;
    }
  });
  qImportPreview.classifyStatus = `正在识别 ${batch.length} 道题，共 ${total} 道。`;
  renderQuestions();
  const progressTimer = startRecognitionBatchProgress(batch);
  let ok = true;
  const grouped = batch.reduce((acc, job) => {
    const result = qImportPreview.results[job.fileIndex];
    if (!result) return acc;
    if (!acc[job.fileIndex]) acc[job.fileIndex] = { result, jobs: [] };
    acc[job.fileIndex].jobs.push(job);
    return acc;
  }, {});
  try {
    for (const group of Object.values(grouped)) {
      const importQuestions = group.jobs.map(job => qImportPreview.results[job.fileIndex].questions[job.questionIndex]);
      try {
        const data = await api.post('/upload/classify', {
          imports: [{ file: group.result.file, fileType: group.result.fileType, questions: importQuestions }],
          force: true
        });
        const classified = data.results?.[0];
        if (!classified || classified.error) throw new Error(classified?.error || '分类接口未返回结果');
        applyCreditSummary(classified.credit);
        group.jobs.forEach((job, index) => {
          const target = qImportPreview.results[job.fileIndex].questions[job.questionIndex];
          const next = classified.questions?.[index] || {};
          Object.assign(target, next);
          target._recognitionStatus = isStandardKnowledgePoint(target.knowledgePoint) ? 'done' : 'failed';
          target._recognitionProgress = isStandardKnowledgePoint(target.knowledgePoint) ? 100 : 0;
        });
        qImportPreview.results[group.jobs[0].fileIndex].source = 'batched-ai';
        qImportPreview.results[group.jobs[0].fileIndex].warning = classified.warning || '';
      } catch (err) {
        ok = false;
        group.jobs.forEach(job => {
          const target = qImportPreview.results[job.fileIndex].questions[job.questionIndex];
          target._recognitionStatus = 'failed';
          target._recognitionProgress = 0;
        });
      }
    }
  } finally {
    clearInterval(progressTimer);
  }
  return ok;
}

function startRecognitionBatchProgress(batch) {
  return setInterval(() => {
    let changed = false;
    batch.forEach(job => {
      const q = qImportPreview?.results?.[job.fileIndex]?.questions?.[job.questionIndex];
      if (!q || q._recognitionStatus !== 'running') return;
      const current = Number(q._recognitionProgress || 8);
      const next = Math.min(90, current + Math.max(2, Math.round((90 - current) * 0.18)));
      if (next !== current) {
        q._recognitionProgress = next;
        changed = true;
      }
    });
    if (changed) renderQuestions();
  }, 550);
}

async function commitQuestionImportPreview() {
  if (!qImportPreview?.results?.length) return;
  const imports = qImportPreview.results
    .filter(r => !r.error && Array.isArray(r.questions) && r.questions.length)
    .map(r => ({ file: r.file, fileType: r.fileType, questions: r.questions }));
  if (!imports.length) {
    showToast('没有可入库的题目');
    return;
  }
  try {
    const data = await api.post('/upload/commit', { imports });
    let total = 0;
    let skippedTotal = 0;
    (data.results || []).forEach(r => {
      if (r.error) return;
      skippedTotal += Number(r.skippedCount || 0);
      (r.questions || []).forEach(q => {
        kanbanData.approved.push({
          id: q.id,
          content: q.content,
          type: q.type,
          difficulty: q.difficulty,
          knowledgePoint: q.knowledgePoint,
          answer: q.answer,
          status: 'approved',
          sourceFile: q.sourceFile || r.file,
          sourceType: q.sourceType || r.fileType,
          importBatchId: q.importBatchId || r.batchId,
        });
      });
      total += r.count || 0;
    });
    mockData.questions = [...kanbanData['pending-ocr'], ...kanbanData['pending-review'], ...kanbanData.approved];
    qImportPreview = null;
    showToast(skippedTotal ? `已入库 ${total} 道题，跳过重复 ${skippedTotal} 道` : `已入库 ${total} 道题`);
    renderQuestions();
  } catch (e) {
    showToast('入库失败：' + e.message);
  }
}

function buildQuestionFiles() {
  const all = [...kanbanData['pending-ocr'], ...kanbanData['pending-review'], ...kanbanData['approved']];
  const map = new Map();
  all.forEach(q => {
    const name = q.sourceFile || q.fileName || (q.status === 'approved' ? '示例题库.md' : '未命名题库.md');
    const nameExt = name.includes('.') ? name.split('.').pop() : '';
    const ext = (q.sourceType || nameExt || '').toLowerCase();
    const file = map.get(name) || { name, ext, total: 0, knowledgeDone: 0, pendingOcr: 0, pendingReview: 0, approved: 0, knowledgeSet: new Set() };
    file.total += 1;
    if (isStandardKnowledgePoint(q.knowledgePoint)) {
      file.knowledgeDone += 1;
      file.knowledgeSet.add(q.knowledgePoint);
    }
    if (q.status === 'pending-ocr') file.pendingOcr += 1;
    if (q.status === 'pending-review') file.pendingReview += 1;
    if (q.status === 'approved') file.approved += 1;
    map.set(name, file);
  });
  return [...map.values()].sort((a, b) => b.pendingOcr + b.pendingReview - a.pendingOcr - a.pendingReview || a.name.localeCompare(b.name));
}

function qQuestionsByFile(fileName) {
  return [...kanbanData['pending-ocr'], ...kanbanData['pending-review'], ...kanbanData['approved']]
    .filter(q => (q.sourceFile || q.fileName || (q.status === 'approved' ? '示例题库.md' : '未命名题库.md')) === fileName)
    .sort((a, b) => qQuestionOrderValue(a) - qQuestionOrderValue(b) || Number(a.id || 0) - Number(b.id || 0));
}

function qQuestionOrderValue(q) {
  const order = Number(q.sortOrder ?? q.sort_order);
  return Number.isFinite(order) && order > 0 ? order : Number(q.id || 0);
}

function qFileTypeLabel(ext) {
  const text = String(ext || '').trim().toLowerCase() || '未知';
  return `<span class="tag neutral">${escapeHtml(text)}</span>`;
}

function qFileStatusLabel(f) {
  if (f.knowledgeDone < f.total) return '<span class="pill orange">未分类完成</span>';
  return '<span class="pill green">分类完成</span>';
}

function qDisplayFileName(name) {
  return String(name || '').replace(/\.[^.]+$/, '');
}

function qFileExt(name) {
  const match = String(name || '').match(/\.([^.]+)$/);
  return match ? match[1] : '';
}

function qBuildRenamedFileName(oldName, displayName) {
  const clean = String(displayName || '').trim();
  if (!clean) return '';
  if (/\.[^.]+$/.test(clean)) return clean;
  const ext = qFileExt(oldName);
  return ext ? `${clean}.${ext}` : clean;
}

function qUnique(list, key) {
  return [...new Set(list.map(item => item[key]).filter(Boolean))];
}

function qKnowledgePointOptions(qs = []) {
  const fromTree = [];
  const walk = nodes => (nodes || []).forEach(node => {
    if (node.children?.length) walk(node.children);
    else if (node.label) fromTree.push(node.label);
  });
  walk(mockData.knowledgeTree);
  return [...new Set(fromTree)].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function qKnowledgeOptionGroups() {
  return (mockData.knowledgeTree || []).map(domain => ({
    label: domain.label,
    options: (domain.children || []).flatMap(cat => (cat.children || []).map(node => node.label))
  })).filter(group => group.options.length);
}

function qGroupedOptionHtml(current, placeholder = '请选择') {
  const allOptions = qKnowledgePointOptions();
  const exists = current && allOptions.includes(current);
  return `
    <option value="" ${!exists ? 'selected' : ''}>${current === '待判断考察点' ? '待判断考察点' : placeholder}</option>
    ${qKnowledgeOptionGroups().map(group => `
      <optgroup label="${escapeHtml(group.label)}">
        ${group.options.map(opt => `<option value="${escapeHtml(opt)}" ${current === opt ? 'selected' : ''}>${escapeHtml(opt)}</option>`).join('')}
      </optgroup>
    `).join('')}
  `;
}

function qKnowledgePickerHtml(q, options) {
  const current = q.knowledgePoint || '';
  const groups = qKnowledgeOptionGroups();
  return `
    <div class="kp-picker" id="kp-picker-${q.id}">
      <button class="kp-picker-btn" type="button" onclick="toggleKpPicker(${q.id})">
        <span class="kp-picker-label">${escapeHtml(options.includes(current) ? current : '待判断考察点')}</span>
        <span style="font-size:12px;line-height:1;color:var(--muted)">⌄</span>
      </button>
      <div class="kp-picker-menu">
        ${groups.map(group => `
          <div class="kp-picker-group">${escapeHtml(group.label)}</div>
          ${group.options.map(opt => `
            <button class="kp-picker-option ${current === opt ? 'active' : ''}" type="button" onclick="selectQuestionKnowledgePoint(${q.id}, '${escapeJs(opt)}')">${escapeHtml(opt)}</button>
          `).join('')}
        `).join('')}
      </div>
    </div>
  `;
}

function qFilterPickerHtml(key, label, options, current) {
  const activeLabel = current === 'all' ? label : current;
  return `
    <div class="filter-picker" id="filter-picker-${key}">
      <button class="filter-picker-btn" type="button" onclick="toggleFilterPicker('${key}')">
        <span class="filter-picker-label">${escapeHtml(activeLabel)}</span>
        <span>⌄</span>
      </button>
      <div class="filter-picker-menu">
        <button class="filter-picker-option ${current === 'all' ? 'active' : ''}" type="button" onclick="selectQuestionFilter('${key}', 'all')">${escapeHtml(label)}</button>
        ${options.map(opt => `
          <button class="filter-picker-option ${current === opt ? 'active' : ''}" type="button" onclick="selectQuestionFilter('${key}', '${escapeJs(opt)}')">${escapeHtml(opt)}</button>
        `).join('')}
      </div>
    </div>
  `;
}

function qTextareaRows(text) {
  const len = String(text || '').length;
  return Math.min(8, Math.max(2, Math.ceil(len / 34)));
}

function qEditableQuestionHtml(id, content, changeHandler) {
  const safeId = String(id || '').replace(/[^a-zA-Z0-9_-]/g, '-');
  return `
    <div class="question-math-preview" id="preview-${safeId}" onclick="qStartQuestionEdit('${safeId}')">${renderMathRichText(content || '')}</div>
    <textarea class="question-edit-textarea is-hidden" id="edit-${safeId}" rows="${qTextareaRows(content)}" onchange="${changeHandler}" onblur="qStopQuestionEdit('${safeId}')" aria-label="题目">${escapeHtml(content || '')}</textarea>
  `;
}

function qReadonlyQuestionHtml(content) {
  return `<div class="question-math-preview">${renderMathRichText(content || '')}</div>`;
}

function qSourceImageHtml(q, showEmpty = false) {
  if (!q.sourceImage && !showEmpty) return '';
  const inputId = `question-image-input-${q.id}`;
  return `
    <div class="question-source-image-editor ${q.sourceImage ? '' : 'empty'}">
      ${q.sourceImage ? `
        <a class="question-source-image" href="${escapeHtml(q.sourceImage)}" target="_blank" rel="noopener">
          <img src="${escapeHtml(q.sourceImage)}" alt="题内截图">
        </a>
      ` : '<div class="question-source-placeholder">暂无截图</div>'}
      <div class="question-image-actions">
        <button class="btn btn-secondary btn-sm" type="button" onclick="document.getElementById('${inputId}')?.click()">${q.sourceImage ? '替换截图' : '上传截图'}</button>
        <input id="${inputId}" class="question-image-input" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange="uploadQuestionSourceImage(${q.id}, this)">
      </div>
    </div>
  `;
}

function renderQuestionInsertBar(fileName, total) {
  const defaultPosition = total + 1;
  return `
    <div class="question-insert-bar">
      <span class="question-insert-label">插入到第</span>
      <input id="question-insert-position" class="question-insert-input" type="number" min="1" max="${total + 1}" value="${defaultPosition}" onkeydown="if(event.key==='Enter'){confirmQuestionInsert('${escapeJs(fileName)}')}">
      <span class="question-insert-label">题前</span>
      <button class="btn btn-primary btn-sm" onclick="confirmQuestionInsert('${escapeJs(fileName)}')">确认新增</button>
      <button class="btn btn-secondary btn-sm" onclick="cancelQuestionInsert()">取消</button>
      <span class="text-muted text-sm">当前共 ${total} 题，输入 ${total + 1} 表示追加到最后</span>
    </div>
  `;
}

function showQuestionInsert(fileName = qSelectedFile || qManualFileName) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以新增题目');
    return;
  }
  qSelectedFile = fileName || qManualFileName;
  qInsertFileName = qSelectedFile;
  renderQuestions();
  setTimeout(() => {
    const input = document.getElementById('question-insert-position');
    input?.focus();
    input?.select();
  }, 0);
}

function cancelQuestionInsert() {
  qInsertFileName = null;
  renderQuestions();
}

function confirmQuestionInsert(fileName) {
  const input = document.getElementById('question-insert-position');
  const position = Number(input?.value || 1);
  addManualQuestion(fileName, position);
}

async function saveQuestionFileOrder(fileName, orderedQuestions) {
  if (!canManageSystemQuestionBank()) return;
  const items = orderedQuestions.map((q, index) => ({ id: q.id, sortOrder: index + 1 }));
  orderedQuestions.forEach((q, index) => {
    q.sortOrder = index + 1;
    q.sort_order = index + 1;
  });
  await api.put('/questions/order/batch', { items });
}

async function addManualQuestion(fileName = qSelectedFile || qManualFileName, insertPosition = 1) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以新增题目');
    return;
  }
  const sourceFile = fileName || qManualFileName;
  const existingQuestions = qQuestionsByFile(sourceFile);
  const insertIndex = Math.max(0, Math.min(existingQuestions.length, (Number(insertPosition) || 1) - 1));
  const question = {
    content: '',
    type: '计算题',
    difficulty: '基础',
    knowledgePoint: '待判断考察点',
    answer: '',
    status: 'approved',
    sourceFile,
    sourceType: 'manual',
    sortOrder: insertIndex + 1
  };
  try {
    const data = await api.post('/questions', question);
    const created = { ...question, id: data.id, sourceImage: '', importBatchId: null };
    kanbanData.approved.push(created);
    const orderedQuestions = [
      ...existingQuestions.slice(0, insertIndex),
      created,
      ...existingQuestions.slice(insertIndex)
    ];
    await saveQuestionFileOrder(sourceFile, orderedQuestions);
    mockData.questions = [...kanbanData['pending-ocr'], ...kanbanData['pending-review'], ...kanbanData.approved];
    qSelectedFile = sourceFile;
    qInsertFileName = null;
    qFilters = { knowledgePoint: 'all' };
    qPage = Math.max(1, Math.ceil((insertIndex + 1) / 10));
    renderQuestions();
    setTimeout(() => qStartQuestionEdit(`question-${created.id}`), 0);
    showToast('已新增题目，可以填写题干并上传截图');
  } catch (e) {
    showToast('新增题目失败：' + e.message);
  }
}

function qStartQuestionEdit(id) {
  const preview = document.getElementById('preview-' + id);
  const edit = document.getElementById('edit-' + id);
  if (!preview || !edit) return;
  preview.classList.add('editing');
  edit.classList.remove('is-hidden');
  edit.focus();
}

function qStopQuestionEdit(id) {
  const preview = document.getElementById('preview-' + id);
  const edit = document.getElementById('edit-' + id);
  if (!preview || !edit) return;
  preview.innerHTML = renderMathRichText(edit.value || '');
  preview.classList.remove('editing');
  edit.classList.add('is-hidden');
}

function qSetFilter(key, value) {
  qFilters[key] = value;
  qPage = 1;
  renderQuestions();
}

function setQuestionPage(page) {
  qPage = Math.max(1, Number(page) || 1);
  renderQuestions();
}

function toggleFilterPicker(key) {
  document.querySelectorAll('.filter-picker.open').forEach(el => {
    if (el.id !== 'filter-picker-' + key) el.classList.remove('open');
  });
  document.getElementById('filter-picker-' + key)?.classList.toggle('open');
}

function selectQuestionFilter(key, value) {
  document.getElementById('filter-picker-' + key)?.classList.remove('open');
  qSetFilter(key, value);
}

function toggleKpPicker(id) {
  document.querySelectorAll('.kp-picker.open').forEach(el => {
    if (el.id !== 'kp-picker-' + id) el.classList.remove('open');
  });
  document.getElementById('kp-picker-' + id)?.classList.toggle('open');
}

function selectQuestionKnowledgePoint(id, value) {
  document.getElementById('kp-picker-' + id)?.classList.remove('open');
  updateQuestionField(id, 'knowledgePoint', value);
}

function qApplyFilters(qs) {
  return qs.filter(q =>
    (qFilters.knowledgePoint === 'all' || q.knowledgePoint === qFilters.knowledgePoint)
  );
}

function selectQuestionFile(fileName) {
  qSelectedFile = fileName;
  qFilters = { knowledgePoint: 'all' };
  qPage = 1;
  qCategoryEditor = null;
  renderQuestions();
}

async function renameQuestionFile(oldFileName, nextDisplayName) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以修改题库');
    renderQuestions();
    return;
  }
  const nextFileName = qBuildRenamedFileName(oldFileName, nextDisplayName);
  if (!nextFileName) {
    showToast('题库名称不能为空');
    renderQuestions();
    return;
  }
  if (nextFileName === oldFileName) return;
  const qs = qQuestionsByFile(oldFileName);
  if (!qs.length) return;
  try {
    for (const q of qs) {
      q.sourceFile = nextFileName;
      q.fileName = nextFileName;
      await api.put('/questions/' + q.id, { sourceFile: nextFileName });
    }
    if (qSelectedFile === oldFileName) qSelectedFile = nextFileName;
    renderQuestions();
    showToast('题库名称已更新');
  } catch (err) {
    await loadWorkspaceData();
    renderQuestions();
    showToast('修改失败：' + (err.message || '请稍后重试'));
  }
}

function backToQuestionFiles() {
  qSelectedFile = null;
  qPage = 1;
  qCategoryEditor = null;
  renderQuestions();
}

async function deleteQuestionFile(fileName) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以删除题库');
    return;
  }
  const qs = qQuestionsByFile(fileName);
  if (!qs.length) return;
  const ok = confirm(`确定删除「${qDisplayFileName(fileName)}」吗？将同时删除 ${qs.length} 道题。`);
  if (!ok) return;
  for (const q of qs) {
    ['pending-ocr', 'pending-review', 'approved'].forEach(col => {
      kanbanData[col] = kanbanData[col].filter(item => item.id !== q.id);
    });
    mockData.questions = mockData.questions.filter(item => item.id !== q.id);
    try {
      await api.delete('/questions/' + q.id);
    } catch (e) {
      console.warn('delete question failed:', q.id, e.message);
    }
  }
  if (qSelectedFile === fileName) qSelectedFile = null;
  qPage = 1;
  renderQuestions();
  showToast(`已删除 ${qs.length} 道题`);
}

async function updateQuestionField(id, field, value) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以修改题目');
    renderQuestions();
    return;
  }
  const q = mockData.questions.find(item => item.id === id)
    || [...kanbanData['pending-ocr'], ...kanbanData['pending-review'], ...kanbanData['approved']].find(item => item.id === id);
  if (!q) return;
  const oldValue = q[field] || '';
  const nextValue = String(value ?? '').trim();
  if (oldValue === nextValue) return;
  q[field] = nextValue;
  ['pending-ocr', 'pending-review', 'approved'].forEach(col => {
    const found = kanbanData[col].find(item => item.id === id);
    if (found) found[field] = nextValue;
  });
  const payload = { [field]: nextValue };
  try {
    await api.put('/questions/' + id, payload);
    qCategoryEditor = null;
    showToast('题目已保存');
    renderQuestions();
  } catch (e) {
    q[field] = oldValue;
    ['pending-ocr', 'pending-review', 'approved'].forEach(col => {
      const found = kanbanData[col].find(item => item.id === id);
      if (found) found[field] = oldValue;
    });
    qCategoryEditor = null;
    showToast('保存失败：' + e.message);
    renderQuestions();
  }
}

async function uploadQuestionSourceImage(id, input) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以上传或替换截图');
    if (input) input.value = '';
    return;
  }
  const file = input?.files?.[0];
  if (!file) return;
  const q = mockData.questions.find(item => item.id === id)
    || [...kanbanData['pending-ocr'], ...kanbanData['pending-review'], ...kanbanData['approved']].find(item => item.id === id);
  const oldImage = q?.sourceImage || '';
  const formData = new FormData();
  formData.append('image', file);
  try {
    showToast('正在上传截图...');
    const resp = await fetch(API + '/questions/' + id + '/source-image', {
      method: 'POST',
      headers: apiHeaders(),
      body: formData
    });
    const data = await apiJson(resp);
    const nextImage = data.question?.sourceImage || data.sourceImage;
    if (q && nextImage) q.sourceImage = nextImage;
    ['pending-ocr', 'pending-review', 'approved'].forEach(col => {
      const found = kanbanData[col].find(item => item.id === id);
      if (found && nextImage) found.sourceImage = nextImage;
    });
    showToast('截图已替换');
    renderQuestions();
  } catch (e) {
    if (q) q.sourceImage = oldImage;
    showToast('截图替换失败：' + e.message);
  } finally {
    if (input) input.value = '';
  }
}

function openQuestionCategoryEditor(id, field) {
  if (!canManageSystemQuestionBank()) return;
  qCategoryEditor = { id: Number(id), field };
  renderQuestions();
  setTimeout(() => {
    const input = document.getElementById(`question-${field === 'category' ? 'category' : 'point'}-editor-${id}`);
    input?.focus();
  }, 0);
}

function closeQuestionCategoryEditorSoon() {
  setTimeout(() => {
    const active = document.activeElement;
    if (active?.id?.startsWith('question-category-editor-') || active?.id?.startsWith('question-point-editor-')) return;
    qCategoryEditor = null;
    renderQuestions();
  }, 120);
}

async function updateQuestionCategory(id, category) {
  const options = getKnowledgePointsByCategory(category);
  const nextKnowledgePoint = options[0] || '待判断考察点';
  await updateQuestionField(id, 'knowledgePoint', nextKnowledgePoint);
}

async function classifyQuestionFile(fileName) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以修改题库分类');
    return;
  }
  const qs = qQuestionsByFile(fileName);
  if (!qs.length || qFileClassifyLoading) return;
  qFileClassifyLoading = fileName;
  renderQuestions();
  try {
    const imports = [{
      file: fileName,
      fileType: (fileName.split('.').pop() || '').toLowerCase(),
      questions: qs.map(q => ({
        content: q.content || '',
        answer: q.answer || '',
        type: q.type || '',
        difficulty: q.difficulty || '',
        knowledgePoint: q.knowledgePoint || ''
      }))
    }];
    const data = await api.post('/upload/classify', { imports, force: true });
    const result = (data.results || [])[0];
    if (!result || result.error) throw new Error(result?.error || '分类失败');
    applyCreditSummary(result.credit);
    const classified = Array.isArray(result.questions) ? result.questions : [];
    let updated = 0;
    for (let i = 0; i < qs.length; i++) {
      const question = qs[i];
      const nextKnowledgePoint = String(classified[i]?.knowledgePoint || '待判断考察点').trim() || '待判断考察点';
      if (question.knowledgePoint === nextKnowledgePoint) continue;
      question.knowledgePoint = nextKnowledgePoint;
      ['pending-ocr', 'pending-review', 'approved'].forEach(col => {
        const found = kanbanData[col].find(item => item.id === question.id);
        if (found) found.knowledgePoint = nextKnowledgePoint;
      });
      const mock = mockData.questions.find(item => item.id === question.id);
      if (mock) mock.knowledgePoint = nextKnowledgePoint;
      await api.put('/questions/' + question.id, { knowledgePoint: nextKnowledgePoint });
      updated += 1;
    }
    qFilters = { knowledgePoint: 'all' };
    showToast(updated ? `已按标准更新 ${updated} 道题考察点` : '所有题目考察点已符合当前判断结果');
  } catch (e) {
    showToast('考察点判断失败：' + e.message);
  } finally {
    qFileClassifyLoading = '';
    renderQuestions();
  }
}

function renderQuestionFileDetail(fileName) {
  const canManage = canManageSystemQuestionBank();
  const qs = qQuestionsByFile(fileName);
  const filtered = qs;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(Math.max(1, qPage || 1), totalPages);
  qPage = page;
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  return `
    <div class="card">
      <div class="flex items-center justify-between" style="gap:12px;flex-wrap:wrap;margin-bottom:18px">
        <div class="question-file-head">
          <button class="btn btn-secondary btn-sm" onclick="backToQuestionFiles()">← 返回文件列表</button>
          <div class="card-title" style="margin:0">${escapeHtml(qDisplayFileName(fileName))}</div>
        </div>
        <div class="library-filter-row" style="margin:0">
          ${canManage ? `<button class="btn btn-primary btn-sm" onclick="showQuestionInsert('${escapeJs(fileName)}')">新增题目</button>
          <button class="btn btn-primary btn-sm" onclick="classifyQuestionFile('${escapeJs(fileName)}')" ${qFileClassifyLoading ? 'disabled' : ''}>
            ${qFileClassifyLoading === fileName ? '判断中...' : '按标准判断考察点'}
          </button>` : '<span class="pill green">只读使用</span>'}
        </div>
      </div>
      ${canManage && qInsertFileName === fileName ? renderQuestionInsertBar(fileName, filtered.length) : ''}
      <div class="question-table-wrap">
        <table class="table question-detail-table">
          <colgroup>
            <col class="question-index-col">
            <col>
            <col class="question-answer-col">
            <col class="question-category-col">
            <col class="question-kp-col">
            <col class="question-action-col">
          </colgroup>
          <thead>
            <tr>
              <th>序号</th><th>题目</th><th>答案</th><th>一级分类</th><th>二级分类</th><th class="question-action-cell">操作</th>
            </tr>
          </thead>
          <tbody>
            ${paged.map((q, index) => `
              <tr>
                <td class="question-index-cell">${(page - 1) * pageSize + index + 1}</td>
                <td class="question-cell">
                  ${canManage ? qEditableQuestionHtml(`question-${q.id}`, q.content, `updateQuestionField(${q.id}, 'content', this.value)`) : qReadonlyQuestionHtml(q.content)}
                  ${canManage ? qSourceImageHtml(q, true) : qSourceImageHtml(q, false)}
                </td>
                <td class="question-answer-cell">
                  ${canManage ? `<input class="question-edit-input" value="${escapeHtml(q.answer || '')}" onchange="updateQuestionField(${q.id}, 'answer', this.value)" aria-label="答案">` : `<span>${escapeHtml(q.answer || '')}</span>`}
                </td>
                <td class="question-category-cell">
                  ${canManage && qCategoryEditor?.id === q.id && qCategoryEditor?.field === 'category' ? qCategorySelectHtml(q) : renderKnowledgeCategoryPill(q.knowledgePoint, canManage ? q.id : null)}
                </td>
                <td class="question-kp-cell">
                  ${canManage && qCategoryEditor?.id === q.id && qCategoryEditor?.field === 'point' ? qPointSelectHtml(q) : renderKnowledgePointPill(q.knowledgePoint, canManage ? q.id : null)}
                </td>
                <td class="question-action-cell">${canManage ? `<a onclick="deleteQuestion(${q.id})">删除</a>` : '<span class="text-muted text-sm">只读</span>'}</td>
              </tr>
            `).join('') || `<tr><td colspan="6" class="text-muted" style="text-align:center;padding:28px">没有符合筛选条件的题目</td></tr>`}
          </tbody>
        </table>
      </div>
      ${renderQuestionPagination(page, totalPages, filtered.length, pageSize)}
    </div>
  `;
}

function renderQuestionPagination(page, totalPages, total, pageSize) {
  if (total <= pageSize) return '';
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) pages.push(i);
  return `
    <div class="question-pagination">
      <div class="text-muted text-sm">每页 ${pageSize} 道 · 第 ${page}/${totalPages} 页</div>
      <div class="pagination-controls">
        <button class="btn btn-secondary btn-sm" onclick="setQuestionPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>
        ${start > 1 ? `<button class="pagination-page" onclick="setQuestionPage(1)">1</button>${start > 2 ? '<span class="text-muted text-sm">...</span>' : ''}` : ''}
        ${pages.map(p => `<button class="pagination-page ${p === page ? 'active' : ''}" onclick="setQuestionPage(${p})">${p}</button>`).join('')}
        ${end < totalPages ? `${end < totalPages - 1 ? '<span class="text-muted text-sm">...</span>' : ''}<button class="pagination-page" onclick="setQuestionPage(${totalPages})">${totalPages}</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="setQuestionPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `;
}

function kanbanCardHtml(q, stage) {
  return `
    <div class="kanban-card">
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px">
        <div class="kanban-card-title math-rich-text" style="flex:1;margin:0">${renderMathRichText(q.content || '')}</div>
        <button onclick="deleteQuestion(${q.id})" title="删除" style="border:none;background:none;cursor:pointer;color:var(--muted);font-size:16px;padding:0;line-height:1;flex-shrink:0" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted)'">×</button>
      </div>
      <div class="kanban-card-meta">答案：${q.answer}</div>
      <div class="kanban-card-tags">
        <span class="tag neutral">${q.knowledgePoint}</span>
      </div>
      ${stage === 'ocr' ? `<button class="btn btn-secondary btn-sm w-full" onclick="moveToReview(${q.id})">字段补全 →</button>` : ''}
      ${stage === 'review' ? `<button class="btn btn-primary btn-sm w-full" onclick="approveQuestion(${q.id})">确认入库</button>` : ''}
      ${stage === 'approved' ? `<span class="pill green" style="font-size:11px">✓ 已入库</span>` : ''}
    </div>
  `;
}

function qInitDragDrop() {
  const zone = document.getElementById('q-upload-zone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--green)'; zone.style.background = 'var(--green-light)'; });
  zone.addEventListener('dragleave', () => { zone.style.borderColor = ''; zone.style.background = ''; });
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = ''; zone.style.background = '';
    qHandleFiles(e.dataTransfer.files);
  });
}

function qTriggerUpload() {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以上传题库');
    return;
  }
  document.getElementById('q-file-input').click();
}

async function qHandleFiles(files) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以上传题库');
    return;
  }
  if (!files || files.length === 0) return;
  const zone = document.getElementById('q-upload-zone');
  const icon = document.getElementById('q-upload-icon');
  const text = document.getElementById('q-upload-text');

  zone.style.pointerEvents = 'none';
  icon.textContent = '⏳';
  text.textContent = `解析题目中（${files.length} 个文件）…`;

	  const formData = new FormData();
	  for (const f of files) formData.append('files', f);
	  let parsedTotal = 0;

	  try {
    const resp = await fetch(API + '/upload/preview', { method: 'POST', headers: apiHeaders(), body: formData });
    const data = await apiJson(resp);

	    const total = (data.results || []).reduce((sum, r) => sum + (r.questions?.length || 0), 0);
	    parsedTotal = total;
    const errFiles = (data.results || []).filter(r => r.error).map(r => r.file);
	    qImportPreview = data;
	    if (total > 0) {
	      qImportPreview.classified = false;
	      qImportPreview.classifyTotal = total;
	      qImportPreview.classifyCompleted = 0;
	      qImportPreview.classifyStatus = '题目已解析完成，正在自动判断分类。';
	      showToast(`解析完成：${total} 道题，开始自动判断分类`);
	    }
    if (errFiles.length > 0) showToast(`${errFiles.join('、')} 导入失败，请检查字段格式`);
  } catch (e) {
    showToast('上传失败：' + e.message);
  } finally {
    icon.textContent = '📤';
    text.textContent = '上传题库并预览';
	    zone.style.pointerEvents = '';
	    document.getElementById('q-file-input').value = '';
	    renderQuestions();
	    if (qImportPreview && parsedTotal > 0) {
	      setTimeout(() => classifyQuestionImportPreview(true), 0);
	    }
	  }
	}

function moveToReview(id) {
  if (!canManageSystemQuestionBank()) return;
  const q = kanbanData['pending-ocr'].find(q => q.id === id);
  if (!q) return;
  kanbanData['pending-ocr'] = kanbanData['pending-ocr'].filter(q => q.id !== id);
  q.status = 'pending-review';
  kanbanData['pending-review'].push(q);
  api.put('/questions/' + id, { status: 'pending-review' });
  renderQuestions();
  showToast('已转为待补全');
}

function approveQuestion(id) {
  if (!canManageSystemQuestionBank()) return;
  const q = kanbanData['pending-review'].find(q => q.id === id);
  if (!q) return;
  kanbanData['pending-review'] = kanbanData['pending-review'].filter(q => q.id !== id);
  q.status = 'approved';
  kanbanData['approved'].push(q);
  mockData.questions = [...kanbanData['pending-ocr'], ...kanbanData['pending-review'], ...kanbanData['approved']];
  api.put('/questions/' + id, { status: 'approved' });
  renderQuestions();
  showToast('题目已入库');
}

function deleteQuestion(id) {
  if (!canManageSystemQuestionBank()) {
    showToast('只有 test 账户可以删除题目');
    return;
  }
  ['pending-ocr', 'pending-review', 'approved'].forEach(col => {
    kanbanData[col] = kanbanData[col].filter(q => q.id !== id);
  });
  mockData.questions = mockData.questions.filter(q => q.id !== id);
  api.delete('/questions/' + id);
  renderQuestions();
  showToast('已删除');
}

// ============================================================
// HOMEWORK
// ============================================================
function renderHomework() {
  if (!currentStudent) currentStudent = mockData.students[0];
  document.getElementById('tab-homework').innerHTML = `
    <div class="flex items-center justify-between gap-12 mb-16" style="flex-wrap:wrap">
      <div class="homework-mode-toggle">
        <button class="${hwSubTab === 'generate' ? 'active' : ''}" onclick="switchHomeworkSubTab('generate')">生成作业</button>
        <button class="${hwSubTab === 'records' ? 'active' : ''}" onclick="switchHomeworkSubTab('records')">作业记录</button>
      </div>
      <div class="text-muted text-sm">${hwSubTab === 'generate' ? '配置、生成并编辑试卷' : '查询学生历史作业'}</div>
    </div>
    ${hwSubTab === 'generate' ? renderHomeworkGenerateView() : renderHomeworkRecordsView()}
  `;
  setTimeout(updateHomeworkMixVisibility, 0);
  if (hwSubTab === 'records') loadHomeworkRecords();
}

function renderHomeworkGenerateView() {
  return `
    <div class="homework-generate-layout">
      <div>
        <div class="card mb-20">
          <div class="card-title">生成个性化作业</div>
          <div class="mb-16">
            <div class="note-label" style="margin-bottom:8px">选择学生</div>
            <select id="hw-student" style="width:100%" onchange="updateHWStudent()">
              ${mockData.students.map(s => `<option value="${s.id}" ${s.id===currentStudent.id?'selected':''}>${s.name}</option>`).join('')}
            </select>
          </div>
          <div class="mb-16" id="hw-weak-points">
            ${renderHWWeakPoints(currentStudent)}
          </div>
          <div class="mb-16" id="hw-mix-section">
            <div class="note-label" style="margin-bottom:8px">综合练习配比</div>
            <div class="flex gap-8" style="flex-wrap:wrap">
              <button class="btn btn-secondary btn-sm hw-diff active-diff" data-mix='{"weak":0.7,"normal":0.3}' onclick="selectDiff(this,'重点巩固')">重点巩固 7:3</button>
              <button class="btn btn-secondary btn-sm hw-diff" data-mix='{"weak":0.5,"normal":0.5}' onclick="selectDiff(this,'均衡练习')">均衡练习 5:5</button>
              <button class="btn btn-secondary btn-sm hw-diff" data-mix='{"weak":0.3,"normal":0.7}' onclick="selectDiff(this,'轻量复盘')">轻量复盘 3:7</button>
            </div>
            <div class="text-muted text-sm" id="hw-diff-note" style="margin-top:8px">5 题时约为：薄弱点 4、非薄弱点 1</div>
          </div>
          <div class="mb-16">
            <div class="note-label" style="margin-bottom:8px">题目数量</div>
            <div class="flex gap-8">
              <button class="btn btn-secondary btn-sm hw-count active-count" onclick="selectCount(this,5)">5题</button>
              <button class="btn btn-secondary btn-sm hw-count" onclick="selectCount(this,8)">8题</button>
              <button class="btn btn-secondary btn-sm hw-count" onclick="selectCount(this,10)">10题</button>
            </div>
          </div>
          <button class="btn btn-primary w-full" onclick="generateHomework()">✨ 生成作业</button>
          <div id="hw-credit-cost">${creditCostLabel(getHomeworkCreditCost())}</div>
        </div>
      </div>
      <div id="hw-preview">
        <div class="empty-state">
          <div class="empty-icon">📄</div>
          <div class="empty-text">点击"生成作业"预览试卷</div>
        </div>
      </div>
    </div>
  `;
}

function renderHomeworkRecordsView() {
  return `
    <div class="card">
      <div class="flex items-center justify-between gap-12" style="margin-bottom:16px;flex-wrap:wrap">
        <div>
          <div class="card-title" style="margin-bottom:2px">作业记录</div>
          <div class="text-muted text-sm">按学生查看保存过的草稿和已布置作业</div>
        </div>
        <div class="flex items-center gap-8" style="flex-wrap:wrap">
          <select id="hw-record-student" onchange="updateHWRecordStudent()" style="min-width:180px">
            ${mockData.students.map(s => `<option value="${s.id}" ${s.id===currentStudent.id?'selected':''}>${s.name}</option>`).join('')}
          </select>
          <button class="btn btn-secondary btn-sm" onclick="loadHomeworkRecords()">刷新</button>
        </div>
      </div>
      <div id="hw-records">${renderHomeworkRecords()}</div>
    </div>
  `;
}

function switchHomeworkSubTab(tab) {
  hwSubTab = tab;
  renderHomework();
}

function renderHWWeakPoints(s) {
  const selected = homeworkFocusPoint?.label || '';
  const weakPoints = getStudentActualWeakPoints(s);
  const categories = getKnowledgeCategoryOptions();
  const selectedCategory = getKnowledgeCategoryByPoint(selected) || categories[0] || '';
  const categoryPoints = getKnowledgePointsByCategory(selectedCategory);
  const selectedPoint = categoryPoints.includes(selected) ? selected : '';
  return `
    <div class="note-label" style="margin-bottom:8px">练习范围</div>
    <div class="homework-mode-toggle" style="margin-bottom:10px">
      <button class="${!homeworkFocusPoint ? 'active' : ''}" onclick="clearHomeworkWeakPoint()">综合练习</button>
      <button class="${homeworkFocusPoint ? 'active' : ''}" onclick="enableHomeworkSpecialMode()">薄弱点专项练习</button>
    </div>
    ${homeworkFocusPoint ? `
      <div class="note-label" style="margin-bottom:8px">选择薄弱点</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
        ${weakPoints.length ? weakPoints.map(w => `<button class="tag ${selected === w ? 'ok' : 'weak'}" style="border:none;cursor:pointer" onclick="selectHomeworkWeakPoint('${escapeJs(w)}')">${escapeHtml(w)}</button>`).join('') : '<span class="tag neutral">该学生暂无历史薄弱点</span>'}
      </div>
      <div style="display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px;margin-bottom:8px">
        <div>
          <div class="note-label" style="margin-bottom:6px">一级分类</div>
          <select id="hw-category-select" onchange="selectHomeworkCategory(this.value)" style="width:100%">
            ${categories.map(category => `<option value="${escapeHtml(category)}" ${selectedCategory === category ? 'selected' : ''}>${escapeHtml(category)}</option>`).join('')}
          </select>
        </div>
        <div>
          <div class="note-label" style="margin-bottom:6px">二级分类</div>
          <select id="hw-point-select" onchange="selectHomeworkWeakPoint(this.value)" style="width:100%">
            <option value="" ${selectedPoint ? '' : 'selected'}>选择二级分类</option>
            ${categoryPoints.map(point => `<option value="${escapeHtml(point)}" ${selectedPoint === point ? 'selected' : ''}>${escapeHtml(point)}</option>`).join('')}
          </select>
        </div>
      </div>
    ` : `
      <div class="text-muted text-sm">综合练习会按薄弱点题目和非薄弱点题目的比例自动选题。</div>
    `}
  `;
}

function homeworkKnowledgePointOptions(student) {
  const fromStudent = student ? getStudentActualWeakPoints(student) : [];
  const fromQuestions = qKnowledgePointOptions();
  return [...new Set([...fromStudent, ...fromQuestions])].filter(Boolean);
}

function selectHomeworkWeakPoint(label) {
  if (!label) return;
  homeworkFocusPoint = { label };
  const box = document.getElementById('hw-weak-points');
  if (box) box.innerHTML = renderHWWeakPoints(currentStudent);
  updateHomeworkMixVisibility();
}

function selectHomeworkCategory(category) {
  const firstPoint = getKnowledgePointsByCategory(category)[0];
  if (!firstPoint) return;
  selectHomeworkWeakPoint(firstPoint);
}

function enableHomeworkSpecialMode() {
  const firstWeakPoint = getStudentActualWeakPoints(currentStudent || {}).find(isStandardKnowledgePoint);
  const first = firstWeakPoint || homeworkKnowledgePointOptions(currentStudent)[0] || '专项练习';
  homeworkFocusPoint = { label: first };
  const box = document.getElementById('hw-weak-points');
  if (box) box.innerHTML = renderHWWeakPoints(currentStudent);
  updateHomeworkMixVisibility();
}

function clearHomeworkWeakPoint() {
  homeworkFocusPoint = null;
  const box = document.getElementById('hw-weak-points');
  if (box) box.innerHTML = renderHWWeakPoints(currentStudent);
  updateHomeworkMixVisibility();
}

function updateHomeworkMixVisibility() {
  const section = document.getElementById('hw-mix-section');
  if (section) section.style.display = homeworkFocusPoint ? 'none' : '';
}

function renderHomeworkRecords() {
  if (!hwRecords.length) return '<div class="text-muted text-sm">暂无保存记录</div>';
  const pageSize = 7;
  const totalPages = Math.max(1, Math.ceil(hwRecords.length / pageSize));
  hwRecordPage = Math.min(Math.max(1, hwRecordPage), totalPages);
  const start = (hwRecordPage - 1) * pageSize;
  const pageRecords = hwRecords.slice(start, start + pageSize);
  return `
    <div class="homework-record-list">
      ${pageRecords.map((r, idx) => {
        const recordIndex = start + idx;
        const questions = Array.isArray(r.questions) ? r.questions : [];
        const created = r.created_at ? new Date(r.created_at).toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '未知时间';
        const statusLabel = { draft: '草稿', assigned: '已布置', printed: '已打印' }[r.status] || r.status || '草稿';
        const points = [...new Set(questions.map(q => q.knowledgePoint).filter(Boolean))].slice(0, 3).join('、') || '综合练习';
        const version = r.version || recordIndex + 1;
        const avoided = r.meta?.report?.reusedRecent
          ? ` · ${r.meta.report.reusedRecent} 道近期题`
          : r.meta?.avoidedRecent ? ` · 已避重` : '';
        return `
          <div class="homework-record-item" onclick="viewHomeworkRecord(${recordIndex})">
            <div class="homework-record-main">
              <div class="homework-record-title">V${version} · ${questions.length} 道题 · ${statusLabel}</div>
              <div class="homework-record-meta">${points} · ${created}${avoided}</div>
            </div>
            <button class="homework-record-delete" onclick="deleteHomeworkRecord(event, ${r.id})">删除</button>
          </div>
        `;
      }).join('')}
    </div>
    <div class="homework-record-pagination">
      <button class="student-page-btn" onclick="setHomeworkRecordPage(${hwRecordPage - 1})" ${hwRecordPage <= 1 ? 'disabled' : ''}>上一页</button>
      <div class="homework-page-info">${hwRecordPage} / ${totalPages}</div>
      <button class="student-page-btn" onclick="setHomeworkRecordPage(${hwRecordPage + 1})" ${hwRecordPage >= totalPages ? 'disabled' : ''}>下一页</button>
    </div>
  `;
}

function setHomeworkRecordPage(page) {
  hwRecordPage = page;
  const box = document.getElementById('hw-records');
  if (box) box.innerHTML = renderHomeworkRecords();
}

async function loadHomeworkRecords() {
  if (!currentStudent) return;
  const box = document.getElementById('hw-records');
  if (box) box.innerHTML = '<div class="loading-wrap"><div class="spinner"></div>加载记录...</div>';
  try {
    hwRecords = await api.get('/homework/student/' + currentStudent.id);
    if (box) box.innerHTML = renderHomeworkRecords();
  } catch (err) {
    if (box) box.innerHTML = '<div class="text-muted text-sm">记录加载失败</div>';
  }
}

function updateHWRecordStudent() {
  const id = parseInt(document.getElementById('hw-record-student').value);
  currentStudent = mockData.students.find(s => s.id === id) || currentStudent;
  hwRecords = [];
  hwRecordPage = 1;
  loadHomeworkRecords();
}

function viewHomeworkRecord(index) {
  const record = hwRecords[index];
  if (!record) return;
  hwPreviewMode = 'preview';
  hwDraft = {
    ok: true,
    id: record.id,
    version: record.version,
    meta: record.meta || {},
    title: record.title || '',
    questions: (record.questions || []).map((q, i) => ({ ...q, n: i + 1 }))
  };
  hwSubTab = 'generate';
  renderHomework();
  renderHomeworkPreview(record.questions || [], { saved: true, recordId: record.id });
}

async function deleteHomeworkRecord(event, id) {
  event?.stopPropagation();
  const record = hwRecords.find(r => Number(r.id) === Number(id));
  if (!record) return;
  const ok = window.confirm('确定删除这条作业记录吗？\n\n删除后无法恢复。');
  if (!ok) return;
  try {
    const result = await api.delete('/homework/' + id);
    if (result?.error) throw new Error(result.error);
    hwRecords = hwRecords.filter(r => Number(r.id) !== Number(id));
    const totalPages = Math.max(1, Math.ceil(hwRecords.length / 7));
    hwRecordPage = Math.min(hwRecordPage, totalPages);
    const box = document.getElementById('hw-records');
    if (box) box.innerHTML = renderHomeworkRecords();
    showToast('作业记录已删除');
  } catch (err) {
    showToast('删除失败：' + (err.message || '请稍后重试'));
  }
}

function renderHomeworkPreview(questions, options = {}) {
  const s = currentStudent;
  const today = new Date().toLocaleDateString('zh-CN', { year:'numeric', month:'long', day:'numeric' });
  const report = hwDraft?.report || hwDraft?.meta?.report;
  document.getElementById('hw-preview').innerHTML = `
    <div>
      ${options.insufficient ? '<div class="note-block no-print" style="border:1px solid var(--orange);background:var(--orange-light);margin-bottom:12px">题库数量不足，本次只生成已入库的可用题目；请到题库管理补充题目后再生成。</div>' : ''}
      ${options.saved ? `<div class="note-block no-print" style="margin-bottom:12px">正在查看已保存记录 #${options.recordId}</div>` : ''}
      <div class="flex items-center justify-between gap-12 no-print" style="margin-bottom:12px;flex-wrap:wrap">
        <div class="homework-mode-toggle">
          <button class="${hwPreviewMode === 'edit' ? 'active' : ''}" onclick="setHomeworkPreviewMode('edit')">编辑</button>
          <button class="${hwPreviewMode === 'preview' ? 'active' : ''}" onclick="setHomeworkPreviewMode('preview')">预览</button>
        </div>
        <div class="text-muted text-sm">${hwPreviewMode === 'edit' ? '可编辑题干和答案' : '预览模式会隐藏答案'}</div>
      </div>
      <div class="worksheet ${hwPreviewMode === 'preview' ? 'homework-preview-mode' : ''}" id="worksheet-print">
        <div class="worksheet-header">
          <div class="worksheet-title" contenteditable="${hwPreviewMode === 'edit'}" id="hw-title">${hwDraft?.title || '三年级数学个性化练习'}</div>
          <div class="worksheet-info">
            <span>姓名：${s.name}　　</span>
            <span>日期：${today}　　</span>
            <span>得分：______</span>
          </div>
        </div>
        ${questions.map((q, i) => `
          <div class="worksheet-q ${q.sourceImage ? 'has-image' : ''} ${q.type === '应用题' ? 'long-answer' : ''}" data-hw-q-index="${i}">
            <div class="worksheet-tools edit-only">
              <button class="worksheet-tool-btn" onclick="moveHomeworkQuestion(${i}, -1)">上移</button>
              <button class="worksheet-tool-btn" onclick="moveHomeworkQuestion(${i}, 1)">下移</button>
              <button class="worksheet-tool-btn" onclick="replaceHomeworkQuestion(${i})">换题</button>
              <button class="worksheet-tool-btn" onclick="deleteHomeworkQuestion(${i})">删除</button>
            </div>
            <div><span class="worksheet-q-num">${i + 1}.</span><span class="worksheet-editable" contenteditable="${hwPreviewMode === 'edit'}" data-field="content">${q.content || ''}</span></div>
            ${q.sourceImage ? `<div class="worksheet-source-image"><img src="${escapeHtml(q.sourceImage)}" alt="题目配图"></div>` : ''}
            <span class="hw-answer-line" data-field="answer" hidden>${q.answer || ''}</span>
            <div class="worksheet-answer-space" aria-hidden="true"></div>
          </div>
        `).join('')}
      </div>
      <div class="flex gap-12 no-print" style="margin-top:16px;flex-wrap:wrap">
        <button class="btn btn-primary" onclick="window.print()">🖨️ 打印 / 导出PDF</button>
        <button class="btn btn-secondary" onclick="saveHomeworkDraft('draft')">💾 保存草稿</button>
        <button class="btn btn-secondary" onclick="saveHomeworkDraft('assigned')">标记已布置</button>
      </div>
    </div>
  `;
}

function renderHomeworkReportText(report) {
  const parts = [];
  if (report.avoidedRecent) parts.push(`已参考最近 ${report.avoidedRecent} 道历史题`);
  if (report.reusedRecent) parts.push(`其中 ${report.reusedRecent} 道因题量不足使用了近期题`);
  else if (report.avoidedRecent) parts.push('本次已尽量避开近期重复题');
  if (report.shortage) parts.push(`题库不足，少生成 ${report.shortage} 道，请补充题库后再生成`);
  const weakMix = report.actualWeakPointMix || {};
  if (weakMix.weak !== undefined || weakMix.normal !== undefined) {
    parts.push(`实际配比：薄弱点 ${weakMix.weak || 0}、非薄弱点 ${weakMix.normal || 0}`);
  }
  return parts.join('；') || '已生成作业。';
}

function collectEditedHomeworkQuestions() {
  const rows = [...document.querySelectorAll('[data-hw-q-index]')];
  return rows.map((row, i) => {
    const original = hwDraft?.questions?.[i] || {};
    const meta = row.querySelector('[data-field="reason"]')?.textContent || '';
    return {
      ...original,
      n: i + 1,
      content: row.querySelector('[data-field="content"]')?.textContent.trim() || original.content || '',
      answer: row.querySelector('[data-field="answer"]')?.textContent.trim() || original.answer || '',
      reason: meta.replace(/^推荐理由：/, '').split('·')[0]?.trim() || original.reason || '',
    };
  });
}

function refreshHomeworkPreviewFromDraft(options = {}) {
  if (!hwDraft?.questions?.length) return;
  renderHomeworkPreview(hwDraft.questions, options);
}

function syncHomeworkDraftFromEditor() {
  if (!hwDraft?.questions?.length) return;
  const edited = collectEditedHomeworkQuestions();
  if (edited.length) hwDraft.questions = edited;
}

function setHomeworkPreviewMode(mode) {
  syncHomeworkDraftFromEditor();
  hwPreviewMode = mode;
  refreshHomeworkPreviewFromDraft();
}

function moveHomeworkQuestion(index, delta) {
  syncHomeworkDraftFromEditor();
  const next = index + delta;
  if (!hwDraft?.questions || next < 0 || next >= hwDraft.questions.length) return;
  const list = hwDraft.questions;
  [list[index], list[next]] = [list[next], list[index]];
  hwDraft.questions = list.map((q, i) => ({ ...q, n: i + 1 }));
  refreshHomeworkPreviewFromDraft();
}

function deleteHomeworkQuestion(index) {
  syncHomeworkDraftFromEditor();
  if (!hwDraft?.questions?.length) return;
  hwDraft.questions.splice(index, 1);
  hwDraft.questions = hwDraft.questions.map((q, i) => ({ ...q, n: i + 1 }));
  refreshHomeworkPreviewFromDraft();
}

async function replaceHomeworkQuestion(index) {
  syncHomeworkDraftFromEditor();
  const current = hwDraft?.questions?.[index];
  if (!current) return;
  const usedIds = (hwDraft.questions || []).map(q => q.id).filter(Boolean);
  try {
    const data = await api.post('/homework/replace-question', {
      studentId: currentStudent.id,
      currentId: current.id,
      usedIds,
      knowledgePoint: current.knowledgePoint || homeworkFocusPoint?.label || '',
      difficulty: current.difficulty || '',
      seed: Date.now() + ':' + index
    });
    if (!data.ok) throw new Error(data.error || '换题失败');
    hwDraft.questions[index] = { ...data.question, n: index + 1 };
    refreshHomeworkPreviewFromDraft();
    showToast('已替换 1 道题');
  } catch (err) {
    showToast('换题失败：' + err.message);
  }
}

function updateHWStudent() {
  const id = parseInt(document.getElementById('hw-student').value);
  currentStudent = mockData.students.find(s => s.id === id);
  homeworkFocusPoint = null;
  hwDraft = null;
  hwRecords = [];
  hwRecordPage = 1;
  document.getElementById('hw-weak-points').innerHTML = renderHWWeakPoints(currentStudent);
  updateHomeworkMixVisibility();
  document.getElementById('hw-preview').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">📄</div>
      <div class="empty-text">点击"生成作业"预览试卷</div>
    </div>
  `;
  loadHomeworkRecords();
}

function selectDiff(btn, diff) {
  document.querySelectorAll('.hw-diff').forEach(b => b.classList.remove('active-diff'));
  btn.classList.add('active-diff');
  btn.style.background = 'var(--green)';
  btn.style.color = 'white';
  document.querySelectorAll('.hw-diff:not(.active-diff)').forEach(b => { b.style.background=''; b.style.color=''; });
  updateDifficultyNote();
}

function selectCount(btn, n) {
  document.querySelectorAll('.hw-count').forEach(b => { b.classList.remove('active-count'); b.style.background=''; b.style.color=''; });
  btn.classList.add('active-count');
  btn.style.background = 'var(--green)';
  btn.style.color = 'white';
  const costEl = document.getElementById('hw-credit-cost');
  if (costEl) costEl.innerHTML = creditCostLabel(getHomeworkCreditCost());
  updateDifficultyNote();
}

function getHomeworkCreditCost() {
  const countText = document.querySelector('.hw-count.active-count')?.textContent || '5题';
  const count = parseInt(countText, 10) || 5;
  return creditCosts.homeworkBase + count * creditCosts.homeworkPerQuestion;
}

function getActiveWeakPointMix() {
  const btn = document.querySelector('.hw-diff.active-diff');
  try {
    return JSON.parse(btn?.dataset.mix || '{"weak":0.7,"normal":0.3}');
  } catch {
    return { weak: 0.7, normal: 0.3 };
  }
}

function getWeakPointQuotas(count, mix = getActiveWeakPointMix()) {
  const keys = ['weak', 'normal'];
  const raw = keys.map(key => ({ key, value: count * (mix[key] || 0) }));
  const quotas = Object.fromEntries(raw.map(r => [r.key, Math.floor(r.value)]));
  let remaining = count - Object.values(quotas).reduce((sum, n) => sum + n, 0);
  raw
    .sort((a, b) => (b.value - Math.floor(b.value)) - (a.value - Math.floor(a.value)))
    .forEach(r => {
      if (remaining > 0) {
        quotas[r.key] += 1;
        remaining -= 1;
      }
    });
  return quotas;
}

function updateDifficultyNote() {
  const countText = document.querySelector('.hw-count.active-count')?.textContent || '5题';
  const count = parseInt(countText, 10) || 5;
  const q = getWeakPointQuotas(count);
  const note = document.getElementById('hw-diff-note');
  if (note) note.textContent = `${count} 题时约为：薄弱点 ${q.weak || 0}、非薄弱点 ${q.normal || 0}`;
}

async function generateHomework() {
  const btn = event.currentTarget;
  const countText = document.querySelector('.hw-count.active-count')?.textContent || '5题';
  const count = parseInt(countText, 10) || 5;
  const weakPointMix = getActiveWeakPointMix();
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div> 生成中...';

  try {
    const data = await api.post('/homework/generate', {
      studentId: currentStudent.id,
      weakPointMix,
      count,
      knowledgePoint: homeworkFocusPoint?.label || '',
      seed: Date.now()
    });
    if (!data.ok) throw new Error(data.error || '生成失败');

    hwDraft = data;
    btn.disabled = false;
    btn.innerHTML = '✨ 生成作业';
    const s = currentStudent;
    const questions = data.questions.map((q, i) => ({ ...q, n: i + 1 }));
    hwPreviewMode = 'edit';
    hwDraft.questions = questions;
    hwDraft.report = data.report || {};
    hwDraft.meta = { avoidedRecent: data.avoidedRecent || 0, report: data.report || {}, weakPointMix, knowledgePoint: homeworkFocusPoint?.label || '' };
    hwDraft.title = '三年级数学个性化练习';
    renderHomeworkPreview(questions, { insufficient: data.insufficient });
    applyCreditSummary(data.credit);
    const shortageText = data.insufficient ? '（题库不足，仅使用已入库题目）' : '';
    showToast(`作业生成完成：${questions.length} 道题${shortageText}`);
  } catch (err) {
    showToast('生成失败：' + apiErrorMessage(err));
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ 生成作业';
  }
}

async function saveHomeworkDraft(status = 'draft') {
  if (!hwDraft || !hwDraft.questions?.length) {
    showToast('请先生成作业');
    return;
  }
  const editedQuestions = collectEditedHomeworkQuestions();
  if (!editedQuestions.length || editedQuestions.some(q => !q.content)) {
    showToast('请先补全题目内容');
    return;
  }
  hwDraft.questions = editedQuestions;
  const title = document.getElementById('hw-title')?.textContent.trim() || hwDraft.title || '三年级数学个性化练习';
  hwDraft.title = title;
  try {
    const data = await api.post('/homework', {
      studentId: currentStudent.id,
      questions: editedQuestions,
      title,
      meta: hwDraft.meta || {},
      status
    });
    if (!data.ok) throw new Error(data.error || '保存失败');
    showToast(status === 'assigned' ? `已标记为已布置 V${data.version}` : `已保存到作业记录 V${data.version}`);
    loadHomeworkRecords();
  } catch (err) {
    showToast('保存失败：' + err.message);
  }
}

// ============================================================
// MISTAKES
// ============================================================
// 错题分析：学生当前批改会话状态
let mistakeSession = {
  studentId: null,
  selectedHomeworkId: '',
  homeworkRecords: [],
  homeworkLoaded: false,
  homeworkLoading: false,
  homeworkError: '',
  ocrItems: [],         // [{id, questionId, content, knowledgePoint}] 当前所选作业题目
  wrongIds: new Set(),  // 老师标记为做错的题目 id
  correctIds: new Set(),// 老师明确打勾的题；未选择也默认正确
  ocrDone: false,
  ocrError: '',
  analyzing: false,
  analysis: null,       // {weakPoints, knowledgeStats, itemAnalyses, fallback}
  reviews: {},          // { itemId: { knowledgePoint } }
  page: 1,
  saved: false
};

// ============================================================
// AGENT (AI 助教)
// ============================================================
const teacherAgent = {
  created: true,
  name: '陈老师的 AI 助教',
  status: 'running',
  statusLabel: '运行中',
  feishuStatus: 'pending',
  feishuAppId: '',
  feishuMode: 'websocket',
  feishuSessionId: '',
  today: { photos: 0, questions: 0, feedbacks: 0 },
  abilities: [
    { id: 'study_query', name: '学情查询', desc: '老师可询问学生薄弱点、近期错题和跟进建议', on: true, scope: '老师私聊 / 网页端' },
    { id: 'mistake_photo', name: '错题登记', desc: '从已生成作业中标记错题，生成薄弱点', on: true, scope: '老师确认后写入档案' },
    { id: 'homework_generate', name: '作业生成', desc: '根据学生薄弱点生成个性化练习', on: true, scope: '网页端生成' },
    { id: 'group_auto_reply', name: '家长群自动回复', desc: '在家长群内自动回答允许范围内的问题', on: false, scope: '默认关闭' }
  ],
  entrances: [
    { id: 'web', name: '网页端对话', desc: '老师在工作台里直接指挥助教', status: 'active', statusLabel: '已启用' },
    { id: 'feishu_dm', name: '飞书私聊', desc: '老师在飞书私聊机器人，查询学情或生成反馈', status: 'pending', statusLabel: '待接入' },
    { id: 'feishu_group', name: '飞书家长群', desc: '机器人进入家长群，接收家长问题和老师确认后的反馈', status: 'pending', statusLabel: '待绑定' },
    { id: 'wecom', name: '企业微信', desc: '后续支持机构常用企业微信群', status: 'planned', statusLabel: '规划中' }
  ]
};

const agentFeishuSteps = [
  { name: '创建或授权飞书应用', status: 'todo' },
  { name: '配置机器人回调地址', status: 'todo' },
  { name: '绑定老师私聊入口', status: 'todo' },
  { name: '选择需要接入的家长群', status: 'todo' },
  { name: '发送测试消息', status: 'todo' }
];

const agentBoundGroups = [
  { id: 1, platform: 'feishu', name: '三年级2班·家长群', students: 12, lastActive: '—', enabled: false },
  { id: 2, platform: 'feishu', name: '三年级3班·家长群', students: 8, lastActive: '—', enabled: false }
];

const agentWorkLog = [
  { id: 1, type: '配置', title: 'AI 助教已创建', detail: '已绑定学生档案、题库和错题分析能力', time: '刚刚', status: 'done' },
  { id: 2, type: '待办', title: '飞书入口待接入', detail: '完成授权后，老师可在飞书私聊里指挥助教', time: '待处理', status: 'todo' }
];

let agentChatMessages = [
  { role: 'assistant', text: '你好，我可以帮你查学生学情、整理错题薄弱点，也可以根据薄弱点生成练习。' }
];

function renderAgent() {
  const a = teacherAgent;
  document.getElementById('tab-agent').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 360px;gap:20px;align-items:start">
      <div>
        <div class="card" style="height:calc(100vh - 150px);min-height:560px;max-height:760px;display:flex;flex-direction:column;overflow:hidden">
          <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:16px">
            <div style="width:38px;height:38px;border-radius:12px;background:var(--green-light);color:var(--green);display:flex;align-items:center;justify-content:center;font-size:19px;flex-shrink:0">✦</div>
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px">
                <div class="card-title" style="margin:0">${a.name}</div>
                <span class="pill green">网页端可用</span>
              </div>
              <div class="card-sub" style="margin:0">可以问学生学情、整理错题薄弱点、生成练习。</div>
            </div>
          </div>

          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            ${[
              '今天哪些学生需要关注？',
              '总结张小雨最近学情',
              '根据薄弱点生成 5 道练习',
              '整理本周新增薄弱点'
            ].map(text => `<button class="btn btn-secondary btn-sm" onclick="agentUsePrompt('${text}')">${text}</button>`).join('')}
          </div>

          <div id="agent-chat-list" style="flex:1;min-height:0;border:1px solid var(--line);border-radius:14px;background:var(--bg);padding:14px;overflow-y:auto;margin-bottom:12px">
            ${agentChatMessages.map(msg => `
              <div style="display:flex;justify-content:${msg.role === 'user' ? 'flex-end' : 'flex-start'};margin-bottom:10px">
                <div style="max-width:78%;padding:10px 12px;border-radius:12px;background:${msg.role === 'user' ? 'var(--green)' : 'white'};color:${msg.role === 'user' ? 'white' : 'var(--text)'};border:1px solid ${msg.role === 'user' ? 'var(--green)' : 'var(--line)'};font-size:14px;line-height:1.65;white-space:normal">
                  ${renderAgentMessage(msg.text)}
                </div>
              </div>
            `).join('')}
          </div>

          <div style="display:flex;gap:8px;align-items:flex-end;flex-shrink:0">
            <textarea id="agent-input" rows="2" placeholder="问 AI 助教，比如：帮我看看张小雨最近需要补什么" style="flex:1;resize:none;border:1px solid var(--line);border-radius:12px;background:white;padding:10px 12px;font-size:14px;line-height:1.5;outline:none" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();agentSendMessage()}"></textarea>
            <button class="btn btn-primary" onclick="agentSendMessage()">发送</button>
          </div>
        </div>
      </div>

      <div>
        <div class="card mb-20">
          <div class="card-title">接入状态</div>
          <div style="display:flex;flex-direction:column;gap:9px">
            ${agentConnectionRows().map(([name, status, cls]) => `
              <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--panel)">
                <span style="font-size:13px;font-weight:800">${name}</span>
                <span class="pill ${cls}">${status}</span>
              </div>
            `).join('')}
          </div>
          <button class="btn btn-primary btn-sm" style="width:100%;margin-top:12px" onclick="agentConfigureFeishu()">${a.feishuStatus === 'connected' ? '查看飞书配置' : '接入飞书'}</button>
        </div>

        <div class="card mb-20">
          <div class="card-title">安全设置</div>
          <div style="display:flex;flex-direction:column;gap:12px">
            <div style="display:flex;align-items:flex-start;gap:10px">
              <div style="flex:1">
                <div style="font-size:13px;font-weight:800;margin-bottom:3px">家长群自动回复</div>
                <div class="text-muted text-sm">建议先关闭，等话术稳定后再开启。</div>
              </div>
              ${renderAgentSwitch(teacherAgent.abilities.find(x => x.id === 'group_auto_reply'))}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">最近工作</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            ${agentWorkLog.map(log => `
              <div style="border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--panel)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                  <span class="pill ${log.status === 'done' ? 'green' : 'orange'}">${log.type}</span>
                  <span class="text-muted text-sm">${log.time}</span>
                </div>
                <div style="font-size:13px;font-weight:800;margin-bottom:3px">${log.title}</div>
                <div class="text-muted text-sm">${log.detail}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderAgentSwitch(item) {
  if (!item) return '';
  return `
    <label style="position:relative;display:inline-block;width:38px;height:22px;flex-shrink:0;margin-top:2px">
      <input type="checkbox" ${item.on?'checked':''} onchange="agentToggleAbility('${item.id}')" style="opacity:0;width:0;height:0">
      <span style="position:absolute;cursor:pointer;top:0;left:0;right:0;bottom:0;background:${item.on?'var(--green)':'#d8d2c5'};border-radius:22px;transition:.2s"></span>
      <span style="position:absolute;height:18px;width:18px;left:${item.on?'18px':'2px'};top:2px;background:white;border-radius:50%;transition:.2s"></span>
    </label>
  `;
}

function agentUsePrompt(text) {
  const input = document.getElementById('agent-input');
  if (input) input.value = text;
  agentSendMessage();
}

async function agentSendMessage() {
  const input = document.getElementById('agent-input');
  const text = String(input?.value || '').trim();
  if (!text) { showToast('先输入你想问助教的问题'); return; }
  agentChatMessages.push({ role: 'user', text });
  const pending = { role: 'assistant', text: '正在思考…' };
  agentChatMessages.push(pending);
  if (input) input.value = '';
  renderAgent();
  agentScrollChat();
  try {
    const resp = await fetch(API + '/agent/chat/stream', {
      method: 'POST',
      headers: apiHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        messages: agentChatMessages
          .filter(m => m !== pending)
          .map(m => ({ role: m.role, content: m.text }))
      })
    });
    if (!resp.ok || !resp.body) {
      let message = 'AI 助教回复失败';
      try {
        const data = await resp.json();
        message = data.error || message;
      } catch {}
      throw new Error(message);
    }
    pending.text = '';
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      pending.text += decoder.decode(value, { stream: true });
      renderAgent();
      agentScrollChat();
    }
    if (!pending.text.trim()) pending.text = 'AI 助教暂时没有返回内容。';
  } catch (err) {
    pending.text = '连接 AI 助教失败：' + err.message;
  }
  renderAgent();
  agentScrollChat();
}

function agentScrollChat() {
  setTimeout(() => {
    const list = document.getElementById('agent-chat-list');
    if (list) list.scrollTop = list.scrollHeight;
  }, 0);
}

function renderAgentEntranceAction(e) {
  if (e.status === 'active') return `<button class="btn btn-secondary btn-sm" onclick="agentOpenChat()">打开</button>`;
  if (e.id.startsWith('feishu')) return `<button class="btn btn-primary btn-sm" onclick="agentConfigureFeishu()">配置</button>`;
  return `<button class="btn btn-secondary btn-sm" disabled style="opacity:0.55">敬请期待</button>`;
}

function agentOpenChat() {
  showToast('网页端对话面板后续接入 Agent 服务后开放');
}

function agentToggleAbility(id) {
  const item = teacherAgent.abilities.find(x => x.id === id);
  if (!item) return;
  item.on = !item.on;
  renderAgent();
  showToast(`${item.name}已${item.on ? '开启' : '关闭'}`);
}

function agentConnectionRows() {
  const connected = teacherAgent.feishuStatus === 'connected';
  return [
    ['网页端', '已启用', 'green'],
    ['飞书私聊', connected ? '已接入' : '待接入', connected ? 'green' : 'orange'],
    ['飞书家长群', connected ? '可绑定' : '待绑定', connected ? 'orange' : 'gray']
  ];
}

function agentConfigureFeishu() {
  toggleFeishuModal(true);
}

function toggleFeishuModal(show) {
  const modal = document.getElementById('feishu-modal');
  modal?.classList.toggle('show', show);
  if (!show) return;
  document.getElementById('feishu-advanced-panel')?.classList.remove('show');
  const simpleActions = document.getElementById('feishu-simple-actions');
  if (simpleActions) simpleActions.style.display = '';
  const appId = document.getElementById('feishu-app-id');
  const secret = document.getElementById('feishu-app-secret');
  if (appId) appId.value = teacherAgent.feishuAppId || '';
  if (secret) secret.value = '';
  const mode = document.querySelector(`input[name="feishu-connect-mode"][value="${teacherAgent.feishuMode || 'websocket'}"]`);
  if (mode) mode.checked = true;
}

function toggleFeishuAdvanced() {
  const panel = document.getElementById('feishu-advanced-panel');
  panel?.classList.toggle('show');
  const simpleActions = document.getElementById('feishu-simple-actions');
  if (simpleActions) simpleActions.style.display = panel?.classList.contains('show') ? 'none' : '';
}

async function agentOneClickFeishu() {
  const btn = document.getElementById('feishu-one-click-btn');
  const status = document.getElementById('feishu-one-click-status');
  if (btn) btn.disabled = true;
  if (status) status.textContent = '正在生成飞书创建链接…';
  try {
    const resp = await fetch(API + '/feishu/one-click/start', { method: 'POST', headers: apiHeaders() });
    const data = await apiJson(resp);
    if (!data.ok) throw new Error(data.error || '飞书创建链接生成失败');
    teacherAgent.feishuSessionId = data.id;
    if (status) status.textContent = `链接已生成，将在 ${data.expireIn || 600} 秒后过期。请在飞书中完成确认。`;
    window.open(data.url, '_blank', 'noopener,noreferrer');
    agentPollFeishuStatus(data.id);
  } catch (err) {
    if (status) status.textContent = '生成失败：' + err.message;
    showToast('飞书一键接入失败：' + err.message);
    if (btn) btn.disabled = false;
  }
}

async function agentPollFeishuStatus(sessionId) {
  const statusEl = document.getElementById('feishu-one-click-status');
  const btn = document.getElementById('feishu-one-click-btn');
  for (let i = 0; i < 150; i++) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
      const resp = await fetch(API + '/feishu/one-click/status/' + sessionId, { headers: apiHeaders() });
      const data = await apiJson(resp);
      if (!data.ok) throw new Error(data.error || '查询接入状态失败');
      if (data.status === 'connected') {
        teacherAgent.feishuStatus = 'connected';
        teacherAgent.feishuAppId = data.appId;
        teacherAgent.feishuMode = 'one-click';
        agentWorkLog.unshift({
          id: Date.now(),
          type: '配置',
          title: '飞书一键创建已完成',
          detail: `已创建机器人应用 · ${data.appId}`,
          time: '刚刚',
          status: 'done'
        });
        agentWorkLog.splice(4);
        toggleFeishuModal(false);
        renderAgent();
        showToast('飞书机器人已创建并接入');
        return;
      }
      if (data.status === 'failed') throw new Error(data.error || '飞书创建失败');
      if (statusEl) statusEl.textContent = data.status === 'waiting' ? '等待飞书确认中…' : `当前状态：${data.status}`;
    } catch (err) {
      if (statusEl) statusEl.textContent = '接入失败：' + err.message;
      showToast('飞书接入失败：' + err.message);
      if (btn) btn.disabled = false;
      return;
    }
  }
  if (statusEl) statusEl.textContent = '接入超时，请重新生成链接';
  if (btn) btn.disabled = false;
}

function agentRegisterFeishu() {
  const appId = String(document.getElementById('feishu-app-id')?.value || '').trim();
  const secret = String(document.getElementById('feishu-app-secret')?.value || '').trim();
  const mode = document.querySelector('input[name="feishu-connect-mode"]:checked')?.value || 'websocket';
  if (!appId || !secret) {
    showToast('请填写 App ID 和 App Secret');
    return;
  }
  if (!/^cli_[A-Za-z0-9_-]{8,}$/.test(appId)) {
    showToast('App ID 格式看起来不正确');
    return;
  }
  teacherAgent.feishuStatus = 'connected';
  teacherAgent.feishuAppId = appId;
  teacherAgent.feishuMode = mode;
  agentWorkLog.unshift({
    id: Date.now(),
    type: '配置',
    title: '飞书通道已注册',
    detail: `${mode === 'websocket' ? 'WebSocket 长连接' : 'URL 回调'} · ${appId}`,
    time: '刚刚',
    status: 'done'
  });
  agentWorkLog.splice(4);
  toggleFeishuModal(false);
  renderAgent();
  showToast('飞书通道已注册');
}

function agentAddGroup() {
  showToast('完成飞书授权后，可从这里选择并绑定家长群');
}

function agentToggleGroup(id) {
  const g = agentBoundGroups.find(x => x.id === id);
  if (!g) return;
  g.enabled = !g.enabled;
  renderAgent();
  showToast(g.enabled ? '群内回复已启用' : '群内回复已暂停');
}

function renderMistakes() {
  if (!currentStudent) currentStudent = mockData.students[0];
  const s = currentStudent;
  const sess = mistakeSession;
  // 切换学生时重置会话
  if (sess.studentId !== s.id) {
    sess.studentId = s.id;
    sess.selectedHomeworkId = '';
    sess.homeworkRecords = [];
    sess.homeworkLoaded = false;
    sess.homeworkLoading = false;
    sess.homeworkError = '';
    sess.ocrItems = [];
    sess.wrongIds = new Set();
    sess.correctIds = new Set();
    sess.ocrDone = false;
    sess.ocrError = '';
    sess.analysis = null;
    sess.reviews = {};
    sess.saved = false;
  }
  const historyWeakPoints = getStudentActualWeakPoints(s);

  document.getElementById('tab-mistakes').innerHTML = `
    <div style="display:grid;grid-template-columns:340px minmax(0,1fr);gap:20px;align-items:stretch;height:620px">

      <!-- 左列：选学生 + 选作业 + 历史薄弱点 -->
      <div style="display:flex">
        <div class="card" style="width:100%;height:620px;overflow:auto">
          <div class="card-title">作业错题分析</div>
          <div class="card-sub">选择已生成作业 → 标记对错 → 确认两级分类 → 写入学生档案</div>

          <div class="flex items-center gap-12 mb-16">
            <span class="text-sm text-muted" style="white-space:nowrap">学生：</span>
            <select id="mistake-student" style="flex:1" onchange="mistakeChangeStudent()">
              ${mockData.students.map(st => `<option value="${st.id}" ${st.id===s.id?'selected':''}>${st.name}</option>`).join('')}
            </select>
          </div>

          <div class="flex gap-12" style="align-items:flex-start;margin:-4px 0 16px">
            <span class="text-sm text-muted" style="white-space:nowrap;padding-top:7px">历史薄弱点：</span>
            <div style="flex:1;min-height:38px;display:flex;align-items:center;flex-wrap:wrap;gap:6px;padding:6px 0">
              ${historyWeakPoints.length
                ? historyWeakPoints.map(w => `<span class="tag weak">${w}</span>`).join('')
                : '<span class="text-muted text-sm">暂无记录</span>'}
            </div>
          </div>

          <div class="mb-16">
            <div class="note-label" style="margin-bottom:8px">选择作业</div>
            ${renderMistakeHomeworkSelect(sess)}
          </div>
        </div>
      </div>

      <!-- 右列：作业题目 + 判题 + 分析 -->
      <div style="display:flex;min-width:0">
        <div class="card" id="mistake-main" style="width:100%;min-width:0;height:620px;overflow:hidden;display:flex;flex-direction:column">
          ${renderMistakeMain(sess)}
        </div>
      </div>
    </div>
  `;
  loadStudentProfile(s.id);
  loadMistakeHomeworkRecords(s.id);
}

function renderMistakeHomeworkSelect(sess) {
  if (sess.homeworkLoading) {
    return '<div class="loading-wrap" style="justify-content:flex-start;padding:10px 0"><div class="spinner"></div>加载作业记录...</div>';
  }
  if (sess.homeworkError) {
    return `
      <div class="sediment-empty" style="padding:12px;margin-bottom:10px">${escapeHtml(sess.homeworkError)}</div>
      <button class="btn btn-secondary btn-sm" onclick="loadMistakeHomeworkRecords(${sess.studentId}, true)">重新加载</button>
    `;
  }
  if (!sess.homeworkRecords.length) {
    return `
      <div class="sediment-empty" style="padding:12px;margin-bottom:10px">暂无已保存作业。请先生成作业，并点击“保存草稿”或“标记已布置”，之后这里就能选择。</div>
      <button class="btn btn-primary btn-sm" onclick="goHomeworkFromMistakes(${sess.studentId})">去生成作业</button>
    `;
  }
  return `
    <select id="mistake-homework" style="width:100%" onchange="mistakeSelectHomework(this.value)">
      <option value="">请选择一份作业</option>
      ${sess.homeworkRecords.map(record => {
        const questions = Array.isArray(record.questions) ? record.questions : [];
        const created = record.created_at ? new Date(record.created_at).toLocaleString('zh-CN', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '未知时间';
        const label = `V${record.version || record.id} · ${questions.length}题 · ${created}`;
        return `<option value="${record.id}" ${String(sess.selectedHomeworkId) === String(record.id) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
      }).join('')}
    </select>
  `;
}

function goHomeworkFromMistakes(studentId) {
  currentStudent = mockData.students.find(st => Number(st.id) === Number(studentId)) || currentStudent;
  hwSubTab = 'generate';
  homeworkFocusPoint = null;
  hwDraft = null;
  const navEl = document.querySelector(`.nav-item[onclick*="'homework'"]`);
  switchTab('homework', navEl);
}

function renderMistakeMain(sess) {
  if (!sess.selectedHomeworkId && sess.ocrItems.length === 0) {
    return `
      <div class="empty-state" style="padding:60px">
        <div class="empty-icon">📄</div>
        <div class="empty-text">先选择一份作业</div>
        <div class="text-muted text-sm" style="margin-top:8px">系统会列出这份作业里的题目，老师点击绿色表示正确，点击红色表示错题。</div>
      </div>
    `;
  }
  if (sess.ocrItems.length === 0 && sess.ocrDone) {
    return `
      <div class="empty-state" style="padding:50px">
        <div class="empty-icon">✍️</div>
        <div class="empty-text">这份作业没有题目</div>
        <div class="text-muted text-sm" style="margin-top:8px">请换一份作业，或回到作业生成重新保存作业。</div>
      </div>
    `;
  }

  const wrongCount = sess.wrongIds.size;
  const totalCount = sess.ocrItems.length;
  const pageSize = 5;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  sess.page = Math.min(Math.max(1, Number(sess.page) || 1), totalPages);
  const pageStart = (sess.page - 1) * pageSize;
  const pageItems = sess.ocrItems.slice(pageStart, pageStart + pageSize);
  const mistakeListStyle = 'display:flex;flex-direction:column;gap:10px';

  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;flex-shrink:0">
      <div>
        <div class="card-title" style="margin-bottom:2px">作业题目</div>
        <div class="text-muted text-sm">点击绿色表示做对，点击红色表示做错；只有红色错题会写入薄弱点</div>
      </div>
      <div class="flex items-center gap-8">
        <div class="text-sm" style="color:${wrongCount>0?'var(--red)':'var(--muted)'};font-weight:600">错题 ${wrongCount}/${totalCount} 道</div>
      </div>
    </div>

    <div style="flex:1;min-width:0;min-height:0;overflow:auto;padding-right:4px">
      <div id="mistake-items" style="${mistakeListStyle};min-width:0">
        ${pageItems.map((item, pageIndex) => {
          const isWrong = sess.wrongIds.has(item.id);
          const isCorrect = sess.correctIds?.has(item.id);
          return `
            <div class="mistake-item ${isWrong ? 'wrong' : isCorrect ? 'correct' : ''}" data-mistake-id="${item.id}" style="margin-bottom:0">
              <div style="width:26px;flex-shrink:0;color:var(--muted);font-weight:900">${pageStart + pageIndex + 1}</div>
              <div class="mistake-edit" contenteditable="true" oninput="mistakeEditItem(${item.id}, this.textContent)">${renderMathRichText(item.content)}</div>
              <div class="mistake-actions">
                <button class="mistake-mark-btn correct ${isCorrect ? 'active' : ''}" title="做对了" aria-label="做对了" onclick="mistakeMarkCorrect(${item.id})">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg>
                </button>
                <button class="mistake-mark-btn wrong ${isWrong ? 'active' : ''}" title="做错了" aria-label="做错了" onclick="mistakeMarkWrong(${item.id})">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18"></path><path d="M6 6l12 12"></path></svg>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <div style="flex-shrink:0">
      ${renderMistakePagination(sess.page, totalPages, totalCount, pageSize)}
    </div>

    <div style="margin-top:8px;padding-top:10px;border-top:1px solid var(--line);display:flex;align-items:center;gap:12px;flex-shrink:0">
      <button class="btn btn-primary" id="mistake-analyze-btn" onclick="mistakeAnalyze()" ${wrongCount===0?'disabled':''}>
        ${sess.analyzing ? '<span class="spinner" style="display:inline-block;margin-right:6px;width:14px;height:14px;border-width:2px"></span>分析中…' : '🧠 分析薄弱点'}
      </button>
      <span class="text-sm text-muted">${wrongCount===0?'请先用红色 ❌ 标记错题':'题库已分类的题直接汇总薄弱点'}</span>
    </div>
  `;
}

function renderMistakePagination(page, totalPages, total, pageSize) {
  if (total <= 0) return '';
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return `
    <div class="question-pagination" style="margin-top:8px;padding-top:8px">
      <div class="text-muted text-sm">当前显示 ${start}-${end} / ${total} 道 · 第 ${page}/${totalPages} 页</div>
      <div class="pagination-controls">
        <button class="btn btn-secondary btn-sm" onclick="setMistakePage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>
        <button class="btn btn-secondary btn-sm" onclick="setMistakePage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    </div>
  `;
}

function setMistakePage(page) {
  const totalPages = Math.max(1, Math.ceil((mistakeSession.ocrItems.length || 0) / 5));
  mistakeSession.page = Math.min(Math.max(1, Number(page) || 1), totalPages);
  refreshMistakeMain();
}

function renderMistakeAnalysis(a) {
  const student = mockData.students.find(st => st.id === mistakeSession.studentId);
  const historyWeak = new Set(student ? getStudentActualWeakPoints(student) : []);
  const stats = normalizeMistakeKnowledgeStats(a, historyWeak);
  return `
    <div style="padding:2px 0 0">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="font-size:18px">🧠</span>
        <span style="font-size:15px;font-weight:700;color:var(--green)">薄弱分类分析结果</span>
        <span class="pill green" style="font-size:10px">题库分类汇总</span>
      </div>

      <div class="mb-16">
        <div class="note-label" style="margin-bottom:8px">本次薄弱点</div>
        ${stats.length ? `
          <div class="mistake-kp-list">
            ${stats.map(item => `
              <div class="mistake-kp-row">
                <div class="mistake-kp-category ${getKnowledgeCategoryByPoint(item.name) ? '' : 'pending'}">${escapeHtml(getKnowledgeCategoryByPoint(item.name) || '待判断')}</div>
                <div class="mistake-kp-name">${escapeHtml(item.name)}</div>
                <div class="mistake-kp-count">${item.count} 道</div>
                <div class="mistake-kp-badge ${item.isNew ? 'new' : ''}">${item.isNew ? '新增' : '已有'}</div>
              </div>
            `).join('')}
          </div>
        ` : '<span class="text-muted text-sm">暂无统计</span>'}
      </div>

      ${renderMistakeSessionCompare(stats)}

      <div style="display:flex;gap:8px;padding-top:12px;border-top:1px solid var(--line)">
        <button class="btn btn-primary btn-sm" onclick="mistakeCommit()">✅ 确认并写入档案</button>
        <button class="btn btn-secondary btn-sm" onclick="mistakeAnalyze()">🔄 重新分析</button>
        <button class="btn btn-secondary btn-sm" onclick="toggleMistakeAnalysisModal(false)">关闭</button>
      </div>
    </div>
  `;
}

function toggleMistakeAnalysisModal(show) {
  const modal = document.getElementById('mistake-analysis-modal');
  const content = document.getElementById('mistake-analysis-modal-content');
  if (!modal || !content) return;
  if (show) {
    content.innerHTML = mistakeSession.analysis
      ? renderMistakeAnalysis(mistakeSession.analysis)
      : '<div class="empty-state" style="padding:36px"><div class="empty-text">暂无薄弱点分析结果</div></div>';
    modal.classList.add('show');
  } else {
    modal.classList.remove('show');
  }
}

function renderMistakeSessionCompare(stats) {
  const profile = studentProfiles[mistakeSession.studentId];
  const historyStats = profile?.knowledgeStats || [];
  const historyMap = new Map(historyStats.map(item => [item.name, item.count || 0]));
  const newItems = stats.filter(item => !historyMap.has(item.name));
  const repeatItems = stats.filter(item => historyMap.has(item.name));
  if (!stats.length) return '';
  return `
    <div class="mb-16">
      <div class="sediment-trend" style="margin-top:0">
        <div class="sediment-trend-card">
          <div class="sediment-trend-title">新增薄弱点</div>
          ${newItems.length
            ? newItems.map(item => `<span class="tag weak">${escapeHtml(item.name)}</span>`).join('')
            : '<span class="tag neutral">暂无新增</span>'}
        </div>
        <div class="sediment-trend-card">
          <div class="sediment-trend-title">反复出现的薄弱点</div>
          ${repeatItems.length ? `
            <div class="sediment-mini-list" style="margin-top:0">
              ${repeatItems.slice(0, 3).map(item => `
                <div class="sediment-mini-row">
                  <span class="sediment-mini-name">${escapeHtml(item.name)}</span>
                  <span class="sediment-delta up">历史 ${historyMap.get(item.name)} + 本次 ${item.count}</span>
                </div>
              `).join('')}
            </div>
          ` : '<div class="text-muted text-sm">本次暂未命中历史薄弱点</div>'}
        </div>
      </div>
    </div>
  `;
}

function renderMistakeTaxonomyTag(point) {
  const category = getKnowledgeCategoryByPoint(point);
  if (!isStandardKnowledgePoint(point)) {
    return '<span class="tag neutral">待判断考察点</span>';
  }
  return `<span class="tag weak">${escapeHtml(category ? `${category} / ${point}` : point)}</span>`;
}

function getMistakeWrongItems() {
  return mistakeSession.ocrItems.filter(item => mistakeSession.wrongIds.has(item.id));
}

function isQuestionBankClassifiedMistake(item) {
  return isStandardKnowledgePoint(item?.knowledgePoint);
}

function shouldUseQuestionBankMistakeAnalysis() {
  const wrongItems = getMistakeWrongItems();
  return wrongItems.length > 0 && wrongItems.every(isQuestionBankClassifiedMistake);
}

function buildQuestionBankMistakeAnalysis(wrongItems) {
  const student = mockData.students.find(st => st.id === mistakeSession.studentId);
  const historyWeak = new Set(student ? getStudentActualWeakPoints(student) : []);
  const counts = new Map();
  wrongItems.forEach(item => {
    const point = item.knowledgePoint;
    counts.set(point, (counts.get(point) || 0) + 1);
  });
  const knowledgeStats = [...counts.entries()]
    .map(([name, count]) => ({ name, count, isNew: !historyWeak.has(name) }))
    .sort((a, b) => b.count - a.count || Number(b.isNew) - Number(a.isNew));
  return {
    ok: true,
    source: 'question-bank',
    weakPoints: knowledgeStats.map(item => item.name),
    knowledgeStats,
    itemAnalyses: wrongItems.map((item, index) => ({ index: index + 1, itemId: item.id, knowledgePoint: item.knowledgePoint }))
  };
}

function renderMistakeReviewList(a) {
  ensureMistakeReviews(a);
  const wrongItems = mistakeSession.ocrItems.filter(item => mistakeSession.wrongIds.has(item.id));
  return `
    <div class="mistake-review-list">
      ${wrongItems.map((item, index) => {
        const review = getMistakeReview(item.id);
        const category = getKnowledgeCategoryByPoint(review.knowledgePoint);
        return `
          <div class="mistake-review-card">
            <div class="mistake-review-question">${index + 1}. ${escapeHtml(item.content)}</div>
            <div class="mistake-review-grid" style="grid-template-columns:minmax(78px, 120px) minmax(180px, 280px)">
              <div>
                <div class="note-label">一级分类</div>
                <div class="mistake-review-fixed ${category ? '' : 'pending'}">${escapeHtml(category || '待判断')}</div>
              </div>
              <div>
                <div class="note-label">二级分类</div>
                <select class="mistake-review-select" onchange="mistakeSetReviewKnowledge(${item.id}, this.value)">
                  ${qGroupedOptionHtml(review.knowledgePoint, '待判断考察点')}
                </select>
              </div>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function ensureMistakeReviews(a) {
  mistakeSession.reviews = mistakeSession.reviews || {};
  const itemAnalyses = Array.isArray(a?.itemAnalyses) ? a.itemAnalyses : [];
  const stats = Array.isArray(a?.knowledgeStats) ? a.knowledgeStats : [];
  const defaultKp = cleanKnowledgeNames(a?.weakPoints)[0] || cleanKnowledgeNames([stats[0]?.name])[0] || '待判断考察点';
  mistakeSession.ocrItems
    .filter(item => mistakeSession.wrongIds.has(item.id))
    .forEach((item, index) => {
      if (mistakeSession.reviews[item.id]) return;
      const aiItem = itemAnalyses.find(x => Number(x.index) === index + 1) || itemAnalyses[index];
      const aiKnowledgePoint = cleanKnowledgeNames([aiItem?.knowledgePoint])[0] || defaultKp;
      mistakeSession.reviews[item.id] = {
        knowledgePoint: aiKnowledgePoint
      };
    });
}

function getMistakeReview(id) {
  mistakeSession.reviews = mistakeSession.reviews || {};
  if (!mistakeSession.reviews[id]) {
    mistakeSession.reviews[id] = { knowledgePoint: '待判断考察点' };
  }
  return mistakeSession.reviews[id];
}

function mistakeSetReviewKnowledge(id, value) {
  const review = getMistakeReview(id);
  review.knowledgePoint = isStandardKnowledgePoint(value) ? value : '待判断考察点';
  refreshMistakeMain();
}

function getCommittedMistakeKnowledgePoint(item, index) {
  const reviewPoint = getMistakeReview(item.id)?.knowledgePoint;
  if (isStandardKnowledgePoint(reviewPoint)) return reviewPoint;
  if (isStandardKnowledgePoint(item.knowledgePoint)) return item.knowledgePoint;
  const analysisItems = Array.isArray(mistakeSession.analysis?.itemAnalyses) ? mistakeSession.analysis.itemAnalyses : [];
  const analysisItem = analysisItems.find(x => Number(x.itemId) === Number(item.id) || Number(x.index) === index + 1) || analysisItems[index];
  return isStandardKnowledgePoint(analysisItem?.knowledgePoint) ? analysisItem.knowledgePoint : '待判断考察点';
}

function normalizeMistakeKnowledgeStats(a, historyWeak) {
  if (Array.isArray(a.knowledgeStats) && a.knowledgeStats.length) {
    return a.knowledgeStats.map(item => {
      const name = String(item.name || '').trim();
      return {
        name,
        count: Math.max(0, Number(item.count) || 0),
        isNew: typeof item.isNew === 'boolean' ? item.isNew : !historyWeak.has(name)
      };
    }).filter(item => cleanKnowledgeNames([item.name]).length).sort((x, y) => y.count - x.count || Number(y.isNew) - Number(x.isNew));
  }
  return cleanKnowledgeNames(a.weakPoints).map(name => ({
    name,
    count: 0,
    isNew: !historyWeak.has(name)
  }));
}

function escapeHtml(s) {
  return String(s||'').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;'}[c]));
}

function escapeJs(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n').replace(/\r/g, '');
}

function renderMathRichText(text) {
  const source = normalizeClientMathText(text);
  const casesHtml = renderCasesRichText(source);
  if (casesHtml) return casesHtml;
  const complexTowerHtml = renderComplexFractionTowerRichText(source);
  if (complexTowerHtml) return complexTowerHtml;
  const structuredFractionHtml = renderStructuredFractionRichText(source);
  if (structuredFractionHtml) return structuredFractionHtml;
  const continuedFractionHtml = renderContinuedFractionRichText(source);
  if (continuedFractionHtml) return continuedFractionHtml;
  return renderMathRichTextBase(source);
}

function renderCasesRichText(source) {
  const text = String(source || '');
  if (!/\bcases\b/.test(text)) return '';
  const casePattern = /\bcases\b([\s\S]*?)\bcases\b/g;
  let html = '';
  let last = 0;
  let changed = false;
  let match;
  while ((match = casePattern.exec(text))) {
    const body = match[1].trim();
    if (!body) continue;
    html += renderMathRichTextBase(text.slice(last, match.index));
    html += mathCasesHtml(body);
    last = casePattern.lastIndex;
    changed = true;
  }
  if (!changed) return '';
  html += renderMathRichTextBase(text.slice(last));
  return html;
}

function mathCasesHtml(body) {
  const rows = String(body || '').split(/\s*\\\\\s*/).map(row => row.trim()).filter(Boolean);
  const rowHtml = rows.map(row => `<span class="math-cases-row">${renderMathRichTextBase(row)}</span>`).join('');
  return `<span class="math-cases"><span class="math-cases-brace">{</span><span class="math-cases-rows">${rowHtml}</span></span>`;
}

function renderMathRichTextBase(source) {
  const escaped = escapeHtml(source)
    .replace(/\\\((.*?)\\\)/g, '$1')
    .replace(/\\\[(.*?)\\\]/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1');
  return escaped
    .replace(/\\underbrace\s*\{([^{}]+)\}\s*_\s*\{([^{}]+)\}/g, (_, body, label) => mathUnderbraceHtml(body, label))
    .replace(/⏟\[([^\]|]+)\|([^\]]+)\]/g, (_, body, label) => mathUnderbraceHtml(body, label))
    .replace(/([0-9A-Za-z]+…[0-9A-Za-z]+)_([0-9]+个[0-9A-Za-z]+)/g, (_, body, label) => mathUnderbraceHtml(body, label))
    .replace(/⦃([^⦄]+)⦄\[([^\]]+)\]/g, (_, numerator, denominator) => {
      return mathFractionHtmlFromHtml(mathFractionalPartHtml(numerator), mathIntegerPartHtml(denominator), true);
    })
    .replace(/⦃([^⦄]+)⦄/g, (_, body) => mathFractionalPartHtml(body))
    .replace(/\[([^\[\]\n]{1,120})\]/g, (match, body) => {
      return shouldRenderIntegerPart(body) ? mathIntegerPartHtml(body) : match;
    })
    .replace(/□/g, '<span class="math-box-placeholder">□</span>')
    .replace(/\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_, numerator, denominator) => {
      return mathFractionHtmlFromHtml(mathScriptedExpressionHtml(numerator), mathScriptedExpressionHtml(denominator));
    })
    .replace(/(\d+(?:\.\d+)?)又(\d{1,18})\/(\d{1,18})/g, (_, whole, numerator, denominator) => mathMixedFractionHtml(whole, numerator, denominator))
    .replace(/（([^（）/]{1,220})）\/（([^（）/]{1,220})）/g, (_, numerator, denominator) => mathFractionHtmlFromHtml(mathScriptedExpressionHtml(numerator), mathScriptedExpressionHtml(denominator), true))
    .replace(/\(([^()/]{1,180})\)\/\(([^()/]{1,180})\)/g, (_, numerator, denominator) => mathFractionHtmlFromHtml(mathScriptedExpressionHtml(numerator), mathScriptedExpressionHtml(denominator), true))
    .replace(/\b(S[△_][A-Z]{1,8})\/(S[△_][A-Z]{1,8})\b/g, (_, numerator, denominator) => {
      return mathFractionHtmlFromHtml(mathAreaLabelHtml(numerator), mathAreaLabelHtml(denominator), true);
    })
    .replace(/\b([A-Z]{1,4})\/([A-Z]{1,4})\b/g, (_, numerator, denominator) => mathFractionHtml(numerator, denominator))
    .replace(/(?<![\dA-Za-z.])(\d{1,18}\^\d{1,4})\/(\d{1,18}\^\d{1,4})(?![\dA-Za-z])/g, (_, numerator, denominator) => {
      return mathFractionHtmlFromHtml(renderMathRichTextBase(numerator), renderMathRichTextBase(denominator));
    })
    .replace(/(?<![\dA-Za-z.])(\d{1,18}(?:\.\d{1,18})?)\/(\d{1,18}\^\d{1,4})(?![\dA-Za-z])/g, (_, numerator, denominator) => {
      return mathFractionHtmlFromHtml(renderMathRichTextBase(numerator), renderMathRichTextBase(denominator));
    })
    .replace(/(?<![\dA-Za-z.])([A-Za-z](?:_[0-9]+)?|[0-9]+|（[^（）/]{1,40}）)\/([0-9]+|[A-Za-z](?:_[0-9]+)?|（[^（）/]{1,40}）)(?![\dA-Za-z])/g, (_, numerator, denominator) => {
      return mathFractionHtmlFromHtml(mathScriptedExpressionHtml(trimOuterMathBrackets(numerator)), mathScriptedExpressionHtml(trimOuterMathBrackets(denominator)));
    })
    .replace(/(?<![\dA-Za-z.])(\d{1,18}(?:\.\d{1,18})?)\/(\d{1,18})(?=[A-Za-z])/g, (_, numerator, denominator) => mathFractionHtml(numerator, denominator))
    .replace(/(?<![\dA-Za-z.])(\d{1,18}(?:\.\d{1,18})?)\/(\d{1,18})(?![\dA-Za-z])/g, (_, numerator, denominator) => mathFractionHtml(numerator, denominator))
    .replace(/(\d)\u0307/g, (_, digit) => mathRepeatDigitHtml(digit))
    .replace(/\\oplus/g, '⊕')
    .replace(/×/g, '<span class="math-inline-op">×</span>')
    .replace(/\\times/g, '<span class="math-inline-op">×</span>')
    .replace(/\\div/g, '÷')
    .replace(/·/g, '<span class="math-inline-op">·</span>')
    .replace(/\\cdot/g, '<span class="math-inline-op">·</span>')
    .replace(/\\leq/g, '≤')
    .replace(/\\geq/g, '≥')
    .replace(/\\neq/g, '≠')
    .replace(/\\pm/g, '±')
    .replace(/\\%/g, '%')
    .replace(/([AC])_\{([A-Za-z0-9]{1,8})\}\^\{([A-Za-z0-9+\-]{1,12})\}/g, (_, base, subscript, superscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])_([0-9]{1,4}|[a-z]{1,4})\^\{([A-Za-z0-9+\-]{1,12})\}/g, (_, base, subscript, superscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])_\{([0-9]{1,4}|[a-z]{1,4})\}\^([0-9]{1,4}|[a-z]{1,4})/g, (_, base, subscript, superscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])_([0-9]{1,4}|[a-z]{1,4})\^([0-9]{1,4}|[a-z]{1,4})/g, (_, base, subscript, superscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])\^\{([A-Za-z0-9+\-]{1,12})\}_\{([A-Za-z0-9]{1,8})\}/g, (_, base, superscript, subscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])\^\{([A-Za-z0-9+\-]{1,12})\}_([0-9]{1,4}|[a-z]{1,4})/g, (_, base, superscript, subscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])\^([0-9]{1,4}|[a-z]{1,4})_\{([0-9]{1,4}|[a-z]{1,4})\}/g, (_, base, superscript, subscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])\^([0-9]{1,4}|[a-z]{1,4})_([0-9]{1,4}|[a-z]{1,4})/g, (_, base, superscript, subscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/\^\{([A-Za-z0-9+\-]{1,12})\}/g, '<sup>$1</sup>')
    .replace(/\^([A-Za-z0-9]{1,12})/g, '<sup>$1</sup>')
    .replace(/(?<!_)_\{([^{}]+)\}/g, '<sub>$1</sub>')
    .replace(/(?<!_)_([0-9]+|[A-Za-z])/g, '<sub>$1</sub>')
    .replace(/\n/g, '<br>');
}

function renderStructuredFractionRichText(source) {
  const result = renderStructuredFractionSegment(source);
  return result.changed ? result.html : '';
}

function renderComplexFractionTowerRichText(source) {
  const text = String(source || '');
  if (!/繁分数/.test(text) || !/÷/.test(text)) return '';
  const marker = text.match(/^(.*?[:：]\s*(?:（?\d+）?|\(\d+\))?\s*)/);
  const prefix = marker ? marker[1] : '';
  const expression = text.slice(prefix.length).trim();
  const levels = collectComplexFractionTowerLevels(expression);
  if (levels.length < 3) return '';
  return renderMathRichTextBase(prefix) + mathMlInline(mathMlTower(levels), true);
}

function collectComplexFractionTowerLevels(expression) {
  const levels = [];
  const parts = String(expression || '').split(/\s*÷\s*/).map(part => part.trim()).filter(Boolean);
  for (const part of parts) {
    const parsed = parseTopLevelFractionPair(part);
    if (!parsed) {
      if (!levels.length) return [];
      const normalized = trimOuterMathBrackets(part);
      if (normalized && normalized !== levels.at(-1)) levels.push(normalized);
      continue;
    }
    if (!levels.length) {
      levels.push(parsed.numerator, parsed.denominator);
      continue;
    }
    if (parsed.numerator && parsed.numerator !== levels.at(-1)) levels.push(parsed.numerator);
    if (parsed.denominator && parsed.denominator !== levels.at(-1) && parsed.denominator !== parsed.numerator) levels.push(parsed.denominator);
  }
  return levels;
}

function parseTopLevelFractionPair(value) {
  const text = String(value || '').trim();
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '(' && text[i] !== '（') continue;
    const close = findMatchingMathBracket(text, i);
    if (close < 0) continue;
    const slash = skipMathSpaces(text, close + 1);
    if (text[slash] !== '/') continue;
    const denominatorStart = skipMathSpaces(text, slash + 1);
    if (text[denominatorStart] !== '(' && text[denominatorStart] !== '（') continue;
    const denominatorClose = findMatchingMathBracket(text, denominatorStart);
    if (denominatorClose < 0) continue;
    if (text.slice(0, i).trim() || text.slice(denominatorClose + 1).trim()) continue;
    return {
      numerator: text.slice(i + 1, close).trim(),
      denominator: text.slice(denominatorStart + 1, denominatorClose).trim()
    };
  }
  return null;
}

function trimOuterMathBrackets(value) {
  let text = String(value || '').trim();
  while ((text[0] === '(' || text[0] === '（') && findMatchingMathBracket(text, 0) === text.length - 1) {
    text = text.slice(1, -1).trim();
  }
  return text;
}

function renderStructuredFractionSegment(source) {
  const text = String(source || '');
  let html = '';
  let last = 0;
  let changed = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '(' && text[i] !== '（') continue;
    const close = findMatchingMathBracket(text, i);
    if (close < 0) continue;
    let slash = skipMathSpaces(text, close + 1);
    if (text[slash] !== '/') continue;
    let denominatorStart = skipMathSpaces(text, slash + 1);
    if (text[denominatorStart] !== '(' && text[denominatorStart] !== '（') continue;
    const denominatorClose = findMatchingMathBracket(text, denominatorStart);
    if (denominatorClose < 0) continue;

    const numerator = text.slice(i + 1, close).trim();
    const denominator = text.slice(denominatorStart + 1, denominatorClose).trim();
    if (!numerator || !denominator) continue;

    html += renderStructuredFractionGapText(text.slice(last, i), changed);
    if (hasStructuredFraction(numerator) || hasStructuredFraction(denominator)) {
      html += mathMlInline(`<mfrac>${mathMlRow(numerator)}${mathMlRow(denominator)}</mfrac>`, true);
    } else {
      html += mathFractionHtmlFromHtml(renderMathRichText(numerator), renderMathRichText(denominator), true);
    }
    last = denominatorClose + 1;
    i = denominatorClose;
    changed = true;
  }
  const tail = text.slice(last);
  html += renderStructuredFractionGapText(tail, isFormulaOperatorTail(tail));
  return { html, changed };
}

function renderStructuredFractionGapText(source, alignOperators = false) {
  if (!alignOperators) return renderMathRichTextBase(source);
  return String(source || '').split(/([+×÷=])/g).map(part => {
    if (/^[+×÷=]$/.test(part)) return `<span class="math-gap-op">${escapeHtml(part)}</span>`;
    return renderMathRichTextBase(part);
  }).join('');
}

function isFormulaOperatorTail(source) {
  return /^[\s_.，,;；。]*$/.test(String(source || ''));
}

function hasStructuredFraction(source) {
  const text = String(source || '');
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '(' && text[i] !== '（') continue;
    const close = findMatchingMathBracket(text, i);
    if (close < 0) continue;
    const slash = skipMathSpaces(text, close + 1);
    if (text[slash] !== '/') continue;
    const denominatorStart = skipMathSpaces(text, slash + 1);
    if (text[denominatorStart] !== '(' && text[denominatorStart] !== '（') continue;
    if (findMatchingMathBracket(text, denominatorStart) >= 0) return true;
  }
  return false;
}

function mathMlInline(inner, tall = false) {
  return `<math class="math-ml ${tall ? 'math-ml-tall' : ''}" display="inline"><mstyle displaystyle="true" scriptlevel="0">${inner}</mstyle></math>`;
}

function mathMlRow(source) {
  return `<mstyle displaystyle="true" scriptlevel="0"><mrow>${mathMlExpression(source)}</mrow></mstyle>`;
}

function mathMlExpression(source) {
  const text = String(source || '');
  let out = '';
  let last = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '(' && text[i] !== '（') continue;
    const close = findMatchingMathBracket(text, i);
    if (close < 0) continue;
    const slash = skipMathSpaces(text, close + 1);
    if (text[slash] !== '/') continue;
    const denominatorStart = skipMathSpaces(text, slash + 1);
    if (text[denominatorStart] !== '(' && text[denominatorStart] !== '（') continue;
    const denominatorClose = findMatchingMathBracket(text, denominatorStart);
    if (denominatorClose < 0) continue;
    const numerator = text.slice(i + 1, close).trim();
    const denominator = text.slice(denominatorStart + 1, denominatorClose).trim();
    if (!numerator || !denominator) continue;

    out += mathMlPlain(text.slice(last, i));
    out += mathMlFrac(numerator, denominator);
    last = denominatorClose + 1;
    i = denominatorClose;
  }
  out += mathMlPlain(text.slice(last));
  return out || '<mtext></mtext>';
}

function mathMlTower(levels) {
  const clean = (levels || []).map(level => String(level || '').trim()).filter(Boolean);
  if (!clean.length) return '<mtext></mtext>';
  const build = index => {
    if (index >= clean.length - 1) return mathMlRow(clean[index]);
    return `<mfrac>${mathMlRow(clean[index])}<mrow>${build(index + 1)}</mrow></mfrac>`;
  };
  return build(0);
}

function mathMlPlain(value) {
  const text = String(value || '');
  const tokens = text.match(/[AC]_\{?[0-9]{1,4}\}?\^\{?[0-9]{1,4}\}?|[AC]_\{?[a-z]{1,4}\}?\^\{?[a-z0-9+\-]{1,12}\}?|[AC]\^\{?[0-9]{1,4}\}?_\{?[0-9]{1,4}\}?|[AC]\^\{?[a-z0-9+\-]{1,12}\}?_\{?[a-z]{1,4}\}?|\d+(?:\.\d+)?又\d+(?:\.\d+)?\/\d+(?:\.\d+)?|\d+(?:\.\d+)?\^\d+|[A-Za-z]+\^\d+|\d+(?:\.\d+)?\/\d+(?:\.\d+)?|\d+(?:\.\d+)?|[+\-×÷=]|[A-Za-z]+|\s+|./g) || [];
  return tokens.map(token => {
    if (/^\s+$/.test(token)) return '<mspace width="0.25em"></mspace>';
    const scriptedSymbol = parseScriptedSymbolToken(token);
    if (scriptedSymbol) {
      return `<msubsup><mi>${escapeHtml(scriptedSymbol.base)}</mi><mn>${escapeHtml(scriptedSymbol.subscript)}</mn><mn>${escapeHtml(scriptedSymbol.superscript)}</mn></msubsup>`;
    }
    if (/^\d+(?:\.\d+)?又\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(token)) {
      const [whole, fraction] = token.split('又');
      const [numerator, denominator] = fraction.split('/');
      return `<mn>${escapeHtml(whole)}</mn>${mathMlFrac(numerator, denominator)}`;
    }
    if (/^\d+(?:\.\d+)?\^\d+$/.test(token)) {
      const [base, exponent] = token.split('^');
      return `<msup><mn>${escapeHtml(base)}</mn><mn>${escapeHtml(exponent)}</mn></msup>`;
    }
    if (/^[A-Za-z]+\^\d+$/.test(token)) {
      const [base, exponent] = token.split('^');
      return `<msup><mi>${escapeHtml(base)}</mi><mn>${escapeHtml(exponent)}</mn></msup>`;
    }
    if (/^\d+(?:\.\d+)?\/\d+(?:\.\d+)?$/.test(token)) {
      const [numerator, denominator] = token.split('/');
      return mathMlFrac(numerator, denominator);
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) return `<mn>${escapeHtml(token)}</mn>`;
    if (/^[+\-×÷=]$/.test(token)) return `<mo>${escapeHtml(token)}</mo>`;
    if (/^[A-Za-z]+$/.test(token)) return `<mi>${escapeHtml(token)}</mi>`;
    return `<mtext>${escapeHtml(token)}</mtext>`;
  }).join('');
}

function parseScriptedSymbolToken(token) {
  const text = String(token || '');
  let match = text.match(/^([AC])_\{?([0-9]{1,4}|[a-z]{1,4})\}?\^\{?([0-9]{1,4}|[a-z0-9+\-]{1,12})\}?$/);
  if (match) return { base: match[1], subscript: match[2], superscript: match[3] };
  match = text.match(/^([AC])\^\{?([0-9]{1,4}|[a-z0-9+\-]{1,12})\}?_\{?([0-9]{1,4}|[a-z]{1,4})\}?$/);
  if (match) return { base: match[1], subscript: match[3], superscript: match[2] };
  return null;
}

function mathMlFrac(numerator, denominator) {
  return `<mfrac>${mathMlRow(numerator)}${mathMlRow(denominator)}</mfrac>`;
}

function renderContinuedFractionRichText(source) {
  const match = findContinuedFraction(source);
  if (!match) return '';
  return renderMathRichTextBase(source.slice(0, match.start)) + match.html + renderMathRichTextBase(source.slice(match.end));
}

function findContinuedFraction(source) {
  const re = /\(?\s*1\s*\)?\s*\/\s*\(/g;
  let match;
  while ((match = re.exec(source))) {
    const parsed = parseContinuedFractionAt(source, match.index);
    if (!parsed) continue;
    const raw = source.slice(match.index, parsed.end);
    const slashCount = (raw.match(/\//g) || []).length;
    if (slashCount >= 2) return { start: match.index, end: parsed.end, html: parsed.html };
  }
  return null;
}

function parseContinuedFractionAt(source, start) {
  let i = skipMathSpaces(source, start);
  const numerator = readMathNumerator(source, i);
  if (!numerator) return null;
  i = skipMathSpaces(source, numerator.end);
  if (source[i] !== '/') return null;
  i = skipMathSpaces(source, i + 1);
  if (source[i] !== '(') return null;
  const close = findMatchingMathParen(source, i);
  if (close < 0) return null;
  const denominator = source.slice(i + 1, close).trim();
  if (!denominator) return null;
  return {
    end: close + 1,
    html: mathContinuedFractionHtml(renderMathRichTextBase(numerator.text), renderContinuedDenominatorHtml(denominator))
  };
}

function renderContinuedDenominatorHtml(denominator) {
  for (let i = 0; i < denominator.length; i++) {
    if (denominator[i] !== '+') continue;
    const child = parseContinuedFractionAt(denominator, i + 1);
    if (!child) continue;
    const rest = denominator.slice(child.end).trim();
    if (rest) continue;
    return renderMathRichTextBase(denominator.slice(0, i) + ' + ') + child.html;
  }
  return renderMathRichTextBase(denominator);
}

function readMathNumerator(source, start) {
  let i = skipMathSpaces(source, start);
  if (source[i] === '(') {
    const close = findMatchingMathParen(source, i);
    if (close < 0) return null;
    const text = source.slice(i + 1, close).trim();
    if (!text) return null;
    return { text, end: close + 1 };
  }
  const match = source.slice(i).match(/^\d+(?:\.\d+)?/);
  if (!match) return null;
  return { text: match[0], end: i + match[0].length };
}

function skipMathSpaces(source, start) {
  let i = start;
  while (i < source.length && /\s/.test(source[i])) i++;
  return i;
}

function findMatchingMathParen(source, openIndex) {
  return findMatchingMathBracket(source, openIndex);
}

function findMatchingMathBracket(source, openIndex) {
  const open = source[openIndex];
  const closeChar = open === '（' ? '）' : ')';
  const openChar = open === '（' ? '（' : '(';
  let depth = 0;
  for (let i = openIndex; i < source.length; i++) {
    if (source[i] === openChar) depth++;
    if (source[i] === closeChar) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function normalizeClientMathText(value) {
  let text = String(value || '').trim();
  if (!text) return '';
  text = protectClientFractionalPartMarkers(text);
  text = text
    .replace(/\\n/g, '\n')
    .replace(/\$(.*?)\$/gs, '$1')
    .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
    .replace(/\\(?:left|right)/g, '');
  text = normalizeClientRecurringDecimals(text);
  text = normalizeClientMixedFractions(text);
  text = normalizeClientFractions(text);
  return text
    .replace(/\\cdots|\\ldots|\\dots/g, '…')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\cdot/g, '·')
    .replace(/\\pm/g, '±')
    .replace(/\\leq?|\\le/g, '≤')
    .replace(/\\geq?|\\ge/g, '≥')
    .replace(/\\neq|\\ne/g, '≠')
    .replace(/\\approx/g, '≈')
    .replace(/\\%/g, '%')
    .replace(/\\[,;]/g, ' ')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s*([+×÷=])\s*/g, ' $1 ')
    .replace(/\s*-\s*/g, '-')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function protectClientFractionalPartMarkers(value) {
  return String(value || '').replace(/(^|[^\\])\\(?![()[\]])([^\\\n]+?)\\/g, (_, prefix, body) => {
    return `${prefix}⦃${body.trim()}⦄`;
  });
}

function normalizeClientRecurringDecimals(value) {
  return String(value || '')
    .replace(/\\dot\s*\{([^{}])\}/g, (_, digit) => `${digit}\u0307`)
    .replace(/\\(?:overline|bar)\s*\{([0-9]+)\}/g, (_, digits) => markClientRepeatingDigits(digits))
    .replace(/\\(?:overline|bar)\s*\{([^{}]+)\}/g, '$1');
}

function markClientRepeatingDigits(digits) {
  if (digits.length <= 1) return `${digits}\u0307`;
  return `${digits[0]}\u0307${digits.slice(1, -1)}${digits.at(-1)}\u0307`;
}

function normalizeClientMixedFractions(value) {
  let text = value;
  const mixed = /(\d+(?:\.\d+)?)\s*\\(?:dfrac|tfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g;
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = text.replace(mixed, (_, whole, numerator, denominator) => `${whole}又${normalizeClientFractionPart(numerator)}/${normalizeClientFractionPart(denominator)}`);
  }
  return text;
}

function normalizeClientFractions(value) {
  let text = value;
  const fraction = /\\(?:dfrac|tfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g;
  let prev = '';
  while (prev !== text) {
    prev = text;
    text = text.replace(fraction, (_, numerator, denominator) => `${normalizeClientFractionPart(numerator)}/${normalizeClientFractionPart(denominator)}`);
  }
  return text;
}

function normalizeClientFractionPart(value) {
  return String(value || '').trim().replace(/\s*([+×÷=])\s*/g, ' $1 ').replace(/\s*-\s*/g, '-').replace(/[ \t]{2,}/g, ' ');
}

function mathFractionHtml(numerator, denominator, wide = false) {
  return `<span class="math-frac ${wide ? 'math-frac-wide' : ''}"><span class="math-frac-num">${escapeHtml(numerator)}</span><span class="math-frac-bar"></span><span class="math-frac-den">${escapeHtml(denominator)}</span></span>`;
}

function mathAreaLabelHtml(label) {
  const match = String(label || '').match(/^S([△_])([A-Z]{1,8})$/);
  if (!match) return escapeHtml(label);
  const prefix = match[1] === '△' ? '△' : '';
  return `S<span class="math-area-sub">${escapeHtml(prefix + match[2])}</span>`;
}

function mathScriptedSymbolHtml(base, superscript, subscript) {
  return `<span class="math-scripted"><span class="math-script-base">${escapeHtml(base)}</span><span class="math-script-stack"><span class="math-script-sup">${escapeHtml(superscript)}</span><span class="math-script-sub">${escapeHtml(subscript)}</span></span></span>`;
}

function mathScriptedExpressionHtml(value) {
  return escapeHtml(value)
    .replace(/([AC])_\{([A-Za-z0-9]{1,8})\}\^\{([A-Za-z0-9+\-]{1,12})\}/g, (_, base, subscript, superscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])_([A-Za-z0-9]{1,8})\^\{([A-Za-z0-9+\-]{1,12})\}/g, (_, base, subscript, superscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])_\{([A-Za-z0-9]{1,8})\}\^([A-Za-z0-9]{1,8})/g, (_, base, subscript, superscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])_([A-Za-z0-9]{1,8})\^([A-Za-z0-9]{1,8})/g, (_, base, subscript, superscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])\^\{([A-Za-z0-9+\-]{1,12})\}_\{([A-Za-z0-9]{1,8})\}/g, (_, base, superscript, subscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])\^\{([A-Za-z0-9+\-]{1,12})\}_([A-Za-z0-9]{1,8})/g, (_, base, superscript, subscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])\^([A-Za-z0-9]{1,8})_\{([A-Za-z0-9]{1,8})\}/g, (_, base, superscript, subscript) => mathScriptedSymbolHtml(base, superscript, subscript))
    .replace(/([AC])\^([A-Za-z0-9]{1,8})_([A-Za-z0-9]{1,8})/g, (_, base, superscript, subscript) => mathScriptedSymbolHtml(base, superscript, subscript));
}

function mathMixedFractionHtml(whole, numerator, denominator) {
  return `<span class="math-mixed"><span>${escapeHtml(whole)}</span>${mathFractionHtml(numerator, denominator)}</span>`;
}

function mathFractionHtmlFromHtml(numeratorHtml, denominatorHtml, wide = false) {
  return `<span class="math-frac ${wide ? 'math-frac-wide' : ''}"><span class="math-frac-num">${numeratorHtml}</span><span class="math-frac-bar"></span><span class="math-frac-den">${denominatorHtml}</span></span>`;
}

function mathContinuedFractionHtml(numeratorHtml, denominatorHtml) {
  return `<span class="math-cfrac"><span class="math-cfrac-num">${numeratorHtml}</span><span class="math-cfrac-bar"></span><span class="math-cfrac-den">${denominatorHtml}</span></span>`;
}

function mathRepeatDigitHtml(digit) {
  return `<span class="math-repeat-digit">${escapeHtml(digit)}<span class="math-repeat-dot"></span></span>`;
}

function mathFractionalPartHtml(body) {
  return `<span class="math-fractional-part"><span class="math-fractional-brace">{</span>${renderMathRichText(body)}<span class="math-fractional-brace">}</span></span>`;
}

function mathIntegerPartHtml(body) {
  return `<span class="math-integer-part"><span class="math-integer-bracket">[</span>${renderIntegerPartBodyHtml(body)}<span class="math-integer-bracket">]</span></span>`;
}

function shouldRenderIntegerPart(body) {
  const text = String(body || '').trim();
  return Boolean(text && /[0-9A-Za-z_^!/+\\]/.test(text));
}

function renderIntegerPartBodyHtml(body) {
  const text = String(body || '').trim();
  const parsed = parseSlashExpression(text);
  if (parsed) {
    return mathFractionHtmlFromHtml(renderMathRichTextBase(parsed.numerator), renderMathRichTextBase(parsed.denominator), true);
  }
  return renderMathRichText(trimOuterMathBrackets(text));
}

function parseSlashExpression(value) {
  const text = String(value || '').trim();
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '(' || ch === '（') depth++;
    else if (ch === ')' || ch === '）') depth = Math.max(0, depth - 1);
    else if (ch === '/' && depth === 0) {
      const numerator = trimOuterMathBrackets(text.slice(0, i));
      const denominator = trimOuterMathBrackets(text.slice(i + 1));
      if (numerator && denominator) return { numerator, denominator };
    }
  }
  return null;
}

function mathUnderbraceHtml(body, label) {
  return `<span class="math-underbrace"><span class="math-underbrace-main">${renderMathRichText(body)}</span><svg class="math-underbrace-brace" viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d="M1 1.5 C5 1.5 5 4.8 9 4.8 H41 C47 4.8 47 8.5 50 8.5 C53 8.5 53 4.8 59 4.8 H91 C95 4.8 95 1.5 99 1.5"/></svg><span class="math-underbrace-label">${escapeHtml(label)}</span></span>`;
}

function renderAgentMessage(text) {
  const normalized = String(text || '')
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter(line => !/^\s*\|?\s*-{2,}\s*(\|\s*-{2,}\s*)+\|?\s*$/.test(line))
    .map(line => line.replace(/^\s*\|(.+)\|\s*$/, '$1').replace(/\s*\|\s*/g, '：'))
    .join('\n')
    .trim();
  let html = escapeHtml(normalized)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|\n)([-*])\s+/g, '$1• ')
    .replace(/(^|\n)(\d+)\.\s+/g, '$1$2. ');
  html = html.replace(/\n{3,}/g, '\n\n').replace(/\n/g, '<br>');
  return html || '<span class="text-muted">正在思考…</span>';
}

document.addEventListener('click', e => {
  if (!e.target.closest?.('.kp-picker')) {
    document.querySelectorAll('.kp-picker.open').forEach(el => el.classList.remove('open'));
  }
  if (!e.target.closest?.('.filter-picker')) {
    document.querySelectorAll('.filter-picker.open').forEach(el => el.classList.remove('open'));
  }
});

async function loadMistakeHomeworkRecords(studentId, force = false) {
  const sess = mistakeSession;
  if (!studentId) return;
  if (!force && (sess.homeworkLoading || sess.homeworkLoaded || sess.homeworkError)) return;
  sess.homeworkLoading = true;
  sess.homeworkError = '';
  sess.homeworkLoaded = false;
  refreshMistakeLeftPanel();
  try {
    const records = await api.get('/homework/student/' + studentId);
    if (sess.studentId !== studentId) return;
    sess.homeworkRecords = Array.isArray(records) ? records : [];
    sess.homeworkLoaded = true;
    if (!sess.selectedHomeworkId && sess.homeworkRecords.length === 1) {
      mistakeSelectHomework(sess.homeworkRecords[0].id, false);
    }
  } catch (err) {
    sess.homeworkError = err.message || '作业记录加载失败';
    sess.homeworkLoaded = true;
  } finally {
    sess.homeworkLoading = false;
    if (currentTab === 'mistakes') renderMistakes();
  }
}

function refreshMistakeLeftPanel() {
  const select = document.getElementById('mistake-homework');
  if (select || currentTab !== 'mistakes') return;
}

function mistakeSelectHomework(homeworkId, shouldRefresh = true) {
  const sess = mistakeSession;
  const record = sess.homeworkRecords.find(item => String(item.id) === String(homeworkId));
  sess.selectedHomeworkId = homeworkId ? String(homeworkId) : '';
  sess.wrongIds = new Set();
  sess.correctIds = new Set();
  sess.analysis = null;
  sess.reviews = {};
  sess.saved = false;
  sess.ocrError = '';
  sess.page = 1;
  if (!record) {
    sess.ocrItems = [];
    sess.ocrDone = false;
  } else {
    const questions = Array.isArray(record.questions) ? record.questions : [];
    sess.ocrItems = questions.map((q, index) => ({
      id: index + 1,
      questionId: q.id || null,
      content: q.content || '',
      knowledgePoint: q.knowledgePoint || '',
      answer: q.answer || '',
      source: 'homework'
    }));
    sess.ocrDone = true;
  }
  if (shouldRefresh) refreshMistakeMain();
}

function mistakeChangeStudent() {
  const sid = parseInt(document.getElementById('mistake-student').value);
  currentStudent = mockData.students.find(st => st.id === sid);
  loadStudentProfile(sid);
  renderMistakes();
}

function mistakeMarkCorrect(id) {
  mistakeSession.correctIds = mistakeSession.correctIds || new Set();
  mistakeSession.correctIds.add(id);
  mistakeSession.wrongIds.delete(id);
  mistakeSession.analysis = null;
  delete mistakeSession.reviews[id];
  refreshMistakeMain();
}

function mistakeMarkWrong(id) {
  mistakeSession.correctIds = mistakeSession.correctIds || new Set();
  mistakeSession.correctIds.delete(id);
  mistakeSession.wrongIds.add(id);
  // 判题变化后清掉旧分析（可重新分析）
  mistakeSession.analysis = null;
  delete mistakeSession.reviews[id];
  refreshMistakeMain();
}

function mistakeEditItem(id, content) {
  const item = mistakeSession.ocrItems.find(it => it.id === id);
  if (!item) return;
  item.content = String(content || '').trim();
  mistakeSession.analysis = null;
}

function mistakeDeleteItem(id) {
  mistakeSession.ocrItems = mistakeSession.ocrItems.filter(it => it.id !== id);
  mistakeSession.wrongIds.delete(id);
  mistakeSession.analysis = null;
  delete mistakeSession.reviews[id];
  mistakeSession.page = Math.min(Math.max(1, mistakeSession.page || 1), Math.max(1, Math.ceil(mistakeSession.ocrItems.length / 5)));
  refreshMistakeMain();
  showToast('已删除该题');
}

function mistakeAddItem() {
  const nextId = Math.max(0, ...mistakeSession.ocrItems.map(it => Number(it.id) || 0)) + 1;
  mistakeSession.ocrItems.push({ id: nextId, content: '请录入题目内容' });
  mistakeSession.wrongIds.add(nextId);
  mistakeSession.ocrDone = true;
  mistakeSession.ocrError = '';
  mistakeSession.analysis = null;
  mistakeSession.reviews = mistakeSession.reviews || {};
  mistakeSession.page = Math.max(1, Math.ceil(mistakeSession.ocrItems.length / 5));
  refreshMistakeMain();
  setTimeout(() => {
    const el = document.querySelector(`[data-mistake-id="${nextId}"] .mistake-edit`);
    if (el) {
      el.focus();
      document.execCommand('selectAll', false, null);
    }
  }, 0);
}

async function mistakeAnalyze() {
  const sess = mistakeSession;
  if (sess.wrongIds.size === 0) { showToast('请先用红色 ❌ 标记错题'); return; }
  const emptyWrong = sess.ocrItems.filter(it => sess.wrongIds.has(it.id) && !String(it.content || '').trim());
  if (emptyWrong.length) { showToast('请先补全已标记错题的题目内容'); return; }
  const wrongItems = getMistakeWrongItems();
  if (shouldUseQuestionBankMistakeAnalysis()) {
    sess.analysis = buildQuestionBankMistakeAnalysis(wrongItems);
    sess.reviews = {};
    refreshMistakeMain();
    toggleMistakeAnalysisModal(true);
    showToast('已按题库分类汇总薄弱点');
    return;
  }
  sess.analyzing = true;
  sess.analysis = null;
  refreshMistakeMain();

  const wrongTexts = wrongItems.map(it => it.content);
  try {
    const resp = await fetch(API + '/mistakes/analyze', {
      method:'POST',
      headers: apiHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({ studentId: sess.studentId, wrongTexts })
    });
    const data = await apiJson(resp);
    if (!data.ok) throw new Error(data.error || '分析失败');
    sess.analysis = data;
    applyCreditSummary(data.credit);
    sess.reviews = {};
    ensureMistakeReviews(data);
    toggleMistakeAnalysisModal(true);
  } catch(err) {
    showToast('分析失败：' + err.message);
  }
  sess.analyzing = false;
  refreshMistakeMain();
}

async function mistakeCommit() {
  const sess = mistakeSession;
  if (!sess.analysis) return;
  const wrongItems = sess.ocrItems.filter(it => sess.wrongIds.has(it.id));
  const wrongTexts = wrongItems.map(it => it.content);
  const mistakeItems = wrongItems.map((item, index) => {
    return {
      content: item.content,
      questionId: item.questionId || null,
      source: item.source || 'homework',
      knowledgePoint: getCommittedMistakeKnowledgePoint(item, index)
    };
  });
  if (mistakeItems.some(item => !item.knowledgePoint || item.knowledgePoint === '待判断考察点')) {
    showToast('存在未分类错题，请先在题库明细补全二级分类');
    return;
  }
  try {
    const resp = await fetch(API + '/mistakes/commit', {
      method:'POST',
      headers: apiHeaders({'Content-Type':'application/json'}),
      body: JSON.stringify({
        studentId: sess.studentId,
        weakPoints: [...new Set(mistakeItems.map(item => item.knowledgePoint).filter(isStandardKnowledgePoint))],
        wrongTexts,
        mistakeItems
      })
    });
    const data = await apiJson(resp);
    if (!data.ok) throw new Error(data.error || '保存失败');

    // 同步前端学生档案
    const s = mockData.students.find(st => st.id === sess.studentId);
    if (s) {
      s.weakPoints = data.weakPoints;
      wrongTexts.forEach(t => {
        const desc = t.length > 30 ? t.slice(0,30)+'…' : t;
        if (!s.recentErrors.includes(desc)) s.recentErrors.unshift(desc);
      });
      s.recentErrors = s.recentErrors.slice(0,10);
    }
    delete studentProfiles[sess.studentId];
    loadStudentProfile(sess.studentId, true);
    sess.saved = true;
    toggleMistakeAnalysisModal(false);
    showToast(`✅ ${s.name} 学情档案已更新（薄弱点：${data.weakPoints.length} 个）`);
  } catch(err) {
    showToast('保存失败：' + err.message);
  }
}

function refreshMistakeMain() {
  const el = document.getElementById('mistake-main');
  if (el) el.innerHTML = renderMistakeMain(mistakeSession);
}

// ============================================================
// INIT
// ============================================================
async function seedIfEmpty(students, questions) {
  // 首次使用：把 mock 数据写入数据库
  if (students.length === 0) {
    for (const s of mockData.students) {
      await api.post('/students', {
        name: s.name, grade: s.grade, status: s.status,
        weakPoints: s.weakPoints, errorCauses: s.errorCauses,
        homeworkRate: s.homeworkRate, lastRecord: s.lastRecord,
        recentErrors: s.recentErrors, notes: s.notes, suggestion: s.suggestion
      });
    }
    students = await api.get('/students');
  }
  if (questions.length === 0 && canManageSystemQuestionBank()) {
    for (const q of mockData.questions) {
      await api.post('/questions', {
        content: q.content, type: q.type, difficulty: q.difficulty,
        knowledgePoint: q.knowledgePoint, answer: q.answer, status: q.status
      });
    }
    questions = await api.get('/questions');
  }
  return { students, questions };
}

async function loadKnowledgeMapStatuses(students) {
  const entries = await Promise.all(students.map(async s => {
    try {
      const statusMap = await api.get('/knowledge-map/student/' + s.id);
      return [s.id, statusMap && Object.keys(statusMap).length ? statusMap : studentNodeStatus[s.id]];
    } catch {
      return [s.id, studentNodeStatus[s.id]];
    }
  }));
  studentNodeStatus = Object.fromEntries(entries.filter(([, statusMap]) => statusMap));
}

async function loadFeishuIntegrationStatus() {
  try {
    const data = await api.get('/feishu/integrations');
    const integration = data.integrations?.[0];
    if (!integration) return;
    teacherAgent.feishuAppId = integration.app_id;
    teacherAgent.feishuStatus = integration.status === 'connected' ? 'connected' : 'pending';
    teacherAgent.feishuMode = 'one-click';
  } catch (err) {
    console.warn('Feishu status unavailable:', err.message);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await restoreCurrentUser();
    renderLandingAccount();
    renderWorkspaceAccount();
    setDate();
    renderCredits();
    if (currentUser) {
      await enterWorkspace();
    }
  } finally {
    document.body.classList.remove('app-booting');
  }
});
