import type { FC } from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { beatToTime } from "../../src/sync/beatTime";
import { getActiveChord } from "../../src/analysis/selectors";
import type { AnalysisLayoutProps } from "../theme/types";
import { interpolateColors } from "remotion";

/**
 * 映射情感温度到颜色
 */
const getEmotionColor = (value: number, baseAccent: string) => {
  // Normalize value to 0-1 range (assuming 60-72 range)
  const normalized = Math.max(0, Math.min(1, (value - 60) / 12));
  
  // Define a gradient: Cold (Blue) -> Neutral (Accent) -> Hot (Red)
  return interpolateColors(
    normalized,
    [0, 0.5, 1],
    ["#4D90FE", baseAccent, "#FF4D4D"]
  );
};

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

  const accentColor = getEmotionColor(analysis.currentEmotionValue, colors.accent);

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
          <div style={{ fontSize: `${type.title}px`, fontWeight: 800, letterSpacing: "-0.03em" }}>{project.meta.title}</div>
          {project.meta.artist ? (
            <div style={{ fontSize: `${type.artist}px`, color: colors.textMuted, marginTop: "2px", fontWeight: 500 }}>{project.meta.artist}</div>
          ) : null}
        </div>
        <div style={{ textAlign: "right", fontSize: `${type.meta}px`, color: colors.textMuted, lineHeight: 1.4 }}>
          <div style={{ fontWeight: 700, color: colors.text }}>{analysis.timeSignatureLabel}</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
            <span style={{ fontSize: "10px", opacity: 0.5 }}>TONALITY</span>
            <span style={{ color: accentColor, fontWeight: 800 }}>{analysis.keyLabel}</span>
          </div>
          {analysis.bpmHint !== null ? <div style={{ fontSize: "11px", opacity: 0.6 }}>{analysis.bpmHint} BPM</div> : null}
        </div>
      </header>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              fontSize: `${type.chord}px`,
              fontWeight: 900,
              letterSpacing: "-0.05em",
              color: accentColor,
              lineHeight: 1,
              transform: `scale(${0.97 + 0.06 * chordSpring})`,
              opacity: 0.9 + 0.1 * chordSpring,
              textShadow: `0 0 30px ${accentColor}44`,
              transition: "color 0.4s ease",
            }}
          >
            {analysis.chordSymbol}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <div
              style={{
                fontSize: `${type.meta}px`,
                fontWeight: 800,
                padding: "2px 8px",
                background: accentColor,
                borderRadius: "2px",
                color: colors.background,
                width: "fit-content",
                transition: "background-color 0.4s ease",
              }}
            >
              BAR {analysis.barNumber}
            </div>
            <div style={{ fontSize: "12px", color: colors.textMuted, fontWeight: 600 }}>
              BEAT {Math.floor(analysis.beatInBar)} / {analysis.beatsPerBar}
            </div>
          </div>
        </div>

        {/* Chord Flow within current section */}
        {analysis.sectionChords.length > 0 && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "8px",
              padding: "12px 0",
              borderTop: `1px solid ${colors.chartSurface}`,
              borderBottom: `1px solid ${colors.chartSurface}`,
            }}
          >
            {analysis.sectionChords.map((c, i) => (
              <div
                key={`${c.beat}-${i}`}
                style={{
                  fontSize: `${type.sectionBody}px`,
                  fontWeight: c.isActive ? 800 : 400,
                  color: c.isActive ? accentColor : colors.textMuted,
                  padding: "4px 8px",
                  transition: "all 0.2s ease-out",
                  borderBottom: c.isActive ? `2px solid ${accentColor}` : "2px solid transparent",
                }}
              >
                {c.symbol}
              </div>
            ))}
          </div>
        )}
      </div>

      {analysis.sectionLabel ? (
        <div
          style={{
            background: `${accentColor}11`,
            borderLeft: `2px solid ${accentColor}`,
            padding: "8px 12px",
            borderRadius: "0 4px 4px 0",
            marginBottom: analysis.sectionComment ? "12px" : "0",
            transition: "all 0.4s ease",
          }}
        >
          <div
            style={{
              fontSize: `${type.sectionLabel}px`,
              color: accentColor,
              textTransform: "uppercase",
              fontWeight: 800,
              letterSpacing: "0.15em",
            }}
          >
            {analysis.sectionLabel}
          </div>
        </div>
      ) : null}

      {analysis.sectionComment ? (
        <div
          style={{
            fontSize: `${analysis.sectionCommentStyle?.fontSize || type.sectionBody}px`,
            fontFamily: analysis.sectionCommentStyle?.fontFamily || fontFamily,
            lineHeight: 1.6,
            color: colors.text,
            padding: "16px",
            background: "rgba(255,255,255,0.02)",
            borderRadius: "4px",
            border: `1px solid ${colors.chartSurface}`,
            minHeight: "6em",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            transition: "all 0.3s ease",
          }}
        >
          <div style={{ fontSize: "10px", color: colors.textMuted, textTransform: "uppercase", marginBottom: "8px", fontWeight: 800, letterSpacing: "0.1em" }}>
            ANALYTIC INSIGHT
          </div>
          <div style={{ flex: 1, fontWeight: 400, opacity: 0.9 }}>
            {analysis.sectionComment}
          </div>
        </div>
      ) : (
        <div style={{ minHeight: "6em" }} />
      )}

      <div style={{ marginTop: "24px" }}>
        <svg width={chartWidth} height={chartHeight} style={{ display: "block", overflow: "visible" }}>
          <rect width={chartWidth} height={chartHeight} rx={2} fill={colors.chartSurface} />
          {analysis.emotionLinePath ? (
            <path
              d={analysis.emotionLinePath}
              fill="none"
              stroke={accentColor}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ transition: "stroke 0.4s ease" }}
            />
          ) : null}
          <line
            x1={analysis.playheadX}
            x2={analysis.playheadX}
            y1={-4}
            y2={chartHeight + 4}
            stroke={colors.text}
            strokeWidth={2}
            opacity={0.8}
          />
        </svg>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
          <span style={{ fontSize: "9px", color: colors.textMuted, fontWeight: 700, letterSpacing: "0.05em" }}>EMOTIONAL TEMPERATURE</span>
          <span style={{ fontSize: "9px", color: accentColor, fontWeight: 800 }}>{Math.round(analysis.currentEmotionValue)}°</span>
        </div>
      </div>

      {project.style?.footerText ? (
        <div style={{ fontSize: `${type.footer}px`, color: colors.textMuted, textAlign: "center", marginTop: "4px" }}>
          {project.style.footerText}
        </div>
      ) : null}
    </div>
  );
};
