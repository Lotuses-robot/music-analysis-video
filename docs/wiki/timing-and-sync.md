# 时间与同步

## 设计原则

- **编辑与数据层以「拍」为主**（和弦、段落、情感点都用 `beat`）。
- **与音频对齐**不依赖整曲固定 BPM，而用 **稀疏锚点** `{ beat, timeSec }`，中间 **线性插值**。
- **成片时间轴**使用 Remotion 的 `frame / fps`（秒），再映射到拍子。

## 实现位置

- 核心函数：[src/sync/beatTime.ts](../../src/sync/beatTime.ts)
  - `beatToTime(beat, sync)`
  - `timeToBeat(timeSec, sync)`
  - `beatToFrame(beat, sync, fps)`（辅助）
- `sync.extrapolation`：
  - **`clamp`**：超出首尾锚点时，钳在端点时间（默认）。
  - **`extend`**：用最外侧一段的斜率外推。

## 锚点约定

- 建议第一个锚点从 **`beat: 0`** 开始，避免「零点之前」歧义。
- `beat` 必须可按升序排列；同一 `beat` 多点时应避免矛盾（工具层以后可加校验）。

## 成片时长

- 逻辑：[src/analysis/duration.ts](../../src/analysis/duration.ts)
- 收集和弦、情感点、段落、锚点等涉及的 **最大拍号**，用 `beatToTime` 得到结束秒数，再加大约 **`TAIL_SEC`（2 秒）** 尾音。
- Remotion 侧通过 `calculateMetadata` 把该时长换算为 `durationInFrames`（见 [Remotion 与命令](remotion-workflow.md)）。

## 当前帧如何驱动画面

- [remotion/analysis/buildFrameAnalysis.ts](../../remotion/analysis/buildFrameAnalysis.ts) 在每一帧用 **当前 `timeSec`**：
  - `getBeatAtTimeSec` → 当前拍
  - 再选当前和弦、段落、调号、拍号
  - 计算情感折线路径与播放头横向位置（`playheadX`）

播放头位置公式：`timeSec / totalSec * chartWidth`（与锚点映射后的时间轴一致）。
