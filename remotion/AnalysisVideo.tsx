import type { FC } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { buildFrameAnalysis } from "./analysis/buildFrameAnalysis";
import { ThemedAnalysisLayout } from "./layout/ThemedAnalysisLayout";
import { resolveTheme } from "./theme/resolveTheme";
import type { AnalysisVideoProps } from "./metadata";

export const AnalysisVideo: FC<AnalysisVideoProps> = ({ project }) => {
  const { width, height, fps } = useVideoConfig();
  const frame = useCurrentFrame();
  const timeSec = frame / fps;

  const theme = resolveTheme(project, width, height);
  const analysis = buildFrameAnalysis(project, timeSec, theme.chartWidth, theme.chartHeight);

  const offsetFrames = Math.round((project.meta.audioStartOffsetSec ?? 0) * fps);
  const audioSrc = project.meta.audioPath ? staticFile(project.meta.audioPath) : null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.background,
        fontFamily: theme.fontFamily,
      }}
    >
      {audioSrc ? (
        <Audio src={audioSrc} trimBefore={offsetFrames > 0 ? offsetFrames : undefined} />
      ) : null}

      <ThemedAnalysisLayout project={project} theme={theme} analysis={analysis} />
    </AbsoluteFill>
  );
};
