import { getContentEndSec, getFps } from "../../../src/analysis/duration";
import type { MusicAnalysisVideoProject } from "../../../src/types/project";

export type Aspect = "9:16" | "16:9";

export function getCompositionSize(aspect: Aspect): { width: number; height: number } {
  return aspect === "9:16" ? { width: 1080, height: 1920 } : { width: 1920, height: 1080 };
}

export function getPlayerTiming(project: MusicAnalysisVideoProject): {
  fps: number;
  durationInFrames: number;
} {
  const fps = getFps(project);
  const durationInFrames = Math.max(1, Math.ceil(getContentEndSec(project) * fps));
  return { fps, durationInFrames };
}
