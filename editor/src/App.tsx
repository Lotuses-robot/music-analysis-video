import type { FC } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import exampleJson from "../../examples/example.project.json" with { type: "json" };
import type { MusicAnalysisVideoProject } from "../../src/types/project";
import { PreviewPanel } from "./components/PreviewPanel";
import { ProjectForm } from "./components/ProjectForm";
import { Timeline } from "./components/Timeline";
import { toMonochromePreviewProject } from "./lib/previewProject";
import type { Aspect } from "./lib/playerConfig";
import { timeToBeat, beatToTime } from "../../src/sync/beatTime";
import type { PlayerRef } from "@remotion/player";

const defaultProject = exampleJson as MusicAnalysisVideoProject;

export const App: FC = () => {
  const [project, setProject] = useState<MusicAnalysisVideoProject>(() => structuredClone(defaultProject));
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [showRealColors, setShowRealColors] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<PlayerRef>(null);

  const previewProject = useMemo(() => {
    return showRealColors ? project : toMonochromePreviewProject(project);
  }, [project, showRealColors]);

  const onFrameChange = useCallback(
    (frame: number) => {
      const time = frame / (project.export?.fps ?? 30);
      const beat = timeToBeat(time, project.sync);
      setCurrentBeat(Number(beat.toFixed(2)));
      setCurrentTime(Number(time.toFixed(3)));
    },
    [project.export?.fps, project.sync],
  );

  const onSeekToBeat = useCallback((beat: number) => {
    if (!playerRef.current) return;
    const time = beatToTime(beat, project.sync);
    const frame = Math.round(time * (project.export?.fps ?? 30));
    playerRef.current.seekTo(frame);
  }, [project.export?.fps, project.sync]);

  const downloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "project.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [project]);

  const onPickFile = useCallback((file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const data = JSON.parse(raw) as MusicAnalysisVideoProject;
        setProject(data);
      } catch {
        alert("无法解析 JSON，请检查文件格式。");
      }
    };
    reader.readAsText(file, "utf-8");
  }, []);

  return (
    <div className="app-shell">
      <div className="sidebar">
        <h1>工程编辑</h1>
        <div className="toolbar">
          <button type="button" className="btn" onClick={() => setProject(structuredClone(defaultProject))}>
            恢复示例
          </button>
          <button type="button" className="btn" onClick={downloadJson}>
            下载 JSON
          </button>
          <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
            打开 JSON…
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              onPickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>

        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "white",
            padding: "10px 0",
            borderBottom: "1px solid var(--border)",
            marginBottom: 16,
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "1rem", fontWeight: "bold", color: "var(--accent)" }}>Beat: {currentBeat}</span>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>{currentTime}s</span>
          </div>
        </div>

        <ProjectForm project={project} onChange={setProject} currentBeat={currentBeat} currentTime={currentTime} />
      </div>

      <div className="main-view">
        <div className="panel--preview">
          <div className="toolbar" style={{ borderBottom: "none", width: "100%", justifyContent: "center" }}>
            <button type="button" className={`btn ${aspect === "9:16" ? "btn--primary" : ""}`} onClick={() => setAspect("9:16")}>
              9:16
            </button>
            <button type="button" className={`btn ${aspect === "16:9" ? "btn--primary" : ""}`} onClick={() => setAspect("16:9")}>
              16:9
            </button>
            <div style={{ width: 20 }} />
            <button type="button" className={`btn ${showRealColors ? "btn--primary" : ""}`} onClick={() => setShowRealColors(!showRealColors)}>
              {showRealColors ? "✨ 主题配色" : "🌑 结构预览"}
            </button>
          </div>
          <PreviewPanel 
            key={aspect} 
            project={previewProject} 
            aspect={aspect} 
            onFrameChange={onFrameChange} 
            playerRef={playerRef}
          />
        </div>
      </div>

      <div className="timeline-area">
        <Timeline project={project} currentBeat={currentBeat} onSeek={onSeekToBeat} />
      </div>
    </div>
  );
};
