import type { FC } from "react";
import { Composition } from "remotion";
import { AnalysisVideo } from "./AnalysisVideo";
import { calculateAnalysisMetadata } from "./metadata";
import { defaultProject } from "./defaultProject";

/**
 * Remotion 项目根组件。
 * 定义了所有的视频合成（Compositions）及其元数据计算逻辑。
 */
export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="Analysis916"
        component={AnalysisVideo}
        defaultProps={{ project: defaultProject }}
        calculateMetadata={calculateAnalysisMetadata}
      />
      <Composition
        id="Analysis169"
        component={AnalysisVideo}
        defaultProps={{ project: defaultProject }}
        calculateMetadata={calculateAnalysisMetadata}
      />
    </>
  );
};
