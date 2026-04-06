import type { ThemeDefinition } from "../types";

/** High-contrast light deck; same slots as minimal-dark, different palette + slightly roomier type. */
export const paperLightTheme: ThemeDefinition = {
  id: "paper-light",
  fontFamily: "Georgia, 'Times New Roman', serif",
  colors: {
    background: "#F4F1EA",
    text: "#1A1A1C",
    textMuted: "rgba(26, 26, 28, 0.55)",
    accent: "#B45309",
    chartSurface: "rgba(26, 26, 28, 0.06)",
    sectionBackground: "rgba(26, 26, 28, 0.05)",
  },
  layout: {
    padRatio: 0.065,
    gapVertical: 14,
    gapHorizontal: 18,
    chartHeightRatioVertical: 0.15,
    chartHeightRatioHorizontal: 0.19,
    sectionBorderLeftPx: 5,
    sectionPaddingPx: 14,
    sectionRadiusPx: 10,
    chartRadiusPx: 12,
    melodyStrokePx: 3,
    playheadStrokePx: 2,
  },
  typography: {
    vertical: {
      title: 28,
      artist: 16,
      meta: 14,
      chord: 82,
      chordNext: 17,
      sectionLabel: 13,
      sectionBody: 18,
      chartCaption: 12,
      footer: 11,
    },
    horizontal: {
      title: 36,
      artist: 18,
      meta: 15,
      chord: 108,
      chordNext: 21,
      sectionLabel: 15,
      sectionBody: 21,
      chartCaption: 12,
      footer: 11,
    },
  },
};
