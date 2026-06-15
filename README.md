# AI 学情工作台

教培机构老师的减负工具。识别学生薄弱点 → 个性化出题 → 跟进学生情况。

## 功能

- **仪表盘**：KPI 概览、今日提醒、学生概览、班级薄弱点分布、题库新增
- **学生管理**：学生档案、知识点掌握状态、课后记录、家长反馈草稿
- **作业生成**：按薄弱点筛题、难度配比、生成试卷预览
- **错题分析**：选择已生成作业 → 标记对题/错题 → AI 分析新增薄弱点
- **题库管理**：上传字段完整的 CSV/JSON/Markdown → 预览编辑 → 审核入库
- **接入 Agent**：飞书/企微等家长端 Bot 配置（开发中）

## 技术栈

- 前端：`frontend/` 静态前端工程（原生 JS + CSS，拆分为 HTML/CSS/JS）
- 后端：Node.js + Express
- 数据库：SQLite（via @libsql/client）
- AI：Claude API（通过 Mimo 代理）

## 快速开始

### 1. 配置环境变量

```bash
cd server
cp .env.example .env
# 编辑 .env，填入各项 API Key
```

### 2. 安装依赖并启动后端

```bash
cd server
npm install
node src/index.js
```

### 3. 打开前端

浏览器访问 `http://localhost:3001`

后端会托管 `frontend/src/index.html`。旧版单文件入口保留在 `http://localhost:3001/legacy.html` 作为对照。

### 前端工程命令

```bash
cd frontend
npm run check
npm run build
npm run smoke
npm run dev
```

---

## API Key 配置说明

### Mimo（Claude 代理）

用于 AI 分析错题薄弱点。

| 变量 | 说明 |
|------|------|
| `ANTHROPIC_API_KEY` | Mimo 平台的 API Key，格式 `tp-xxx` |
| `ANTHROPIC_BASE_URL` | `https://token-plan-cn.xiaomimimo.com/anthropic` |
| `AI_MODEL` | 模型名，如 `mimo-v2.5` |

获取地址：[platform.xiaomimimo.com](https://platform.xiaomimimo.com)

## 数据库

首次启动自动创建 `data/teacher.db`（SQLite），无需手动建表。

### 备份与恢复

备份会同时保存 SQLite 数据库和题内截图目录：

```bash
cd server
npm run backup
```

恢复默认只预演，不会覆盖当前数据：

```bash
cd server
npm run restore -- --from data/backups/teacher-backup-xxxx
```

确认恢复时再加 `--yes`：

```bash
cd server
npm run restore -- --from data/backups/teacher-backup-xxxx --yes
```

## 飞书 Bot 接入（待开发）

等待飞书开放平台 App ID/Secret 后接入。接入后在「接入 Agent」Tab 配置。
