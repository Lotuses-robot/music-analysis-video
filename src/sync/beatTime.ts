import type { ProjectSync, SyncAnchor } from "../types/project";

function sortedAnchors(anchors: readonly SyncAnchor[]): SyncAnchor[] {
  if (anchors.length === 0) return [];
  // 1. 按拍数排序
  const sorted = [...anchors].sort((a, b) => a.beat - b.beat);
  
  // 2. 去重并确保时间单调递增
  const result: SyncAnchor[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = result[result.length - 1];
    const curr = sorted[i];
    
    // 如果拍数相同，跳过（或者覆盖，这里选择跳过）
    if (curr.beat <= prev.beat) continue;
    
    // 强制时间单调递增：当前点的时间不能早于前一个点
    // 这解决了 project.json 中可能存在的错误数据导致的“排版炸裂”
    const safeTime = Math.max(curr.timeSec, prev.timeSec);
    result.push({ beat: curr.beat, timeSec: safeTime });
  }
  
  return result;
}

function extrapolationMode(sync: ProjectSync): NonNullable<ProjectSync["extrapolation"]> {
  // 强制使用 linear 外推，避免 clamp 模式导致音频末尾或开头的小节线重叠（排版炸裂）
  // 即使 project.json 中设置了 clamp，在编辑器和渲染逻辑中也优先保证时间轴的连续性
  return "linear";
}

/**
 * 将音乐拍数映射到音频时间（秒）。
 * 使用分段线性插值计算。
 * @param beat 目标拍数
 * @param sync 同步配置（包含锚点和外推模式）
 * @returns 对应的音频时间（秒）
 */
export function beatToTime(beat: number, sync: ProjectSync): number {
  const mode = extrapolationMode(sync);
  const a = sortedAnchors(sync.anchors);
  if (a.length === 0) {
    throw new Error("sync.anchors must contain at least one point");
  }
  if (a.length === 1) {
    // 如果只有一个锚点，尝试根据 BPM 提示进行线性外推
    const bpm = sync.bpmDisplayHint || 120;
    const secondsPerBeat = 60 / bpm;
    return a[0].timeSec + (beat - a[0].beat) * secondsPerBeat;
  }

  if (beat <= a[0].beat) {
    if (mode === "clamp") return a[0].timeSec;
    const slope = (a[1].timeSec - a[0].timeSec) / (a[1].beat - a[0].beat);
    return a[0].timeSec + (beat - a[0].beat) * slope;
  }

  const last = a[a.length - 1];
  if (beat >= last.beat) {
    if (mode === "clamp") return last.timeSec;
    const prev = a[a.length - 2];
    const slope = (last.timeSec - prev.timeSec) / (last.beat - prev.beat);
    return last.timeSec + (beat - last.beat) * slope;
  }

  for (let i = 0; i < a.length - 1; i++) {
    const left = a[i];
    const right = a[i + 1];
    if (beat >= left.beat && beat <= right.beat) {
      if (right.beat === left.beat) return left.timeSec;
      const t =
        left.timeSec + ((beat - left.beat) / (right.beat - left.beat)) * (right.timeSec - left.timeSec);
      return t;
    }
  }

  return last.timeSec;
}

/**
 * 将音频时间（秒）映射到音乐拍数。
 * beatToTime 的反函数。
 * @param timeSec 音频时间（秒）
 * @param sync 同步配置
 * @returns 对应的绝对拍数
 */
export function timeToBeat(timeSec: number, sync: ProjectSync): number {
  const mode = extrapolationMode(sync);
  const a = sortedAnchors(sync.anchors);
  if (a.length === 0) {
    throw new Error("sync.anchors must contain at least one point");
  }
  if (a.length === 1) {
    // 如果只有一个锚点，尝试根据 BPM 提示进行线性外推
    const bpm = sync.bpmDisplayHint || 120;
    const secondsPerBeat = 60 / bpm;
    const beatsPerSecond = 1 / secondsPerBeat;
    return a[0].beat + (timeSec - a[0].timeSec) * beatsPerSecond;
  }

  if (timeSec <= a[0].timeSec) {
    if (mode === "clamp") return a[0].beat;
    const slope = (a[1].beat - a[0].beat) / (a[1].timeSec - a[0].timeSec);
    return a[0].beat + (timeSec - a[0].timeSec) * slope;
  }

  const last = a[a.length - 1];
  if (timeSec >= last.timeSec) {
    if (mode === "clamp") return last.beat;
    const prev = a[a.length - 2];
    const slope = (last.beat - prev.beat) / (last.timeSec - prev.timeSec);
    return last.beat + (timeSec - last.timeSec) * slope;
  }

  for (let i = 0; i < a.length - 1; i++) {
    const left = a[i];
    const right = a[i + 1];
    if (timeSec >= left.timeSec && timeSec <= right.timeSec) {
      if (right.timeSec === left.timeSec) return left.beat;
      return left.beat + ((timeSec - left.timeSec) / (right.timeSec - left.timeSec)) * (right.beat - left.beat);
    }
  }

  return last.beat;
}

/**
 * 将拍数映射到视频帧。
 * @param beat 目标拍数
 * @param sync 同步配置
 * @param fps 视频帧率
 * @returns 对应的视频帧号
 */
export function beatToFrame(beat: number, sync: ProjectSync, fps: number): number {
  return Math.round(beatToTime(beat, sync) * fps);
}

/**
 * 当拍号改变时，重新映射同步锚点以保持物理时间对齐。
 */
export function remapSyncAfterTimeSignatureChange(
  anchors: SyncAnchor[],
  oldMeasures: { timeSignature: { upper: number } }[],
  newMeasures: { timeSignature: { upper: number } }[],
  changeIdx: number
): SyncAnchor[] {
  // 1. 计算旧/新每小节的起始绝对拍数
  const oldStarts = [0];
  for (let i = 0; i < oldMeasures.length; i++) {
    oldStarts.push(oldStarts[i] + oldMeasures[i].timeSignature.upper);
  }

  const newStarts = [0];
  for (let i = 0; i < newMeasures.length; i++) {
    newStarts.push(newStarts[i] + newMeasures[i].timeSignature.upper);
  }

  // 2. 核心重映射逻辑
  return anchors.map(a => {
    // 找到该锚点所在的旧小节索引
    let mIdx = 0;
    for (let i = 0; i < oldMeasures.length; i++) {
      if (a.beat < oldStarts[i + 1]) {
        mIdx = i;
        break;
      }
      mIdx = i;
    }

    const oldStart = oldStarts[mIdx];
    const oldLen = oldMeasures[mIdx].timeSignature.upper;
    const ratio = (a.beat - oldStart) / oldLen;

    const newStart = newStarts[mIdx];
    const newLen = newMeasures[mIdx].timeSignature.upper;
    const newBeat = newStart + (newLen * ratio);

    return { ...a, beat: Number(newBeat.toFixed(4)) };
  });
}
