import type { FC } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { beatToTime } from "../../src/sync/beatTime";
import { getActiveChord } from "../../src/analysis/selectors";
import type { AnalysisLayoutProps } from "../theme/types";

/**
 * 基于主题的分析布局组件。
 * 负责渲染具体的视觉元素，如波形图、和弦标签、进度条等。
 * @param props 组件属性
 * @param props.project 项目数据
 * @param props.theme 经过解析的主题配置
 * @param props.analysis 当前帧的分析结果
 */
export const ThemedAnalysisLayout: FC<AnalysisLayoutProps> = ({ project, theme, analysis }) => {
  const { colors, pad, gap, chartWidth, chartHeight, layout, type, fontFamily } = theme;
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Find the beat of the active chord to calculate its start frame
  const activeChord = getActiveChord(project, analysis.beat);
  const activeChordBeat = activeChord?.beat ?? 0;

  const chordStartSec = beatToTime(activeChordBeat, project.sync);
  const chordStartFrame = Math.floor(chordStartSec * fps);

  const chordSpring = spring({
    frame: frame - chordStartFrame,
    fps,
    config: { stiffness: 120, damping: 14 },
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: `${pad}px`,
        display: "flex",
        flexDirection: "column",
        gap: `${gap}px`,
        fontFamily,
        color: colors.text,
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
        <div>
          <div style={{ fontSize: `${type.title}px`, fontWeight: 700, letterSpacing: "-0.02em" }}>{project.meta.title}</div>
          {project.meta.artist ? (
            <div style={{ fontSize: `${type.artist}px`, color: colors.textMuted, marginTop: "4px" }}>{project.meta.artist}</div>
          ) : null}
        </div>
        <div style={{ textAlign: "right", fontSize: `${type.meta}px`, color: colors.textMuted, lineHeight: 1.5 }}>
          <div>{analysis.timeSignatureLabel}</div>
          <div>{analysis.keyLabel}</div>
          {analysis.bpmHint !== null ? <div>~{analysis.bpmHint} BPM</div> : null}
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
          <div
            style={{
              fontSize: `${type.chord}px`,
              fontWeight: 900,
              letterSpacing: "-0.04em",
              color: colors.accent,
              lineHeight: 1,
              transform: `scale(${0.98 + 0.04 * chordSpring})`,
              opacity: 0.9 + 0.1 * chordSpring,
              textShadow: `0 0 20px ${colors.accent}33`,
            }}
          >
            {analysis.chordSymbol}
          </div>
          <div
            style={{
              fontSize: `${type.meta}px`,
              fontWeight: 700,
              padding: "4px 10px",
              background: colors.accent,
              borderRadius: "4px",
              boxShadow: `0 0 15px ${colors.accent}44`,
              color: colors.background,
            }}
          >
            BAR {analysis.barNumber}
          </div>
        </div>

        {/* Chord Flow within current section */}
        {analysis.sectionChords.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              padding: "16px",
              background: colors.sectionBackground,
              borderRadius: `${layout.sectionRadiusPx}px`,
              border: `1px solid ${colors.chartSurface}`,
            }}
          >
            {analysis.sectionChords.map((c, i) => (
              <div
                key={`${c.beat}-${i}`}
                style={{
                  fontSize: `${type.sectionBody}px`,
                  fontWeight: c.isActive ? 700 : 500,
                  color: c.isActive ? colors.accent : colors.textMuted,
                  padding: "4px 12px",
                  borderRadius: "6px",
                  background: c.isActive ? colors.chartSurface : "transparent",
                  transform: c.isActive ? `scale(1.1)` : "scale(1)",
                  transition: "all 0.2s ease-out",
                  border: c.isActive ? `1px solid ${colors.accent}44` : "1px solid transparent",
                }}
              >
                {c.symbol}
              </div>
            ))}
          </div>
        )}

        {analysis.nextChordSymbol && !analysis.sectionChords.length ? (
          <div style={{ fontSize: `${type.chordNext}px`, color: colors.textMuted }}>
            下一和弦 <span style={{ color: colors.text }}>{analysis.nextChordSymbol}</span>
          </div>
        ) : null}
      </div>

      {analysis.sectionLabel ? (
        <div
          style={{
            borderLeft: `${layout.sectionBorderLeftPx}px solid ${colors.accent}`,
            paddingLeft: `${layout.sectionPaddingPx + 2}px`,
            background: colors.sectionBackground,
            borderRadius: `${layout.sectionRadiusPx}px`,
            paddingTop: `${layout.sectionPaddingPx}px`,
            paddingBottom: `${layout.sectionPaddingPx}px`,
            paddingRight: `${layout.sectionPaddingPx}px`,
            marginBottom: analysis.sectionComment ? "8px" : "0",
          }}
        >
          <div
            style={{
              fontSize: `${type.sectionLabel}px`,
              color: colors.textMuted,
              textTransform: "uppercase",
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            {analysis.sectionLabel}
          </div>
        </div>
      ) : null}

      <div
        style={{
          fontSize: `${analysis.sectionCommentStyle?.fontSize || type.sectionBody}px`,
          fontFamily: analysis.sectionCommentStyle?.fontFamily || "Inter",
          lineHeight: 1.5,
          color: colors.text,
          padding: "12px 16px",
          background: colors.sectionBackground || "rgba(255,255,255,0.03)",
          borderRadius: "8px",
          borderLeft: `3px solid ${analysis.sectionComment ? colors.accent : colors.textMuted + "44"}`,
          minHeight: "5em", // Standardized height for analysis text
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          transition: "all 0.3s ease",
          opacity: analysis.sectionComment ? 1 : 0.4,
        }}
      >
        <div style={{ fontSize: "11px", color: colors.textMuted, textTransform: "uppercase", marginBottom: "4px", fontWeight: 700, letterSpacing: "0.05em" }}>
          音乐赏析
        </div>
        <div style={{ flex: 1 }}>
          {analysis.sectionComment || ""}
        </div>
      </div>

      <div style={{ marginTop: "auto" }}>
        <div style={{ fontSize: `${type.chartCaption}px`, color: colors.textMuted, marginBottom: "6px" }}>情感线（示意）</div>
        <svg width={chartWidth} height={chartHeight} style={{ display: "block" }}>
          <rect width={chartWidth} height={chartHeight} rx={layout.chartRadiusPx} fill={colors.chartSurface} />
          {analysis.emotionLinePath ? (
            <path
              d={analysis.emotionLinePath}
              fill="none"
              stroke={colors.accent}
              strokeWidth={layout.emotionStrokePx}
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
        <div style={{ fontSize: `${type.footer}px`, color: colors.textMuted, textAlign: "center", marginTop: "4px" }}>
          {project.style.footerText}
        </div>
      ) : null}
    </div>
  );
};
