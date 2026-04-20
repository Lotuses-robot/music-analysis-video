import type { CalculateMetadataFunction } from "remotion";
import type { MusicAnalysisVideoProject } from "../src/types/project";
import { getContentEndSec, getFps } from "../src/analysis/duration";

export type AnalysisVideoProps = {
  project: MusicAnalysisVideoProject;
};

/**
 * 动态计算 Remotion 合成的元数据（帧率、总帧数、分辨率）。
 * @param root0 包含 props 和 compositionId 的对象
 * @param root0.props 传入组件的属性，包含项目数据
 * @param root0.compositionId 当前合成的 ID，用于区分横竖屏
 * @returns 计算后的元数据对象
 */
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
