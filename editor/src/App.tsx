import type { FC } from "react";
import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import exampleJson from "../../examples/example.project.json" with { type: "json" };
import type { MusicAnalysisVideoProject, MeasureEvent } from "../../src/types/project";
import { PreviewPanel } from "./components/PreviewPanel";
import { ProjectForm } from "./components/ProjectForm";
import { Timeline } from "./components/Timeline";
import { AdvancedTapper } from "./components/AdvancedTapper";
import { ChordPicker } from "./components/ChordPicker";
import { toMonochromePreviewProject } from "./lib/previewProject";
import type { Aspect } from "./lib/playerConfig";
import { timeToBeat, beatToTime } from "../../src/sync/beatTime";
import { getContentEndSec } from "../../src/analysis/duration";
import { keyAtBeat } from "../../src/analysis/selectors";
import type { PlayerRef } from "@remotion/player";

const defaultProject = exampleJson as MusicAnalysisVideoProject;

/**
 * 音乐分析视频编辑器主应用组件。
 * 提供项目配置、时间轴编辑、实时打拍和预览功能。
 */
export const App: FC = () => {
  const [project, setProject] = useState<MusicAnalysisVideoProject>(() => structuredClone(defaultProject));
  const [history, setHistory] = useState<MusicAnalysisVideoProject[]>([]);
  const [historyPointer, setHistoryPointer] = useState(-1);

  /**
   * 推送项目历史 (pushHistory)
   * 
   * 逻辑：
   * 1. 清理当前指针之后的历史记录（分支覆盖）。
   * 2. 将当前状态推入历史。
   * 3. 限制历史记录上限为 50 条。
   * 4. 更新当前项目状态。
   * 
   * @param newState 新的项目状态
   */
  const pushHistory = useCallback((newState: MusicAnalysisVideoProject) => {
    setHistory(prev => {
      const next = prev.slice(0, historyPointer + 1);
      next.push(structuredClone(project));
      if (next.length > 50) next.shift();
      return next;
    });
    setHistoryPointer(prev => {
      const next = prev + 1;
      return next > 49 ? 49 : next;
    });
    setProject(newState);
  }, [project, historyPointer]);

  /**
   * 撤销操作 (Undo)
   */
  const undo = useCallback(() => {
    if (historyPointer >= 0) {
      const prevState = history[historyPointer];
      setHistory(prev => {
        const next = [...prev];
        next[historyPointer + 1] = structuredClone(project);
        return next;
      });
      setProject(structuredClone(prevState));
      setHistoryPointer(prev => prev - 1);
    }
  }, [history, historyPointer, project]);

  /**
   * 重做操作 (Redo)
   */
  const redo = useCallback(() => {
    if (historyPointer < history.length - 1) {
      const nextState = history[historyPointer + 1];
      setHistoryPointer(prev => prev + 1);
      setProject(structuredClone(nextState));
    }
  }, [history, historyPointer]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  const [aspect, setAspect] = useState<Aspect>("9:16");
  const [showRealColors, setShowRealColors] = useState(false);
  const [currentBeat, setCurrentBeat] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<"project" | "editor" | "file" | "event">("project");
  const [showTapper, setShowTapper] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<{ measureIndex: number, eventIndex: number } | null>(null);
  const [selectedTool, setSelectedTool] = useState<"select" | "add" | "delete">("select");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const playerRef = useRef<PlayerRef>(null);

  const durationSec = useMemo(() => getContentEndSec(project), [project]);

  const previewProject = useMemo(() => {
    return showRealColors ? project : toMonochromePreviewProject(project);
  }, [project, showRealColors]);

  /**
   * 帧变更处理 (onFrameChange)
   * 
   * @param frame 当前帧数
   */
  const onFrameChange = useCallback(
    (frame: number) => {
      const fps = project.export?.fps ?? 30;
      const time = frame / fps;
      const beat = timeToBeat(time, project.sync);
      setCurrentBeat(Number(beat.toFixed(2)));
      setCurrentTime(Number(time.toFixed(3)));
      
      if (playerRef.current) {
        setIsPlaying(playerRef.current.isPlaying());
      }
    },
    [project.export?.fps, project.sync],
  );

  /**
   * 播放/暂停切换
   */
  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    if (playerRef.current.isPlaying()) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
  }, []);

  /**
   * 跳转至指定秒数 (onSeekToTime)
   * @param time 物理秒数
   */
  const onSeekToTime = useCallback((time: number) => {
    if (!playerRef.current) return;
    const fps = project.export?.fps ?? 30;
    const frame = Math.round(time * fps);
    playerRef.current.seekTo(frame);
  }, [project.export?.fps]);

  /**
   * 跳转至指定拍数 (onSeekToBeat)
   * @param beat 音乐拍数
   */
  const onSeekToBeat = useCallback((beat: number) => {
    if (!playerRef.current) return;
    const time = beatToTime(beat, project.sync);
    onSeekToTime(time);
  }, [project.sync, onSeekToTime]);

  /**
   * 选择事件 (onSelectEvent)
   * @param mIndex 小节索引
   * @param eIndex 事件索引
   */
  const onSelectEvent = useCallback((mIndex: number, eIndex: number) => {
    setSelectedEvent({ measureIndex: mIndex, eventIndex: eIndex });
    setActiveTab("event");
  }, []);

  /**
   * 更新事件 (onUpdateEvent)
   * 
   * 核心逻辑：
   * 1. 克隆当前项目状态。
   * 2. 获取目标事件。
   * 3. 严格边界锁定：禁止事件被拖出当前小节。
   * 4. 应用补丁并推入历史记录。
   * 
   * @param mIndex 小节索引
   * @param eIndex 事件索引
   * @param patch 变更内容
   */
  const onUpdateEvent = useCallback((mIndex: number, eIndex: number, patch: Partial<MeasureEvent> & { newMeasureIndex?: number }) => {
    const next = structuredClone(project);
    const { newMeasureIndex, ...eventPatch } = patch;
    
    // 获取目标小节的拍号分子（边界）
    const targetMIdx = newMeasureIndex !== undefined ? newMeasureIndex : mIndex;
    const measure = next.measures[targetMIdx];
    if (!measure) return;
    const upper = measure.timeSignature.upper;

    // 内部工具：将偏移量限制在小节范围内 [0, upper)
    const clampOffset = (offset: number) => Math.max(0, Math.min(upper - 0.01, offset));

    if (eventPatch.beatOffset !== undefined) {
      eventPatch.beatOffset = clampOffset(eventPatch.beatOffset);
    }

    if (newMeasureIndex !== undefined && newMeasureIndex !== mIndex) {
      // 严格锁定：禁止跨小节移动
      const e = next.measures[mIndex].events[eIndex];
      const direction = newMeasureIndex > mIndex ? 1 : -1;
      const lockedOffset = direction === 1 ? (next.measures[mIndex].timeSignature.upper - 0.01) : 0;
      next.measures[mIndex].events[eIndex] = { ...e, ...eventPatch, beatOffset: lockedOffset };
    } else {
      // 同一小节内更新
      const e = next.measures[mIndex].events[eIndex];
      next.measures[mIndex].events[eIndex] = { ...e, ...eventPatch };
    }
    pushHistory(next);
  }, [project, pushHistory]);

  /**
   * 更新项目并保持当前播放位置 (onUpdateProjectWithBeatPreservation)
   * 
   * 核心逻辑：
   * 在拍号或 BPM 变更后，确保当前的“播放头”在时间轴上的物理秒数位置保持不变，
   * 自动重新计算其在新的拍子网格下的位置。
   * 
   * @param next 新的项目状态
   */
  const onUpdateProjectWithBeatPreservation = useCallback((next: MusicAnalysisVideoProject) => {
    const currentTime = beatToTime(currentBeat, project.sync);
    pushHistory(next);
    const nextBeat = timeToBeat(currentTime, next.sync);
    setCurrentBeat(nextBeat);
  }, [project, currentBeat, pushHistory]);

  /**
   * 添加新事件 (onAddEvent)
   * @param mIndex 小节索引
   * @param event 事件对象
   */
  const onAddEvent = useCallback((mIndex: number, event: MeasureEvent) => {
    const next = structuredClone(project);
    next.measures[mIndex].events.push(event);
    pushHistory(next);
    setSelectedEvent({ measureIndex: mIndex, eventIndex: next.measures[mIndex].events.length - 1 });
    setActiveTab("event");
  }, [project, pushHistory]);

  /**
   * 删除事件 (onDeleteEvent)
   * @param mIndex 小节索引
   * @param eIndex 事件索引
   */
  const onDeleteEvent = useCallback((mIndex: number, eIndex: number) => {
    const next = structuredClone(project);
    next.measures[mIndex].events.splice(eIndex, 1);
    pushHistory(next);
    setSelectedEvent(null);
  }, [project, pushHistory]);

  const key = keyAtBeat(project, currentBeat);

  // Status monitor info
  const currentMeasureIdx = useMemo(() => {
    let acc = 0;
    if (!project.measures) return 0;
    for (let i = 0; i < project.measures.length; i++) {
      const len = project.measures[i].timeSignature.upper;
      if (currentBeat >= acc && currentBeat < acc + len) return i;
      acc += len;
    }
    return project.measures.length - 1;
  }, [project.measures, currentBeat]);

  const currentTS = project.measures?.[currentMeasureIdx]?.timeSignature;
  
  // Calculate BPM: (60 / time-per-beat)
  // Find two closest sync anchors around currentBeat
  const currentBPM = useMemo(() => {
    const anchors = project.sync.anchors;
    if (anchors.length < 2) return 0;
    
    // Find segment
    let left = anchors[0];
    let right = anchors[anchors.length - 1];
    for (let i = 0; i < anchors.length - 1; i++) {
      if (currentBeat >= anchors[i].beat && currentBeat <= anchors[i+1].beat) {
        left = anchors[i];
        right = anchors[i+1];
        break;
      }
    }
    const beatDiff = right.beat - left.beat;
    const timeDiff = right.timeSec - left.timeSec;
    if (timeDiff <= 0 || beatDiff <= 0) return 0;
    return Math.round((beatDiff / timeDiff) * 60);
  }, [project.sync.anchors, currentBeat]);


  /**
   * 导出项目 JSON 文件
   */
  const downloadJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: "application/json;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "project.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [project]);

  /**
   * 加载本地项目文件 (onPickFile)
   * @param file JSON 文件
   */
  const onPickFile = useCallback((file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = reader.result as string;
        const data = JSON.parse(raw) as MusicAnalysisVideoProject;
        pushHistory(data);
      } catch {
        alert("无法解析 JSON，请检查文件格式。");
      }
    };
    reader.readAsText(file, "utf-8");
  }, [pushHistory]);

  // Keyboard shortcut for Tapper (Space)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyT" && e.altKey) {
        setShowTapper(v => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="app-shell">
      {/* Top Bar / Header */}
      <header className="editor-header">
        <div className="status-monitor" style={{ display: "flex", gap: 20, fontSize: 13, background: "#111", padding: "4px 16px", borderRadius: 20, border: "1px solid #333" }}>
          <div className="status-item">
            <span style={{ color: "#888" }}>当前小节:</span> <span style={{ color: "var(--accent)", fontWeight: "bold" }}>{currentMeasureIdx + 1}</span>
          </div>
          <div className="status-item">
            <span style={{ color: "#888" }}>拍号:</span> <span style={{ color: "#fff" }}>{currentTS?.upper}/{currentTS?.lower}</span>
          </div>
          <div className="status-item">
            <span style={{ color: "#888" }}>BPM:</span> <span style={{ color: "#fff" }}>{currentBPM}</span>
          </div>
          <div className="status-item">
            <span style={{ color: "#888" }}>调性:</span> <span style={{ color: "#fff" }}>{key}</span>
          </div>
        </div>

        <h1>Music Analysis Editor</h1>
        
        <div className="top-bar-tabs">
          <button 
            className={`tab-btn ${activeTab === "file" ? "active" : ""}`}
            onClick={() => setActiveTab("file")}
          >
            文件
          </button>
          <button 
            className={`tab-btn ${activeTab === "project" ? "active" : ""}`}
            onClick={() => setActiveTab("project")}
          >
            曲目设置
          </button>
          <button 
            className={`tab-btn ${activeTab === "editor" ? "active" : ""}`}
            onClick={() => setActiveTab("editor")}
          >
            预览设置
          </button>
          <button 
            className={`tab-btn ${activeTab === "event" ? "active" : ""}`}
            onClick={() => setActiveTab("event")}
            disabled={!selectedEvent}
          >
            事件编辑
          </button>
        </div>

        <div className="file-ops">
          <div className="undo-redo-group" style={{ display: "flex", gap: 4, marginRight: 12 }}>
            <button 
              className="btn btn--icon" 
              title="撤销 (Ctrl+Z)" 
              onClick={undo} 
              disabled={historyPointer < 0}
            >
              ↩️
            </button>
            <button 
              className="btn btn--icon" 
              title="重做 (Ctrl+Shift+Z / Ctrl+Y)" 
              onClick={redo} 
              disabled={historyPointer >= history.length - 1}
            >
              ↪️
            </button>
          </div>
          <button className="btn" onClick={() => setShowTapper(v => !v)}>
            {showTapper ? "关闭打拍器" : "打开打拍器"}
          </button>
          <button className="btn btn--primary" onClick={downloadJson}>
            导出 JSON
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        <div className="preview-pane">
          <div className="preview-container">
            <PreviewPanel 
              project={previewProject} 
              aspect={aspect} 
              onFrameChange={onFrameChange}
              playerRef={playerRef}
            />
            
            {/* Custom Transport Controls */}
            <div className="custom-controls">
              <button className="play-pause-btn" onClick={togglePlay}>
                {isPlaying ? "⏸" : "▶"}
              </button>
              
              <div className="time-display">
                {currentTime.toFixed(2)}s / {durationSec.toFixed(2)}s
              </div>
              
              <div 
                className="transport-slider"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const percent = Math.max(0, Math.min(1, x / rect.width));
                  onSeekToTime(percent * durationSec);
                }}
              >
                <div 
                  className="transport-progress" 
                  style={{ width: `${(currentTime / durationSec) * 100}%` }}
                />
              </div>
            </div>
          </div>
          {showTapper && (
            <AdvancedTapper 
              project={project}
              onUpdateProject={pushHistory}
              onClose={() => setShowTapper(false)}
            />
          )}
        </div>

        <div className="details-pane">
          {activeTab === "file" && (
            <div className="tab-content">
              <h3>文件操作</h3>
              <div className="field">
                <button className="btn btn--full" onClick={() => pushHistory(structuredClone(defaultProject))}>
                  重置为默认示例
                </button>
              </div>
              <div className="field">
                <button className="btn btn--full" onClick={() => fileInputRef.current?.click()}>
                  加载本地工程 (.json)
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
            </div>
          )}
          
          {activeTab === "project" && (
            <ProjectForm 
              project={project} 
              onChange={pushHistory} 
              currentBeat={currentBeat} 
              currentTime={currentTime}
            />
          )}

          {activeTab === "event" && selectedEvent && project.measures[selectedEvent.measureIndex]?.events[selectedEvent.eventIndex] && (
            <div className="tab-content">
              <h3>事件编辑</h3>
              <p style={{ fontSize: 11, color: "var(--muted)" }}>
                小节 {selectedEvent.measureIndex + 1}, 事件 {selectedEvent.eventIndex + 1}
              </p>
              
              {/* Removed Event Type Select as requested */}

              {project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].type === "chord" ? (
                <div className="field">
                  <label>和弦选择器</label>
                  <ChordPicker 
                    value={project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].value as string}
                    onChange={(val) => onUpdateEvent(selectedEvent.measureIndex, selectedEvent.eventIndex, { value: val })}
                    currentKey={keyAtBeat(project, currentBeat)}
                  />
                </div>
              ) : project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].type === "key_change" ? (
                <div className="field">
                  <label>调性设置</label>
                  <div style={{ display: "flex", gap: 10 }}>
                    <select 
                      value={(project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].value as string).replace(/m$/, "")}
                      onChange={(e) => {
                        const isMinor = (project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].value as string).endsWith("m");
                        onUpdateEvent(selectedEvent.measureIndex, selectedEvent.eventIndex, { value: e.target.value + (isMinor ? "m" : "") });
                      }}
                    >
                      {["C", "G", "D", "A", "E", "B", "F#", "C#", "G#", "D#", "A#", "F", "Gb", "Db", "Ab", "Eb", "Bb"].map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select 
                      value={(project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].value as string).endsWith("m") ? "m" : ""}
                      onChange={(e) => {
                        const root = (project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].value as string).replace(/m$/, "");
                        onUpdateEvent(selectedEvent.measureIndex, selectedEvent.eventIndex, { value: root + e.target.value });
                      }}
                    >
                      <option value="">Major (大调)</option>
                      <option value="m">Minor (小调)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="field">
                  <label>{project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].type === "comment" ? "备注内容" : "数值 / 内容"}</label>
                  {project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].type === "comment" ? (
                    <textarea 
                      value={project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].value}
                      style={{ height: 100, resize: "vertical" }}
                      onChange={(e) => onUpdateEvent(selectedEvent.measureIndex, selectedEvent.eventIndex, { value: e.target.value })}
                    />
                  ) : (
                    <input 
                      value={project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].value}
                      onChange={(e) => {
                        const type = project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].type;
                        const val = (type === "bpm_change" || type === "emotion") ? Number(e.target.value) : e.target.value;
                        onUpdateEvent(selectedEvent.measureIndex, selectedEvent.eventIndex, { value: val });
                      }}
                    />
                  )}
                </div>
              )}

              {project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].type === "comment" && (
                <div className="style-editor" style={{ background: "rgba(255,255,255,0.03)", padding: 12, borderRadius: 8, marginTop: 12 }}>
                  <label style={{ fontSize: 11, color: "var(--muted)", display: "block", marginBottom: 8 }}>文本样式</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div className="field" style={{ margin: 0 }}>
                      <label>字体大小 (px)</label>
                      <input 
                        type="number" 
                        value={project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].style?.fontSize || 32}
                        onChange={(e) => onUpdateEvent(selectedEvent.measureIndex, selectedEvent.eventIndex, { 
                          style: { ...project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].style, fontSize: Number(e.target.value) } 
                        })}
                      />
                    </div>
                    <div className="field" style={{ margin: 0 }}>
                      <label>字体族</label>
                      <select
                        value={project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].style?.fontFamily || "Inter"}
                        onChange={(e) => onUpdateEvent(selectedEvent.measureIndex, selectedEvent.eventIndex, { 
                          style: { ...project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].style, fontFamily: e.target.value } 
                        })}
                      >
                        <option value="Inter">Inter (默认)</option>
                        <option value="serif">宋体 / Serif</option>
                        <option value="sans-serif">黑体 / Sans</option>
                        <option value="monospace">等宽 / Mono</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="field" style={{ marginTop: 12 }}>
                <label>小节内偏移 (Beats)</label>
                <input 
                  type="number" 
                  step={0.1}
                  value={project.measures[selectedEvent.measureIndex].events[selectedEvent.eventIndex].beatOffset}
                  onChange={(e) => onUpdateEvent(selectedEvent.measureIndex, selectedEvent.eventIndex, { beatOffset: Number(e.target.value) })}
                />
              </div>

              <button 
                className="btn btn--danger" 
                style={{ marginTop: 20, width: "100%" }}
                onClick={() => onDeleteEvent(selectedEvent.measureIndex, selectedEvent.eventIndex)}
              >
                删除此事件
              </button>
            </div>
          )}

          {activeTab === "editor" && (
            <div className="tab-content">
              <h3>预览设置</h3>
              <div className="field">
                <label>预览比例 (Aspect Ratio)</label>
                <select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)}>
                  <option value="9:16">9:16 (竖屏)</option>
                  <option value="16:9">16:9 (横屏)</option>
                </select>
              </div>
              <div className="field">
                <label>预览颜色</label>
                <button className="btn btn--full" onClick={() => setShowRealColors(v => !v)}>
                  {showRealColors ? "切换到单色预览" : "显示成片颜色"}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Timeline Area */}
      <div className="timeline-area">
        <aside className="timeline-toolbar">
          <button 
            className={`btn btn--icon ${selectedTool === "select" ? "active" : ""}`} 
            title="选择工具"
            onClick={() => setSelectedTool("select")}
          >
            🖱️
          </button>
          <button 
            className={`btn btn--icon ${selectedTool === "add" ? "active" : ""}`} 
            title="添加工具"
            onClick={() => setSelectedTool("add")}
          >
            ➕
          </button>
          <button 
            className={`btn btn--icon ${selectedTool === "delete" ? "active" : ""}`} 
            title="删除工具"
            onClick={() => setSelectedTool("delete")}
          >
            🗑️
          </button>
        </aside>
        
        <div className="timeline-content">
          <Timeline 
            project={project} 
            currentBeat={currentBeat} 
            selectedTool={selectedTool}
            onSeek={onSeekToBeat}
            onSelectEvent={onSelectEvent}
            onUpdateEvent={onUpdateEvent}
            onAddEvent={onAddEvent}
            onDeleteEvent={onDeleteEvent}
            onUpdateProject={onUpdateProjectWithBeatPreservation}
          />
        </div>
      </div>
    </div>
  );
};
