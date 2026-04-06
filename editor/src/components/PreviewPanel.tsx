import type { FC } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef } from "react";
import { AnalysisVideo } from "../../../remotion/AnalysisVideo";
import type { MusicAnalysisVideoProject } from "../../../src/types/project";
import { getCompositionSize, getPlayerTiming, type Aspect } from "../lib/playerConfig";

type Props = {
  project: MusicAnalysisVideoProject;
  aspect: Aspect;
  onFrameChange?: (frame: number) => void;
  playerRef?: React.RefObject<PlayerRef | null>;
};

export const PreviewPanel: FC<Props> = ({ project, aspect, onFrameChange, playerRef: externalRef }) => {
  const { width, height } = getCompositionSize(aspect);
  const { fps, durationInFrames } = getPlayerTiming(project);
  const internalRef = useRef<PlayerRef>(null);
  const playerRef = externalRef || internalRef;

  useEffect(() => {
    const { current } = playerRef;
    if (!current) return;

    const onFrameUpdate = (e: CustomEvent<{ frame: number }>) => {
      onFrameChange?.(e.detail.frame);
    };

    current.addEventListener("frameupdate", onFrameUpdate as any);
    return () => {
      current.removeEventListener("frameupdate", onFrameUpdate as any);
    };
  }, [onFrameChange]);

  return (
    <div>
      <div className="preview-toolbar">
        <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>
          {width}×{height} · {fps}fps · {durationInFrames}f
        </span>
      </div>
      <div className="preview-frame">
        <Player
          ref={playerRef}
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
