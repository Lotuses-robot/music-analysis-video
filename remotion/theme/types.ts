import type { MusicAnalysisVideoProject } from "../../src/types/project";

/** Static theme recipe (no canvas size). */
export type ThemeDefinition = {
  id: string;
  fontFamily: string;
  colors: {
    background: string;
    text: string;
    textMuted: string;
    accent: string;
    chartSurface: string;
    sectionBackground: string;
  };
  layout: {
    padRatio: number;
    gapVertical: number;
    gapHorizontal: number;
    chartHeightRatioVertical: number;
    chartHeightRatioHorizontal: number;
    sectionBorderLeftPx: number;
    sectionPaddingPx: number;
    sectionRadiusPx: number;
    chartRadiusPx: number;
    emotionStrokePx: number;
    playheadStrokePx: number;
  };
  typography: {
    vertical: ThemeTypographyBlock;
    horizontal: ThemeTypographyBlock;
  };
};

export type ThemeTypographyBlock = {
  title: number;
  artist: number;
  meta: number;
  chord: number;
  chordNext: number;
  sectionLabel: number;
  sectionBody: number;
  chartCaption: number;
  footer: number;
};

/** Fully resolved for the current composition size (px / ready-to-use styles). */
export type ResolvedTheme = {
  id: string;
  fontFamily: string;
  colors: ThemeDefinition["colors"];
  pad: number;
  gap: number;
  chartHeight: number;
  chartWidth: number;
  layout: ThemeDefinition["layout"];
  type: ThemeTypographyBlock;
};

export type FrameAnalysis = {
  timeSec: number;
  beat: number;
  chordSymbol: string;
  nextChordSymbol: string | null;
  sectionLabel: string | null;
  sectionComment: string | null;
  sectionCommentStyle?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
  } | null;
  keyLabel: string;
  timeSignatureLabel: string;
  bpmHint: number | null;
  emotionLinePath: string;
  playheadX: number;
  barNumber: number;
  beatInBar: number;
  beatsPerBar: number;
  sectionChords: {
    symbol: string;
    beat: number;
    isActive: boolean;
  }[];
};

export type AnalysisLayoutProps = {
  project: MusicAnalysisVideoProject;
  theme: ResolvedTheme;
  analysis: FrameAnalysis;
};
