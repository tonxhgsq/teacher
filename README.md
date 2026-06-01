# AI 学情工作台

教培机构老师的减负工具。识别学生薄弱点 → 个性化出题 → 跟进学生情况。

## 功能

- **仪表盘**：KPI 概览、今日提醒、学生概览、班级薄弱点分布、题库新增
- **学生管理**：学生档案、知识点掌握状态、课后记录、家长反馈草稿
- **作业生成**：按薄弱点筛题、难度配比、生成试卷预览
- **错题分析**：上传作业照片 → OCR 识别题目 → 勾选错题 → AI 分析薄弱点
- **题库管理**：上传图片/PDF/Excel/Word → 百度 OCR 识别 → 审核入库
- **接入 Agent**：飞书/企微等家长端 Bot 配置（开发中）

## 技术栈

- 前端：单文件 HTML（原生 JS + CSS）
- 后端：Node.js + Express
- 数据库：SQLite（via @libsql/client）
- OCR：百度 OCR API
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

### 百度 OCR

用于识别作业照片和 PDF 题目。

| 变量 | 说明 |
|------|------|
| `BAIDU_OCR_API_KEY` | 百度智能云应用的 API Key |
| `BAIDU_OCR_SECRET_KEY` | 百度智能云应用的 Secret Key |

获取步骤：
1. 登录 [console.bce.baidu.com](https://console.bce.baidu.com)
2. 进入「文字识别」→ 创建应用
3. 复制 API Key 和 Secret Key

所用接口：`accurate_basic`（通用文字识别高精度版），需开通该接口权限。

---

## 数据库

首次启动自动创建 `server/data/teacher.db`（SQLite），无需手动建表。

## 飞书 Bot 接入（待开发）

等待飞书开放平台 App ID/Secret 后接入。接入后在「接入 Agent」Tab 配置。
