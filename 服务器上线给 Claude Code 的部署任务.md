# AI 学情工作台服务器上线任务说明

这份文档给 Claude Code 使用。目标是在服务器上把 AI 学情工作台部署成可给老师试用的版本，并把数据库、上传图片、备份从代码目录中拆出来。

## 当前项目状态

- 后端：Node.js + Express，入口 `server/src/index.js`。
- 前端：静态 HTML/CSS/JS，当前由后端托管 `frontend/src/index.html`。
- 数据库：SQLite/libSQL。
- 当前本地默认数据库：`data/teacher.db`。
- 当前题内截图 URL：`/uploads/question-images/...`。
- 试运行阶段积分免费，先不要恢复真实扣费。
- 题库 C 版主要专题已抽检通过；旧 B 版残留已清理。

## 服务器上线目标

上线时不要把老师上传的图片、数据库、备份放在源码目录里。建议使用独立数据目录，例如：

```bash
/var/lib/teacher/
  teacher.db
  uploads/
    question-images/
  backups/
```

也可以按服务器权限改成其他稳定目录，但必须满足：

- 数据库、上传图片、备份都不在 `frontend/src` 或 git 代码目录里。
- 代码更新或重新部署不会覆盖老师上传的截图。
- 备份能同时覆盖 SQLite 数据库和上传图片。

## 必须先补的代码能力

当前代码已经有备份脚本环境变量：

- `DB_PATH`
- `QUESTION_IMAGES_DIR`
- `BACKUP_DIR`

但仍有一处生产不适配：

- `server/src/routes/questions.js` 里上传/替换截图仍写死到 `frontend/src/uploads/question-images/manual`。
- `server/src/index.js` 只托管 `frontend/src`，没有把外部 `QUESTION_IMAGES_DIR` 映射到 `/uploads/question-images`。

请先改代码：

1. 在 `server/src/routes/questions.js` 中使用环境变量：

```js
const questionImageDir = resolve(repoDir, process.env.QUESTION_IMAGES_DIR || 'frontend/src/uploads/question-images');
const manualQuestionImageDir = join(questionImageDir, 'manual');
```

上传文件写入 `manualQuestionImageDir`。

返回给前端的 URL 仍保持：

```js
/uploads/question-images/manual/xxx.png
```

2. 在 `server/src/index.js` 中增加外部图片目录静态托管：

```js
const questionImagesDir = resolve(repoDir, process.env.QUESTION_IMAGES_DIR || 'frontend/src/uploads/question-images');
app.use('/uploads/question-images', express.static(questionImagesDir, { setHeaders: noStore }));
```

注意：不要把整个 `/var/lib/teacher` 暴露出去，只暴露 `question-images` 目录。

3. 路径处理要用 `resolve`，不要用字符串拼接。

4. 本地默认行为不能破坏：不设置环境变量时，本地仍能使用 `frontend/src/uploads/question-images`。

## 服务器环境变量建议

在服务器 `server/.env` 中配置：

```bash
NODE_ENV=production
PORT=3001
HOST=127.0.0.1
TRUST_PROXY=true
CORS_ORIGINS=https://你的域名

DB_PATH=/var/lib/teacher/teacher.db
QUESTION_IMAGES_DIR=/var/lib/teacher/uploads/question-images
BACKUP_DIR=/var/lib/teacher/backups

MAIL_PROVIDER=tencent
TENCENTCLOUD_SECRET_ID=你的腾讯云 SecretId
TENCENTCLOUD_SECRET_KEY=你的腾讯云 SecretKey
TENCENT_SES_FROM_EMAIL=no-reply@你的域名
TENCENT_SES_REGION=ap-guangzhou
TENCENT_SES_ENDPOINT=ses.tencentcloudapi.com
MAIL_FROM="AI 学情工作台 <no-reply@你的域名>"

VOLCENGINE_API_KEY=你的 AI Key
VOLCENGINE_BASE_URL=https://ark.cn-beijing.volces.com/api/coding/v3
VOLCENGINE_MODEL=你的模型

FEISHU_CREDENTIAL_KEY=一个足够长的随机密钥

INITIAL_CREDITS=1280
ENABLE_CREDIT_GRANT=false
RATE_LIMIT_DISABLED=false
```

邮件说明：

- 注册时调用 `/api/auth/send-code` 给邮箱发验证码，注册完成后后续登录使用用户名或邮箱 + 密码。
- 腾讯云密钥只允许写在服务器 `server/.env`，不要提交到 git，也不要写入前端。
- 如果改用 SMTP，把 `MAIL_PROVIDER` 改为 `smtp`，并配置 `SMTP_HOST`、`SMTP_PORT`、`SMTP_SECURE`、`SMTP_USER`、`SMTP_PASS`。

如果暂时不开放飞书，也要保留 `FEISHU_CREDENTIAL_KEY`，避免后续保存飞书 App Secret 时无法解密。

## 数据迁移步骤

如果本地已有数据要迁到服务器：

1. 在本地项目运行：

```bash
cd server
npm run backup
```

2. 把生成的 `data/backups/teacher-backup-xxxx` 目录上传到服务器。

3. 服务器设置好 `.env` 后，先 dry-run：

```bash
cd server
npm run restore -- --from data/backups/teacher-backup-xxxx
```

4. 确认目标路径是服务器数据目录后，再执行：

```bash
npm run restore -- --from data/backups/teacher-backup-xxxx --yes
```

恢复脚本会校验 `manifest.json` 中的数据库 sha256。

## 部署建议

建议使用 Nginx 反向代理：

- 外部访问：`https://你的域名`
- Nginx 转发到：`http://127.0.0.1:3001`
- 证书：使用 HTTPS。

后端建议用 systemd 或 pm2 守护。示例 systemd 思路：

```ini
[Service]
WorkingDirectory=/path/to/teacher/server
EnvironmentFile=/path/to/teacher/server/.env
ExecStart=/usr/bin/node src/index.js
Restart=always
```

实际路径按服务器环境调整。

## 定时备份

部署后配置每日备份：

```bash
cd /path/to/teacher/server
npm run backup
```

要求：

- 每天至少备份一次。
- 备份目录不能只留在同一块盘上，建议同步到对象存储或另一台机器。
- 定期清理旧备份，例如保留最近 30 天。
- 每次大版本发布前手动跑一次备份。

## 上线后验证清单

代码修改和服务器部署完成后，至少跑这些：

```bash
cd server
npm install
npm audit --audit-level=moderate
npm run smoke
npm run backup
```

```bash
cd ../frontend
npm run check
npm run build
npm run smoke
```

浏览器人工验证：

- 访问真实域名能打开首页。
- 注册邮箱验证码能收到。
- 登录、刷新、退出正常。
- 题库管理能看到 C 版专题。
- 手动上传/替换一张题内截图，刷新后图片仍能看到。
- 检查上传文件是否实际落在 `QUESTION_IMAGES_DIR`。
- 生成作业成功。
- 保存作业记录成功。
- 错题分析能从作业中标错并归档薄弱点。
- 打印/导出 PDF 只包含作业主体。

## 当前已知不作为首批阻塞的事项

- 积分扣费：试运行阶段免费，后续商业化再迭代。
- 飞书公开开放：可以先不开放给老师，等真实群验收后再开。
- PDF 自助导入：当前仍建议由维护者按已有 skill 和人工复核处理。

## 完成标准

Claude Code 完成这项服务器上线任务时，请回报：

- 修改了哪些代码文件。
- 服务器 `.env` 中数据目录配置是什么。
- `QUESTION_IMAGES_DIR` 是否已经脱离源码目录。
- 上传截图人工验证结果。
- `npm audit`、`server smoke`、`frontend check/build/smoke` 结果。
- 备份目录位置和最近一次备份 manifest 摘要。
