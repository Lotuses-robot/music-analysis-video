# Remotion 与命令

## 入口

- **注册根组件**：`remotion/index.ts` → `registerRoot(RemotionRoot)`
- **Composition 列表**：`remotion/Root.tsx`
  - `Analysis916`：1080×1920（竖屏）
  - `Analysis169`：1920×1080（横屏）
- **单条成片组件**：`remotion/AnalysisVideo.tsx`
- **动态元数据**：`remotion/metadata.ts` 中 `calculateAnalysisMetadata`  
  - 按 `compositionId` 设置宽高  
  - `fps` 来自 `project.export.fps`（默认 30）  
  - `durationInFrames` 来自 `getContentEndSec(project)` × fps

## 配置

- `remotion.config.ts`：CLI 行为（例如覆盖输出文件等）。

## 常用命令

在项目根目录：

| 命令 | 作用 |
|------|------|
| `npm run dev` | 启动 Remotion Studio（入口 `remotion/index.ts`） |
| `npm run typecheck` | TypeScript 检查（含 `src/` 与 `remotion/`） |
| `npm run render:916` | 渲染竖屏到 `out/analysis-916.mp4` |
| `npm run render:169` | 渲染横屏到 `out/analysis-169.mp4` |
| `npm run prepare-audio` | 生成占位静音 WAV（`public/audio/demo-track.wav`） |

首次使用 `remotion render` / `compositions` 等子命令时，CLI 可能会 **下载 Chrome Headless Shell**，属正常。

## 默认工程数据

- `remotion/defaultProject.ts` 从 `examples/example.project.json` 导入，作为 Studio 默认 `defaultProps`。

## TypeScript 与打包

- 使用 `moduleResolution: "Bundler"`，相对路径 **不写 `.js` 后缀**，以便与 Remotion 的 Webpack 解析一致（见根目录 `tsconfig.json`）。
