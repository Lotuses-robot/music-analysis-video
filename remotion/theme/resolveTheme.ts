import type { MusicAnalysisVideoProject } from "../../src/types/project";
import { defaultThemeId, themeRegistry } from "./registry";
import type { ResolvedTheme, ThemeDefinition } from "./types";

function mergeColors(base: ThemeDefinition["colors"], project: MusicAnalysisVideoProject): ThemeDefinition["colors"] {
  return {
    ...base,
    text: project.style?.primaryColor ?? base.text,
    accent: project.style?.secondaryColor ?? base.accent,
  };
}

export function resolveTheme(project: MusicAnalysisVideoProject, width: number, height: number): ResolvedTheme {
  const isVertical = height > width;
  const requested = project.style?.themeId?.trim();
  const picked = requested ? themeRegistry[requested] : undefined;
  const base = picked ?? themeRegistry[defaultThemeId];

  const colors = mergeColors(base.colors, project);
  const m = Math.min(width, height);
  const pad = Math.round(m * base.layout.padRatio);
  const gap = isVertical ? base.layout.gapVertical : base.layout.gapHorizontal;
  const chartHeight = Math.round(
    height * (isVertical ? base.layout.chartHeightRatioVertical : base.layout.chartHeightRatioHorizontal),
  );
  const chartWidth = Math.max(0, width - pad * 2);
  const type = isVertical ? base.typography.vertical : base.typography.horizontal;

  return {
    id: base.id,
    fontFamily: base.fontFamily,
    colors,
    pad,
    gap,
    chartHeight,
    chartWidth,
    layout: base.layout,
    type,
  };
}
