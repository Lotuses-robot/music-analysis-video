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

/**
 * 预览面板组件。
 * 集成了 Remotion Player，用于实时预览音乐分析视频。
 * @param props 组件属性
 * @param props.project 当前项目数据
 * @param props.aspect 视频比例 (9:16 或 16:9)
 * @param props.onFrameChange 帧变更时的回调
 * @param props.playerRef 外部传入的 Player 引用
 */
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    current.addEventListener("frameupdate", onFrameUpdate as any);
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
