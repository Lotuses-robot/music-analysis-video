# Web 编辑器

黑白简洁的本地编辑界面，用于修改工程 JSON，并 **实时预览** Remotion 成片（右侧 Player）。

## 启动

在项目根目录：

```bash
npm run editor:dev
```

浏览器默认打开 `http://localhost:5173`（见 `editor/vite.config.ts`）。

## 构建静态资源

```bash
npm run editor:build
```

输出在 `editor/dist/`，可部署到任意静态托管。

## 行为说明

- **左侧**：表单编辑元信息、锚点、和弦、段落、情感点、页脚与 fps；支持 **恢复示例**、**下载 JSON**、**打开 JSON 文件**。
- **右侧**：`@remotion/player` 预览；**9:16 / 16:9** 切换。预览使用 **单色压暗**（`editor/src/lib/previewProject.ts`），与编辑器黑白风格一致；正式导出仍可用 `npm run render:*` 与工程里原有主题字段。
- **静态资源**：Vite `publicDir` 指向仓库根目录 `public/`，因此 `meta.audioPath` 仍写 `audio/xxx.wav` 即可。

## 技术栈

- Vite + React + TypeScript（`editor/`）
- 与主包共用 `src/types`、`remotion/AnalysisVideo`、分析逻辑
