# AI 学情工作台 - 项目规范

## 项目定位

教培机构老师的减负工具。核心价值：识别学生薄弱点 → 个性化出题 → 跟进学生情况。

**产品形态**：
- **老师后台**（Web 应用）：老师在电脑上管理学生、出题、看数据
- **飞书 Agent**（家长端）：家长在飞书里和 AI 对话，发作业照片、收反馈、问进度
- 两端共用同一套数据库

**当前阶段**：HTML 原型（验证产品逻辑），下一步迁移为真实 Web 应用

---

## 目标架构（下一阶段）

```
前端：React（复用现有设计系统和交互逻辑）
后端：Node.js + Express
数据库：SQLite（单文件，后期用户多了迁 PostgreSQL）
AI：Claude API（图片识别 + 出题 + 家长反馈生成）
飞书：飞书开放平台 Webhook，接入同一后端
部署：云服务器 + Docker
```

---

## 当前进度（2026-05-31）

### 阶段：HTML 原型 + 后端 API（已对接）

文件：`AI学情工作台_v1.html`（浏览器打开，需后端运行）

| Tab | 状态 | 说明 |
|-----|------|------|
| 仪表盘 | ✅ | KPI卡片 + 今日重点学生 + 立即出题快捷入口 |
| 知识点地图 | ✅ | 小学数学完整知识树，班级/个人视图，点击改状态，自动同步薄弱点 |
| 学生管理 | ✅ | 学生列表 + 详情面板，内嵌课后记录 + 家长反馈草稿生成 |
| 题库管理 | ✅ | 三列看板（待识别→待审核→已入库），题目卡片 |
| 作业生成 | ✅ | 按学生薄弱点筛题，难度配比，生成试卷预览，支持打印 |
| 错题分析 | ✅ | 上传照片预览 + 逐题手动批改（✓/✗）+ 标错误原因 + 保存自动更新薄弱点 |

### 数据层现状

- **前端已对接后端 API**（`http://localhost:3001/api`）
- 启动时自动从 API 加载数据；首次为空时写入 Mock 种子数据
- 写操作（保存记录、批改结果、题库状态变更）同步调 API
- API 不可用时自动降级为 Mock 数据（离线可用）
- 数据库：`data/teacher.db`（SQLite via @libsql/client）

### 后端启动方式

```bash
cd server
node src/index.js
```

### 下一步待做（按顺序）

1. **Claude API 接入** — OCR 识别题库图片 + AI 个性化出题
2. **飞书 Bot** — 接消息、结合学生档案回答、接收错题照片自动记录
3. **PDF 生成** — puppeteer，作业审核通过后导出打印

**当前阻塞**：等待飞书开放平台 App ID/Secret

---

## 原型技术约束（HTML 阶段）

- 单文件 HTML，不引入任何外部库
- 纯 CSS + 原生 JS，CSS Grid 布局
- 密钥不进代码

## 设计系统（迁移后继续沿用）

```
--bg: #f6f4ee        暖米色背景
--panel: #fffdf8     卡片背景
--green: #2f8f55     主操作色
--orange: #d4862f    次要/警告
--red: #c0392b       危险/错误
--line: #e8dfd1      边框
--radius: 18px       圆角
侧边栏宽度: 236px
```

---

## 数据结构

```javascript
// 学生
{ id, name, grade, status,        // status: high-risk/follow-up/improving/stable
  weakPoints[],                    // 薄弱知识点（字符串数组）
  errorCauses{},                   // { 审题类: n, 计算类: n, ... }
  homeworkRate, lastRecord,
  recentErrors[], notes, suggestion }

// 题目
{ id, content, type, difficulty, knowledgePoint, answer, status }
// status: pending-ocr / pending-review / approved

// 知识点掌握状态
studentNodeStatus = {
  studentId: { nodeId: 'weak'|'partial'|'mastered'|'untested' }
}
```

---

## 代码规范（HTML 原型）

- Tab 内函数加前缀：`mistake*` / `km*` / `hw*`
- 全局状态：`currentStudent`、`currentTab`
- 操作反馈统一用 `showToast(msg)`
- 每个 Tab 对应 `render{TabName}()`，切换时调用

---

## 参考文件（只读）

- `AI学情工作台_可点击Tab网页Demo.html` — UI 设计参考
- `AI学情工作台_Tab功能与开发重难点.html` — 功能细节参考
- `小学教培AI学情工作台_MVP方案.html` — 产品原则参考
