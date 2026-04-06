import type { FC } from "react";
import { Composition } from "remotion";
import { AnalysisVideo } from "./AnalysisVideo";
import { calculateAnalysisMetadata } from "./metadata";
import { defaultProject } from "./defaultProject";

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
