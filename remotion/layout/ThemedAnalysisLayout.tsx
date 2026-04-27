import type { FC } from "react";
import { spring, useCurrentFrame, useVideoConfig, AbsoluteFill } from "remotion";
import { beatToTime } from "../../src/sync/beatTime";
import { getActiveChord, getChordDegree } from "../../src/analysis/selectors";
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
  const { fps, durationInFrames } = useVideoConfig();

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

  const degree = getChordDegree(analysis.keyLabel, analysis.chordSymbol);
  const progress = frame / durationInFrames;

  return (
    <AbsoluteFill style={{ background: colors.background, overflow: "hidden" }}>
      {/* Dynamic Background Glow */}
      <div 
        style={{
          position: "absolute",
          top: "-20%",
          right: "-10%",
          width: "60%",
          height: "60%",
          background: `radial-gradient(circle, ${accentColor}15 0%, transparent 70%)`,
          filter: "blur(60px)",
          transition: "background 0.4s ease",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: `${pad}px`,
          display: "flex",
          flexDirection: "column",
          gap: `${gap}px`,
          fontFamily,
          color: colors.text,
          zIndex: 1,
        }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px" }}>
          <div>
            <div style={{ fontSize: `${type.title}px`, fontWeight: 900, letterSpacing: "-0.04em", textTransform: "uppercase" }}>{project.meta.title}</div>
            {project.meta.artist ? (
              <div style={{ fontSize: `${type.artist}px`, color: colors.textMuted, marginTop: "2px", fontWeight: 600, opacity: 0.8 }}>{project.meta.artist}</div>
            ) : null}
          </div>
          <div style={{ textAlign: "right", fontSize: `${type.meta}px`, color: colors.textMuted, lineHeight: 1.4 }}>
            <div style={{ fontWeight: 800, color: colors.text, letterSpacing: "0.05em" }}>{analysis.timeSignatureLabel}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "4px" }}>
              <span style={{ fontSize: "9px", opacity: 0.4, fontWeight: 900, letterSpacing: "0.1em" }}>TONALITY</span>
              <span style={{ color: accentColor, fontWeight: 900, fontSize: "1.2em" }}>{analysis.keyLabel}</span>
            </div>
          </div>
        </header>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "40px" }}>
          <div style={{ display: "flex", alignItems: "flex-end", gap: "24px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{
                  fontSize: `${type.chord}px`,
                  fontWeight: 900,
                  letterSpacing: "-0.05em",
                  color: accentColor,
                  lineHeight: 0.9,
                  transform: `scale(${0.98 + 0.05 * chordSpring})`,
                  textShadow: `0 0 40px ${accentColor}33`,
                  transition: "color 0.4s ease",
                }}
              >
                {analysis.chordSymbol}
              </div>
              {degree && degree !== analysis.chordSymbol && (
                <div style={{ fontSize: "24px", fontWeight: 700, opacity: 0.5, color: accentColor, marginLeft: "4px", letterSpacing: "0.05em" }}>
                  {degree}
                </div>
              )}
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingBottom: "10px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 900,
                  padding: "3px 10px",
                  background: accentColor,
                  borderRadius: "100px",
                  color: colors.background,
                  width: "fit-content",
                  transition: "background-color 0.4s ease",
                  letterSpacing: "0.05em",
                }}
              >
                BAR {analysis.barNumber}
              </div>
              <div style={{ fontSize: "13px", color: colors.textMuted, fontWeight: 700, letterSpacing: "0.02em" }}>
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
                columnGap: "20px",
                rowGap: "12px",
                padding: "20px 0",
                borderTop: `1px solid ${colors.chartSurface}66`,
                borderBottom: `1px solid ${colors.chartSurface}66`,
              }}
            >
              {analysis.sectionChords.map((c, i) => (
                <div
                  key={`${c.beat}-${i}`}
                  style={{
                    fontSize: `${type.sectionBody}px`,
                    fontWeight: c.isActive ? 900 : 500,
                    color: c.isActive ? accentColor : colors.textMuted,
                    transition: "all 0.2s ease-out",
                    opacity: c.isActive ? 1 : 0.4,
                    transform: c.isActive ? "translateY(-2px)" : "none",
                  }}
                >
                  <div style={{ fontSize: "0.7em", opacity: 0.5, marginBottom: "2px" }}>
                    {getChordDegree(analysis.keyLabel, c.symbol)}
                  </div>
                  {c.symbol}
                </div>
              ))}
            </div>
          )}
        </div>

        {analysis.sectionLabel ? (
          <div
            style={{
              padding: "12px 0",
              marginBottom: analysis.sectionComment ? "8px" : "0",
            }}
          >
            <div
              style={{
                fontSize: `${type.sectionLabel}px`,
                color: accentColor,
                textTransform: "uppercase",
                fontWeight: 900,
                letterSpacing: "0.2em",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ width: "24px", height: "2px", background: accentColor }} />
              {analysis.sectionLabel}
            </div>
          </div>
        ) : null}

        {analysis.sectionComment ? (
          <div
            style={{
              fontSize: `${analysis.sectionCommentStyle?.fontSize || type.sectionBody}px`,
              fontFamily: analysis.sectionCommentStyle?.fontFamily || fontFamily,
              lineHeight: 1.7,
              color: colors.text,
              padding: "24px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "8px",
              border: `1px solid ${colors.chartSurface}44`,
              minHeight: "7em",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              transition: "all 0.3s ease",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div 
              style={{ 
                position: "absolute", 
                left: 0, 
                top: 0, 
                bottom: 0, 
                width: "4px", 
                background: accentColor,
                opacity: 0.6
              }} 
            />
            <div style={{ fontSize: "10px", color: accentColor, textTransform: "uppercase", marginBottom: "12px", fontWeight: 900, letterSpacing: "0.15em", opacity: 0.8 }}>
              ANALYSIS
            </div>
            <div style={{ flex: 1, fontWeight: 500, opacity: 0.95, letterSpacing: "0.01em" }}>
              {analysis.sectionComment}
            </div>
          </div>
        ) : (
          <div style={{ minHeight: "7em" }} />
        )}

        <div style={{ marginTop: "32px" }}>
          {/* Progress Bar */}
          <div style={{ height: "2px", width: "100%", background: `${colors.chartSurface}44`, marginBottom: "20px", borderRadius: "1px", overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress * 100}%`, background: accentColor, transition: "width 0.1s linear" }} />
          </div>

          <svg width={chartWidth} height={chartHeight} style={{ display: "block", overflow: "visible" }}>
            <rect width={chartWidth} height={chartHeight} rx={4} fill={`${colors.chartSurface}33`} />
            {analysis.emotionLinePath ? (
              <>
                <path
                  d={analysis.emotionLinePath}
                  fill="none"
                  stroke={`${accentColor}33`}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: "stroke 0.4s ease", filter: "blur(4px)" }}
                />
                <path
                  d={analysis.emotionLinePath}
                  fill="none"
                  stroke={accentColor}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ transition: "stroke 0.4s ease" }}
                />
              </>
            ) : null}
            <line
              x1={analysis.playheadX}
              x2={analysis.playheadX}
              y1={-6}
              y2={chartHeight + 6}
              stroke={colors.text}
              strokeWidth={2}
              opacity={0.9}
            />
            <circle
              cx={analysis.playheadX}
              cy={chartHeight - ((analysis.currentEmotionValue - 60) / 12) * chartHeight}
              r={4}
              fill={accentColor}
              stroke={colors.text}
              strokeWidth={2}
            />
          </svg>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", alignItems: "center" }}>
            <span style={{ fontSize: "10px", color: colors.textMuted, fontWeight: 800, letterSpacing: "0.1em" }}>EMOTIONAL STATE</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: accentColor }} />
              <span style={{ fontSize: "12px", color: colors.text, fontWeight: 900 }}>{Math.round(analysis.currentEmotionValue)}°</span>
            </div>
          </div>
        </div>

        {project.style?.footerText ? (
          <div style={{ fontSize: `${type.footer}px`, color: colors.textMuted, textAlign: "center", marginTop: "12px", fontWeight: 600, opacity: 0.5, letterSpacing: "0.05em" }}>
            {project.style.footerText}
          </div>
        ) : null}
      </div>
    </AbsoluteFill>
  );
};
