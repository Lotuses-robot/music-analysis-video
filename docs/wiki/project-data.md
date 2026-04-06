# 工程数据格式

## 权威来源

- **JSON Schema**：[schemas/project.schema.json](../../schemas/project.schema.json)
- **TypeScript 类型**：[src/types/project.ts](../../src/types/project.ts)
- **示例工程**：[examples/example.project.json](../../examples/example.project.json)

## 顶层结构

| 字段 | 作用 |
|------|------|
| `schemaVersion` | 工程格式版本，便于以后迁移 |
| `meta` | 标题、艺人、音频路径、可选片头裁剪秒数、`bpmDisplayHint`（仅展示，真实时间以锚点为准） |
| `sync` | 拍 ↔ 时间的稀疏锚点 + 外推策略 |
| `timeSignature` | 默认拍号 + 可选 `changes[]` |
| `key` | 默认调号 + 可选 `changes[]` |
| `sections` | 段落标签、起止拍、可选评语（会出现在视频里） |
| `chords` | 和弦事件：`beat` + 显示字符串（如 `Am7`） |
| `melody` | 旋律示意点：`beat` + MIDI 音高 |
| `style` | `themeId`、主色/强调色（十六进制）、页脚文案 |
| `export` | 默认 `fps`、`defaultComposition`（工程级偏好，具体成片在 Remotion 里选 Composition） |

## 音频路径

- `meta.audioPath` 指向 **相对于 Remotion `public/` 目录** 的文件（例如 `audio/demo-track.wav` → 文件在 `public/audio/demo-track.wav`）。
- `meta.audioStartOffsetSec`：从源文件开头裁掉若干秒再播放（与 Remotion `<Audio trimBefore={帧}>` 对应）。

## 和弦与拍子

- 和弦、段落、旋律等 **逻辑时间一律用 `beat`**（可为小数），便于按小节思考。
- 与真实音频对齐通过 `sync.anchors` 分段线性映射完成，见 [时间与同步](timing-and-sync.md)。
