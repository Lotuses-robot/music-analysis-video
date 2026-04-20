import type { ProjectSync, SyncAnchor } from "../types/project";

function sortedAnchors(anchors: readonly SyncAnchor[]): SyncAnchor[] {
  return [...anchors].sort((a, b) => a.beat - b.beat);
}

function extrapolationMode(sync: ProjectSync): NonNullable<ProjectSync["extrapolation"]> {
  return sync.extrapolation ?? "clamp";
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
    return a[0].timeSec;
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
    return a[0].beat;
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
