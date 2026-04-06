import type { CalculateMetadataFunction } from "remotion";
import type { MusicAnalysisVideoProject } from "../src/types/project";
import { getContentEndSec, getFps } from "../src/analysis/duration";

export type AnalysisVideoProps = {
  project: MusicAnalysisVideoProject;
};

export const calculateAnalysisMetadata: CalculateMetadataFunction<AnalysisVideoProps> = ({
  props,
  compositionId,
}) => {
  const fps = getFps(props.project);
  const durationSec = getContentEndSec(props.project);
  const vertical = compositionId === "Analysis916";
  return {
    fps,
    durationInFrames: Math.max(1, Math.ceil(durationSec * fps)),
    width: vertical ? 1080 : 1920,
    height: vertical ? 1920 : 1080,
    props,
  };
};
