import type { FC } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { useEffect, useRef, useMemo, memo } from "react";
import { AnalysisVideo } from "../../../remotion/AnalysisVideo";
import type { MusicAnalysisVideoProject } from "../../../src/types/project";
import { getCompositionSize, getPlayerTiming, type Aspect } from "../lib/playerConfig";

type Props = {
  project: MusicAnalysisVideoProject;
  aspect: Aspect;
  onFrameChange?: (frame: number) => void;
  playerRef?: React.RefObject<PlayerRef | null>;
};

export const PreviewPanel: FC<Props> = memo(({ project, aspect, onFrameChange, playerRef: externalRef }) => {
  const { width, height } = getCompositionSize(aspect);
  const { fps, durationInFrames } = getPlayerTiming(project);
  const internalRef = useRef<PlayerRef>(null);
  const playerRef = externalRef || internalRef;

  const inputProps = useMemo(() => ({ project }), [project]);

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
  }, [onFrameChange, playerRef]);

  return (
    <div className="preview-panel-root">
      <div className="preview-toolbar">
        {width}×{height} · {fps}fps · {durationInFrames}f
      </div>
      <div className="preview-player-container">
        <Player
          ref={playerRef}
          acknowledgeRemotionLicense
          component={AnalysisVideo}
          inputProps={inputProps}
          durationInFrames={durationInFrames}
          compositionWidth={width}
          compositionHeight={height}
          fps={fps}
          controls={false} // Disable Remotion's controls
          style={{ 
            width: "100%",
            height: "100%",
            backgroundColor: "#000",
          }}
          errorFallback={({ error }) => (
            <div className="preview-error">
              <strong>渲染错误:</strong><br/>
              {error.message}
            </div>
          )}
        />
      </div>
    </div>
  );
});

PreviewPanel.displayName = "PreviewPanel";
