import type { FC } from "react";
import { useMemo } from "react";
import type { MusicAnalysisVideoProject } from "../../../src/types/project";
import { getLastContentBeat } from "../../../src/analysis/duration";

interface TimelineProps {
  project: MusicAnalysisVideoProject;
  currentBeat: number;
  onSeek: (beat: number) => void;
}

export const Timeline: FC<TimelineProps> = ({ project, currentBeat, onSeek }) => {
  const maxBeat = useMemo(() => Math.max(getLastContentBeat(project) + 8, 32), [project]);
  
  // 缩放比例：1 beat 对应多少像素
  const zoom = 40; 
  const width = maxBeat * zoom;

  const renderTicks = () => {
    const ticks = [];
    for (let i = 0; i <= maxBeat; i++) {
      const isMajor = i % 4 === 0;
      ticks.push(
        <div
          key={i}
          onClick={() => onSeek(i)}
          style={{
            position: "absolute",
            left: i * zoom,
            bottom: 0,
            width: 1,
            height: isMajor ? 20 : 10,
            background: isMajor ? "#000" : "#ccc",
            cursor: "pointer",
          }}
        >
          {isMajor && (
            <span style={{ position: "absolute", top: -18, left: 2, fontSize: 10, color: "#666" }}>
              {i}
            </span>
          )}
        </div>
      );
    }
    return ticks;
  };

  const renderMarkers = (items: { beat: number; label: string; color: string }[], trackIndex: number) => {
    return items.map((item, i) => (
      <div
        key={`${trackIndex}-${i}`}
        onClick={() => onSeek(item.beat)}
        title={`${item.label} @ ${item.beat}`}
        style={{
          position: "absolute",
          left: item.beat * zoom,
          top: 25 + trackIndex * 20,
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: item.color,
          transform: "translateX(-50%)",
          cursor: "pointer",
          border: "1px solid rgba(0,0,0,0.1)",
          zIndex: 2,
        }}
      />
    ));
  };

  return (
    <div className="timeline-container">
      <div className="timeline-scroll" style={{ width: "100%", overflowX: "auto", padding: "20px 0", borderTop: "1px solid #000" }}>
        <div style={{ width, height: 120, position: "relative", margin: "0 20px" }}>
          {/* 刻度线 */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 1, background: "#000" }} />
          {renderTicks()}

          {/* 轨道 1: 和弦 */}
          {renderMarkers(project.chords.map(c => ({ beat: c.beat, label: c.symbol, color: "#7AE7C7" })), 0)}
          
          {/* 轨道 2: 段落 */}
          {renderMarkers(project.sections.map(s => ({ beat: s.startBeat, label: s.label, color: "#4d90fe" })), 1)}

          {/* 轨道 3: 调号/拍号变更 */}
          {renderMarkers([
            ...(project.key.changes ?? []).map(k => ({ beat: k.beat, label: k.key, color: "#f59e0b" })),
            ...(project.timeSignature.changes ?? []).map(t => ({ beat: t.beat, label: `${t.upper}/${t.lower}`, color: "#ec4899" }))
          ], 2)}

          {/* 播放头 */}
          <div
            style={{
              position: "absolute",
              left: currentBeat * zoom,
              top: 0,
              width: 2,
              height: "100%",
              background: "red",
              zIndex: 10,
              pointerEvents: "none",
            }}
          >
            <div style={{ position: "absolute", top: -5, left: -4, width: 10, height: 10, background: "red", borderRadius: "50%" }} />
          </div>
        </div>
      </div>
      <div style={{ padding: "4px 20px", fontSize: 11, color: "#888", display: "flex", gap: 15 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7AE7C7" }} /> 和弦</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4d90fe" }} /> 段落</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }} /> 调号</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#ec4899" }} /> 拍号</div>
      </div>
    </div>
  );
};
