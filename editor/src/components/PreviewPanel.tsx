import type { FC } from "react";
import { Player } from "@remotion/player";
import { AnalysisVideo } from "../../../remotion/AnalysisVideo";
import type { MusicAnalysisVideoProject } from "../../../src/types/project";
import { getCompositionSize, getPlayerTiming, type Aspect } from "../lib/playerConfig";

type Props = {
  project: MusicAnalysisVideoProject;
  aspect: Aspect;
};

export const PreviewPanel: FC<Props> = ({ project, aspect }) => {
  const { width, height } = getCompositionSize(aspect);
  const { fps, durationInFrames } = getPlayerTiming(project);

  return (
    <div>
      <div className="preview-toolbar">
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {width}×{height} · {fps}fps · {durationInFrames}f
        </span>
      </div>
      <div className="preview-frame">
        <Player
          acknowledgeRemotionLicense
          component={AnalysisVideo}
          inputProps={{ project }}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={fps}
          controls
          style={{ width: "100%" }}
          errorFallback={({ error }) => (
            <div className="preview-error" style={{ margin: 0 }}>
              {error.message}
            </div>
          )}
        />
      </div>
    </div>
  );
};
