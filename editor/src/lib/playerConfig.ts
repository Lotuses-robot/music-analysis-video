import { getContentEndSec, getFps } from "../../../src/analysis/duration";
import type { MusicAnalysisVideoProject } from "../../../src/types/project";

export type Aspect = "9:16" | "16:9";

/**
 * 获取指定比例的合成尺寸。
 * @param aspect 视频比例 (9:16 或 16:9)
 * @returns 包含宽度和高度的对象
 */
export function getCompositionSize(aspect: Aspect): { width: number; height: number } {
  return aspect === "9:16" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
}

/**
 * 获取 Remotion 播放器所需的时间配置。
 * @param project 当前项目数据
 * @returns 包含帧率和总帧数的对象
 */
export function getPlayerTiming(project: MusicAnalysisVideoProject): {
  fps: number;
  durationInFrames: number;
} {
  const fps = getFps(project);
  const durationInFrames = Math.max(1, Math.ceil(getContentEndSec(project) * fps));
  return { fps, durationInFrames };
}
