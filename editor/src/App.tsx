import type { FC } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import exampleJson from "../../examples/example.project.json" with { type: "json" };
import type { MusicAnalysisVideoProject } from "../../src/types/project";
import { PreviewPanel } from "./components/PreviewPanel";
import { ProjectForm } from "./components/ProjectForm";
import { toMonochromePreviewProject } from "./lib/previewProject";
import type { Aspect } from "./lib/playerConfig";

const defaultProject = exampleJson as MusicAnalysisVideoProject;

export const App: FC = () => {
  const [project, setProject] = useState<MusicAnalysisVideoProject>(() => structuredClone(defaultProject));
  const [aspect, setAspect] = useState<Aspect>("9:16");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewProject = useMemo(() => toMonochromePreviewProject(project), [project]);

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
      <div className="panel">
        <h1>工程编辑</h1>
        <div className="toolbar">
          <button type="button" className="btn btn--primary" onClick={() => setProject(structuredClone(defaultProject))}>
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
        <p className="hint">界面仅黑白灰；右侧预览成片会压成单色以便专注结构。</p>
        <ProjectForm project={project} onChange={setProject} />
      </div>

      <aside className="panel panel--preview">
        <h1>预览</h1>
        <div className="toolbar" style={{ borderBottom: "none", paddingBottom: 0, marginBottom: "0.5rem" }}>
          <span style={{ fontSize: "0.75rem", color: "var(--muted)", marginRight: 8 }}>比例</span>
          <button type="button" className={`btn ${aspect === "9:16" ? "btn--primary" : ""}`} onClick={() => setAspect("9:16")}>
            9:16
          </button>
          <button type="button" className={`btn ${aspect === "16:9" ? "btn--primary" : ""}`} onClick={() => setAspect("16:9")}>
            16:9
          </button>
        </div>
        <PreviewPanel key={aspect} project={previewProject} aspect={aspect} />
      </aside>
    </div>
  );
};
