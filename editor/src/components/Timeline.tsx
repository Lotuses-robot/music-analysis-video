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
            height: isMajor ? 15 : 6,
            background: isMajor ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.05)",
            cursor: "pointer",
            zIndex: 1,
          }}
        >
          {isMajor && (
            <span style={{ position: "absolute", top: -16, left: 2, fontSize: 9, color: "#999", fontWeight: 500 }}>
              {i}
            </span>
          )}
        </div>
      );
    }
    return ticks;
  };

  const renderChords = () => {
    return project.chords.map((c, i) => (
      <div
        key={`chord-${i}`}
        onClick={() => onSeek(c.beat)}
        title={`和弦: ${c.symbol} @ ${c.beat}`}
        style={{
          position: "absolute",
          left: c.beat * zoom,
          top: 30,
          width: 10,
          height: 10,
          borderRadius: "50%",
          background: "#7AE7C7",
          transform: "translateX(-50%)",
          cursor: "pointer",
          border: "2px solid white",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
          zIndex: 5,
        }}
      >
        <span style={{ position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)", fontSize: 10, whiteSpace: "nowrap", fontWeight: 600 }}>
          {c.symbol}
        </span>
      </div>
    ));
  };

  const renderSections = () => {
    return project.sections.map((s, i) => {
      const start = s.startBeat;
      const end = s.endBeat ?? maxBeat;
      const len = end - start;
      return (
        <div
          key={`section-${i}`}
          onClick={() => onSeek(start)}
          style={{
            position: "absolute",
            left: start * zoom,
            top: 75,
            width: len * zoom,
            height: 14,
            background: "#4d90fe22",
            borderLeft: "3px solid #4d90fe",
            cursor: "pointer",
            padding: "0 6px",
            fontSize: 10,
            color: "#4d90fe",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            overflow: "hidden",
            whiteSpace: "nowrap",
            zIndex: 3,
            borderRadius: "0 4px 4px 0",
          }}
        >
          {s.label}
        </div>
      );
    });
  };

  const renderChanges = () => {
    const changes = [
      ...(project.key.changes ?? []).map(k => ({ beat: k.beat, label: k.key, color: "#f59e0b" })),
      ...(project.timeSignature.changes ?? []).map(t => ({ beat: t.beat, label: `${t.upper}/${t.lower}`, color: "#ec4899" }))
    ];
    return changes.map((ch, i) => (
      <div
        key={`change-${i}`}
        onClick={() => onSeek(ch.beat)}
        style={{
          position: "absolute",
          left: ch.beat * zoom,
          top: 10,
          width: 2,
          height: 100,
          background: `${ch.color}33`,
          zIndex: 2,
        }}
      >
        <div 
          style={{ 
            background: ch.color, 
            color: "white", 
            fontSize: 9, 
            padding: "1px 4px", 
            borderRadius: 3,
            whiteSpace: "nowrap",
            position: "absolute",
            top: 0,
            left: 2
          }}
        >
          {ch.label}
        </div>
      </div>
    ));
  };

  return (
    <div className="timeline-container" style={{ border: "none", boxShadow: "none", background: "transparent" }}>
      <div className="timeline-scroll" style={{ width: "100%", overflowX: "auto", padding: "10px 0" }}>
        <div style={{ width, height: 130, position: "relative", margin: "0 20px" }}>
          {/* Base Line */}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 1, background: "rgba(0,0,0,0.1)" }} />
          
          {renderTicks()}
          {renderSections()}
          {renderChords()}
          {renderChanges()}

          {/* Playhead */}
          <div
            style={{
              position: "absolute",
              left: currentBeat * zoom,
              top: 0,
              width: 2,
              height: "100%",
              background: "var(--accent)",
              zIndex: 100,
              pointerEvents: "none",
            }}
          >
            <div style={{ position: "absolute", top: -2, left: -5, width: 12, height: 12, background: "var(--accent)", borderRadius: "2px", transform: "rotate(45deg)" }} />
          </div>
        </div>
      </div>
      <div style={{ padding: "8px 20px", fontSize: 10, color: "#999", display: "flex", gap: 20, borderTop: "1px solid #f0f0f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: "50%", background: "#7AE7C7" }} /> 和弦 (点)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 12, height: 4, background: "#4d90fe" }} /> 段落 (线)</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 2, height: 8, background: "#f59e0b" }} /> 调号</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 2, height: 8, background: "#ec4899" }} /> 拍号</div>
      </div>
    </div>
  );
};
