import type { FC } from "react";
import { useMemo } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { buildFrameAnalysis } from "./analysis/buildFrameAnalysis";
import { ThemedAnalysisLayout } from "./layout/ThemedAnalysisLayout";
import { resolveTheme } from "./theme/resolveTheme";
import type { AnalysisVideoProps } from "./metadata";

/**
 * 核心视频组件：渲染 Remotion 视频的主入口。
 * @param root0
 * @param root0.project
 */
export const AnalysisVideo: FC<AnalysisVideoProps> = ({ project }) => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  
  const { theme, analysis, error } = useMemo(() => {
    try {
      const timeSec = frame / fps;
      const t = resolveTheme(project, width, height);
      const a = buildFrameAnalysis(project, timeSec, t.chartWidth, t.chartHeight);
      return { theme: t, analysis: a, error: null };
    } catch (err: any) {
      return { theme: null, analysis: null, error: err };
    }
  }, [project, width, height, fps, frame]);

  if (error) {
    return (
      <AbsoluteFill style={{ backgroundColor: "#300", color: "#f88", padding: 20, fontSize: 14 }}>
        <strong>AnalysisVideo Error:</strong><br/>
        {error.message}
      </AbsoluteFill>
    );
  }

  if (!theme || !analysis) return null;

  const offsetFrames = Math.round((project.meta.audioStartOffsetSec ?? 0) * fps);
  const audioSrc = project.meta.audioPath ? staticFile(project.meta.audioPath) : null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.background || "#111",
        fontFamily: theme.fontFamily,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {audioSrc ? (
        <Audio src={audioSrc} trimBefore={offsetFrames > 0 ? offsetFrames : undefined} />
      ) : null}

      <ThemedAnalysisLayout project={project} theme={theme} analysis={analysis} />
    </AbsoluteFill>
  );
};
