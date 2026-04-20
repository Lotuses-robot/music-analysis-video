import { useState, useCallback, useEffect } from "react";
import type { FC } from "react";
import type { MusicAnalysisVideoProject, SyncAnchor } from "../../../src/types/project";

interface TapperProps {
  project: MusicAnalysisVideoProject;
  currentTime: number;
  onUpdateSync: (anchors: SyncAnchor[]) => void;
}

/**
 * 打拍器组件（简易版）。
 * 允许用户通过点击按钮记录小节起始时间的锚点。
 * @param props 组件属性
 * @param props.project 当前项目数据
 * @param props.currentTime 当前播放时间（秒）
 * @param props.onUpdateSync 同步锚点更新回调
 */
export const Tapper: FC<TapperProps> = ({ project, currentTime, onUpdateSync }) => {
  const [sessionAnchors, setSessionAnchors] = useState<SyncAnchor[]>([]);
  const [isRecording, setIsSessionRecording] = useState(false);

  // Use the project's current measure structure to determine beat indices
  const getBeatOfMeasure = useCallback((measureIdx: number) => {
    let beat = 0;
    for (let i = 0; i < measureIdx; i++) {
      beat += project.measures[i].timeSignature.upper;
    }
    return beat;
  }, [project.measures]);

  const handleTap = useCallback(() => {
    if (!isRecording) return;

    const nextMeasureIdx = sessionAnchors.length;
    // If we've run out of measures in the project, we stop or just don't record
    if (nextMeasureIdx >= project.measures.length) return;

    const beat = getBeatOfMeasure(nextMeasureIdx);
    const newAnchor: SyncAnchor = {
      beat,
      timeSec: currentTime
    };

    setSessionAnchors(prev => [...prev, newAnchor]);
  }, [isRecording, sessionAnchors.length, project.measures.length, getBeatOfMeasure, currentTime]);

  // Handle keyboard (Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && isRecording) {
        e.preventDefault();
        handleTap();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTap, isRecording]);

  const startSession = () => {
    setSessionAnchors([]);
    setIsSessionRecording(true);
  };

  const applySync = () => {
    if (sessionAnchors.length === 0) return;
    
    // We want to keep existing anchors that are BEFORE our session start if needed,
    // but usually a tapper session is meant to define the "new" sync.
    // Here we'll merge or just replace. The user said "overwrite time mapping".
    onUpdateSync(sessionAnchors);
    setIsSessionRecording(false);
  };

  return (
    <div className="tapper-tool" style={{ width: 240 }}>
      <div style={{ marginBottom: 12, textAlign: "center" }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>小节对齐工具</div>
        <div style={{ fontSize: 10, color: "var(--muted)" }}>
          听音乐，在每个小节开始时打击空格
        </div>
      </div>

      {!isRecording ? (
        <button className="btn btn--primary btn--full" onClick={startSession}>
          开始打拍对齐
        </button>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button className="tap-button" onClick={handleTap}>
            TAP (第 {sessionAnchors.length + 1} 小节)
          </button>
          <div style={{ fontSize: 11, textAlign: "center" }}>
            已记录: {sessionAnchors.length} / {project.measures.length} 小节
          </div>
          <div style={{ display: "flex", gap: 4 }}>
            <button className="btn btn--full" onClick={() => setIsSessionRecording(false)}>
              取消
            </button>
            <button 
              className="btn btn--primary btn--full" 
              onClick={applySync}
              disabled={sessionAnchors.length === 0}
            >
              应用同步
            </button>
          </div>
        </div>
      )}

      {sessionAnchors.length > 0 && (
        <div style={{ marginTop: 12, maxHeight: 100, overflowY: "auto", fontSize: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          {sessionAnchors.map((a, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0" }}>
              <span>小节 {i + 1} (Beat {a.beat})</span>
              <span style={{ color: "var(--accent)" }}>{a.timeSec.toFixed(2)}s</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
