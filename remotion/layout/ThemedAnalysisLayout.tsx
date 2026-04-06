import type { FC } from "react";
import type { AnalysisLayoutProps } from "../theme/types";

export const ThemedAnalysisLayout: FC<AnalysisLayoutProps> = ({ project, theme, analysis }) => {
  const { colors, pad, gap, chartWidth, chartHeight, layout, type, fontFamily } = theme;

  return (
    <div
      style={{
        position: "absolute",
        inset: pad,
        display: "flex",
        flexDirection: "column",
        gap,
        fontFamily,
        color: colors.text,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
        <div>
          <div style={{ fontSize: type.title, fontWeight: 700, letterSpacing: "-0.02em" }}>{project.meta.title}</div>
          {project.meta.artist ? (
            <div style={{ fontSize: type.artist, color: colors.textMuted, marginTop: 4 }}>{project.meta.artist}</div>
          ) : null}
        </div>
        <div style={{ textAlign: "right", fontSize: type.meta, color: colors.textMuted, lineHeight: 1.5 }}>
          <div>{analysis.timeSignatureLabel}</div>
          <div>{analysis.keyLabel}</div>
          {analysis.bpmHint !== null ? <div>~{analysis.bpmHint} BPM</div> : null}
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 12 }}>
        <div
          style={{
            fontSize: type.chord,
            fontWeight: 800,
            letterSpacing: "-0.03em",
            color: colors.accent,
            lineHeight: 1,
          }}
        >
          {analysis.chordSymbol}
        </div>
        {analysis.nextChordSymbol ? (
          <div style={{ fontSize: type.chordNext, color: colors.textMuted }}>
            下一和弦 <span style={{ color: colors.text }}>{analysis.nextChordSymbol}</span>
          </div>
        ) : null}
      </div>

      {analysis.sectionLabel ? (
        <div
          style={{
            borderLeft: `${layout.sectionBorderLeftPx}px solid ${colors.accent}`,
            paddingLeft: layout.sectionPaddingPx + 2,
            background: colors.sectionBackground,
            borderRadius: layout.sectionRadiusPx,
            paddingTop: layout.sectionPaddingPx,
            paddingBottom: layout.sectionPaddingPx,
            paddingRight: layout.sectionPaddingPx,
          }}
        >
          <div
            style={{
              fontSize: type.sectionLabel,
              color: colors.textMuted,
              textTransform: "uppercase",
            }}
          >
            {analysis.sectionLabel}
          </div>
          {analysis.sectionComment ? (
            <div style={{ fontSize: type.sectionBody, marginTop: 6, lineHeight: 1.45 }}>{analysis.sectionComment}</div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: "auto" }}>
        <div style={{ fontSize: type.chartCaption, color: colors.textMuted, marginBottom: 6 }}>旋律线（示意）</div>
        <svg width={chartWidth} height={chartHeight} style={{ display: "block" }}>
          <rect width={chartWidth} height={chartHeight} rx={layout.chartRadiusPx} fill={colors.chartSurface} />
          {analysis.melodyLinePath ? (
            <path
              d={analysis.melodyLinePath}
              fill="none"
              stroke={colors.accent}
              strokeWidth={layout.melodyStrokePx}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          <line
            x1={analysis.playheadX}
            x2={analysis.playheadX}
            y1={4}
            y2={chartHeight - 4}
            stroke={colors.text}
            strokeWidth={layout.playheadStrokePx}
            opacity={0.85}
          />
        </svg>
      </div>

      {project.style?.footerText ? (
        <div style={{ fontSize: type.footer, color: colors.textMuted, textAlign: "center", marginTop: 4 }}>
          {project.style.footerText}
        </div>
      ) : null}
    </div>
  );
};
