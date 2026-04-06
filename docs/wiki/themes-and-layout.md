# 主题与画面

## 分层（渲染逻辑 vs 主题逻辑）

目标：**同一套乐理/时间逻辑**，换主题只换「长什么样」，尽量不碰选和弦、算拍子。

| 层级 | 位置 | 职责 |
|------|------|------|
| 主题配方 | `remotion/theme/themes/*.ts` | 颜色、字体族、间距比例、各块字号、图表描边等 **与画布尺寸无关的常量** |
| 注册表 | `remotion/theme/registry.ts` | `themeId` → 配方 |
| 解析 | `remotion/theme/resolveTheme.ts` | 根据 **当前 composition 宽高** 计算 `pad`、`chartWidth`、`chartHeight`；把 `style.primaryColor` / `secondaryColor` **覆盖**到主题默认的 `text` / `accent` |
| 帧数据 | `remotion/analysis/buildFrameAnalysis.ts` | 仅依赖 `project` + 时间 + 图表尺寸，**不读主题** |
| 版式组件 | `remotion/layout/ThemedAnalysisLayout.tsx` | 只消费 `ResolvedTheme` + `FrameAnalysis`，拼装 DOM/SVG |

入口 [remotion/AnalysisVideo.tsx](../../remotion/AnalysisVideo.tsx)：**音频**、**背景色**、`resolveTheme` → `buildFrameAnalysis` → `ThemedAnalysisLayout`。

## 内置主题

| `themeId` | 文件 | 说明 |
|-----------|------|------|
| `minimal-dark` | `themes/minimalDark.ts` | 默认；深色底、亮色字、青绿强调 |
| `paper-light` | `themes/paperLight.ts` | 浅色纸张感、衬线标题气质 |

未知或空的 `themeId` 会 **回退到 `minimal-dark`**。

## 扩展新主题

1. 新增 `remotion/theme/themes/<name>.ts`，导出满足 `ThemeDefinition` 的对象（见 `remotion/theme/types.ts`）。
2. 在 `registry.ts` 中注册。
3. 若需要 **完全不同的区块结构**（不仅是换色/字号），可新增第二个 `*Layout.tsx`，在 `AnalysisVideo` 里按 `theme.id` 分支挂载（当前两套主题共用 `ThemedAnalysisLayout`）。
