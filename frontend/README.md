# AI 学情工作台前端

这是从仓库根目录的 `AI学情工作台_v1.html` 拆分出来的静态前端工程。

## 目录

- `src/index.html`：页面结构
- `src/styles.css`：样式
- `src/app.js`：业务交互逻辑
- `scripts/`：本地预览、构建和静态校验脚本

## 命令

```bash
npm run check
npm run build
npm run smoke
npm run dev
```

后端 `server/src/index.js` 会直接托管 `frontend/src/index.html`。旧单文件保留为 `/legacy.html`，只作为对照和回退参考。
