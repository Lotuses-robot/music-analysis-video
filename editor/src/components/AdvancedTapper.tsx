import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { FC } from "react";
import type { MusicAnalysisVideoProject, SyncAnchor, ProjectMeasure } from "../../../src/types/project";
import { beatToTime, remapSyncAfterTimeSignatureChange } from "../../../src/sync/beatTime";
import { useAudioBuffer } from "../hooks/useAudioBuffer";

interface AdvancedTapperProps {
  project: MusicAnalysisVideoProject;
  onUpdateProject: (project: MusicAnalysisVideoProject) => void;
  onClose: () => void;
}

/**
 * 高级打拍器组件：提供波形实时可视化、多段 BPM 打拍标记以及拍号区间管理功能。
 * @param props 组件属性
 * @param props.project 当前项目数据
 * @param props.onUpdateProject 更新项目回调
 * @param props.onClose 关闭打拍器回调
 */
export const AdvancedTapper: FC<AdvancedTapperProps> = ({ project, onUpdateProject, onClose }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [sessionAnchors, setSessionAnchors] = useState<SyncAnchor[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [zoom, setZoom] = useState(50); // 像素/秒 (Pixels per Second)
  const [baseTargetIdx, setBaseTargetIdx] = useState(0);
  const [localMeasures, setLocalMeasures] = useState<ProjectMeasure[]>(() => [...(project.measures || [])]);
  const [localSync, setLocalSync] = useState(() => {
    const sync = { ...project.sync };
    if (!sync.anchors || sync.anchors.length === 0) {
      sync.anchors = [{ beat: 0, timeSec: 0 }];
    }
    return sync;
  });
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const { audioBuffer } = useAudioBuffer(project.meta.audioPath);
  const audioUrl = project.meta.audioPath.startsWith("blob:") || project.meta.audioPath.startsWith("http")
    ? project.meta.audioPath 
    : `/${project.meta.audioPath}`;
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const loudnessHistoryRef = useRef<number[]>([]);
  const sourceConnectedRef = useRef(false);

  // --- 1. 基础工具数据 ---

  /**
   * 预计算所有小节的起始绝对拍数，避免在渲染循环中重复累加。
   */
  const measureStartBeats = useMemo(() => {
    const starts = [0];
    for (let i = 0; i < localMeasures.length; i++) {
      starts.push(starts[i] + localMeasures[i].timeSignature.upper);
    }
    return starts;
  }, [localMeasures]);

  /**
   * 获取指定小节的起始绝对拍数。
   */
  const getBeatOfMeasure = useCallback((measureIdx: number) => {
    if (measureIdx < measureStartBeats.length) return measureStartBeats[measureIdx];
    // 如果超出范围（比如正在插入小节），则通过累加计算
    let beat = measureStartBeats[measureStartBeats.length - 1];
    for (let i = measureStartBeats.length - 1; i < measureIdx; i++) {
      beat += (i < localMeasures.length) ? localMeasures[i].timeSignature.upper : 4;
    }
    return beat;
  }, [measureStartBeats, localMeasures]);

  // --- 2. 核心交互函数 ---

  /**
   * 播放/暂停切换
   */
  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(console.error);
      setIsPlaying(true);
    }
  }, []);

  /**
   * 删除指定索引的小节
   */
  const handleDeleteMeasure = useCallback((idx: number) => {
    const deletedBeat = getBeatOfMeasure(idx);
    const deletedBeats = localMeasures[idx].timeSignature.upper;

    setLocalMeasures(prev => {
      const next = prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, index: i + 1 }));
      return next;
    });
    
    setSessionAnchors(prev => {
      const filtered = prev.filter(a => a.beat !== deletedBeat);
      return filtered.map(a => a.beat > deletedBeat ? { ...a, beat: a.beat - deletedBeats } : a);
    });
  }, [getBeatOfMeasure, localMeasures]);

  /**
   * 在指定索引处插入一个小节
   */
  const handleInsertMeasure = useCallback((idx: number) => {
    const prevTS = idx > 0 ? localMeasures[idx - 1].timeSignature : { upper: 4, lower: 4 };
    const addedBeats = prevTS.upper;
    const insertBeat = getBeatOfMeasure(idx);

    setLocalMeasures(prev => {
      const next = [...prev];
      next.splice(idx, 0, {
        index: 0,
        timeSignature: { ...prevTS },
        events: []
      });
      return next.map((m, i) => ({ ...m, index: i + 1 }));
    });
    
    setSessionAnchors(prev => prev.map(a => a.beat >= insertBeat ? { ...a, beat: a.beat + addedBeats } : a));
  }, [getBeatOfMeasure, localMeasures]);

  /**
   * 处理打拍动作
   */
  const handleTap = useCallback(() => {
    if (!isRecording) return;
    setSessionAnchors(prev => {
      const beat = getBeatOfMeasure(baseTargetIdx + prev.length);
      const time = audioRef.current?.currentTime ?? 0;
      const filtered = prev.filter(a => a.beat !== beat);
      return [...filtered, { beat, timeSec: time }].sort((a, b) => a.beat - b.beat);
    });
  }, [isRecording, baseTargetIdx, getBeatOfMeasure]);

  /**
   * 在当前播放位置添加一个新的小节起始点
   */
  const handleAddMeasureAtCursor = useCallback(() => {
    let insertIdx = 0;
    for (let i = 0; i < localMeasures.length; i++) {
      const beat = getBeatOfMeasure(i);
      const time = beatToTime(beat, localSync);
      if (time > currentTime) {
        insertIdx = i;
        break;
      }
      insertIdx = i + 1;
    }

    handleInsertMeasure(insertIdx);
    
    const newBeat = getBeatOfMeasure(insertIdx);
    setSessionAnchors(prev => {
      const filtered = prev.filter(a => a.beat !== newBeat);
      return [...filtered, { beat: newBeat, timeSec: currentTime }].sort((a, b) => a.beat - b.beat);
    });
  }, [currentTime, localMeasures, getBeatOfMeasure, localSync, handleInsertMeasure]);

  /**
   * 删除当前播放位置所在的小节
   */
  const handleDeleteMeasureAtCursor = useCallback(() => {
    let targetIdx = -1;
    for (let i = 0; i < localMeasures.length; i++) {
      const startBeat = getBeatOfMeasure(i);
      const startTime = beatToTime(startBeat, localSync);
      const endBeat = getBeatOfMeasure(i + 1);
      const endTime = beatToTime(endBeat, localSync);
      
      if (currentTime >= startTime && currentTime <= endTime) {
        targetIdx = i;
        break;
      }
    }
    if (targetIdx !== -1) handleDeleteMeasure(targetIdx);
  }, [currentTime, localMeasures, getBeatOfMeasure, localSync, handleDeleteMeasure]);

  /**
   * 修改拍号并执行时间锁定重映射 (updateTimeSignature)
   */
  const updateTimeSignature = useCallback((idx: number, patch: Partial<{ upper: number; lower: number }>) => {
    // 1. 准备数据
    const prevMeasures = localMeasures;
    const oldMeasure = prevMeasures[idx];
    const nextTS = { ...oldMeasure.timeSignature, ...patch };
    const nextMeasures = [...prevMeasures];
    nextMeasures[idx] = { ...oldMeasure, timeSignature: nextTS };

    // 2. 物理边界时间锁定：在修改点前后插入锚点，确保修改区域之外的时间线不动
    let oldStartBeatOfTarget = 0;
    for (let i = 0; i < idx; i++) oldStartBeatOfTarget += prevMeasures[i].timeSignature.upper;
    const oldEndBeatOfTarget = oldStartBeatOfTarget + oldMeasure.timeSignature.upper;
    
    const startTimeSec = beatToTime(oldStartBeatOfTarget, localSync);
    const endTimeSec = beatToTime(oldEndBeatOfTarget, localSync);

    const tempSync = { ...localSync, anchors: [...localSync.anchors] };
    const lockAnchor = (sync: { anchors: SyncAnchor[] }, beat: number, time: number) => {
      const existing = sync.anchors.find((a: SyncAnchor) => Math.abs(a.beat - beat) < 0.001);
      if (existing) existing.timeSec = time;
      else sync.anchors.push({ beat, timeSec: time });
      sync.anchors.sort((a: SyncAnchor, b: SyncAnchor) => a.beat - b.beat);
    };
    lockAnchor(tempSync, oldStartBeatOfTarget, startTimeSec);
    lockAnchor(tempSync, oldEndBeatOfTarget, endTimeSec);

    // 3. 处理事件缩放
    const oldUpper = oldMeasure.timeSignature.upper;
    const newUpper = nextTS.upper;
    if (oldUpper !== newUpper) {
      for (let i = idx; i < nextMeasures.length; i++) {
        const curM = nextMeasures[i];
        const mOldUpper = curM.timeSignature.upper;
        const curNewUpper = (i === idx) ? newUpper : mOldUpper;
        nextMeasures[i] = {
          ...curM,
          events: curM.events.map(e => ({
            ...e,
            beatOffset: Number((e.beatOffset * (curNewUpper / mOldUpper)).toFixed(4))
          }))
        };
      }
    }

    // 4. 执行重映射
    const remappedAnchors = remapSyncAfterTimeSignatureChange(tempSync.anchors, prevMeasures, nextMeasures, idx);
    const remappedSession = remapSyncAfterTimeSignatureChange(sessionAnchors, prevMeasures, nextMeasures, idx);

    // 5. 更新状态
    setLocalMeasures(nextMeasures);
    setLocalSync(s => ({ ...s, anchors: remappedAnchors }));
    setSessionAnchors(remappedSession);
  }, [localMeasures, localSync, sessionAnchors]);

  // --- 3. 其他辅助函数 ---

  const handleAddMeasure = useCallback(() => {
    const lastTS = localMeasures.length > 0 ? localMeasures[localMeasures.length - 1].timeSignature : { upper: 4, lower: 4 };
    setLocalMeasures(prev => [...prev, {
      index: prev.length + 1,
      timeSignature: { ...lastTS },
      events: []
    }]);
  }, [localMeasures]);

  // 移除 handleDeleteLastMeasure，因为它被标记为未使用，且功能可由 handleDeleteMeasureAtCursor 覆盖

  const applySync = useCallback(() => {
    const existingAnchors = project.sync.anchors;
    const newAnchors = [...sessionAnchors];
    const merged = [...existingAnchors];
    newAnchors.forEach(na => {
      const idx = merged.findIndex(ma => ma.beat === na.beat);
      if (idx >= 0) merged[idx] = na;
      else merged.push(na);
    });
    merged.sort((a, b) => a.beat - b.beat);

    onUpdateProject({
      ...project,
      measures: localMeasures,
      sync: { ...project.sync, anchors: merged }
    });
    onClose();
  }, [project, sessionAnchors, localMeasures, onUpdateProject, onClose]);

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    const time = Math.max(0, Math.min(duration, x / zoom));
    audioRef.current.currentTime = time;
    if (isRecording) setSessionAnchors([]);
  };

  const handleMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setDraggingIdx(idx);
  };

  // --- 4. 副作用 Hooks ---

  /**
   * 自动根据当前播放时间定位初始打拍目标小节。
   */
  useEffect(() => {
    if (isPlaying) return; // 播放时不自动调整目标，避免干扰录制
    if (sessionAnchors.length > 0) return;
    
    let bestIdx = 0;
    let found = false;
    for (let i = 0; i < localMeasures.length; i++) {
      const beat = getBeatOfMeasure(i);
      const time = beatToTime(beat, localSync);
      if (time > currentTime) {
        bestIdx = i;
        found = true;
        break;
      }
    }
    requestAnimationFrame(() => {
      setBaseTargetIdx(found ? bestIdx : localMeasures.length);
    });
  }, [currentTime, localMeasures, localSync, sessionAnchors.length, isPlaying, getBeatOfMeasure]);

  /**
   * 处理键盘交互（空格键）。
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (isRecording) handleTap();
        else togglePlay();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleTap, isRecording, togglePlay]);

  /**
   * 处理鼠标滚轮缩放逻辑 (Ctrl + Wheel)。
   */
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(z * delta, 10), 500));
      }
    };
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => el.removeEventListener("wheel", handleWheel);
    }
  }, []);

  /**
   * 当音频数据加载完成后，同步时长。
   */
  useEffect(() => {
    if (audioBuffer) {
      setDuration(audioBuffer.duration);
    }
  }, [audioBuffer]);

  /**
   * 实时更新播放进度及采集响度数据 (updateProgress)
   */
  const updateProgress = useCallback(function step() {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      if (!audioBuffer) setDuration(audioRef.current.duration || 0);

      if (analyserRef.current && dataArrayRef.current && !audioRef.current.paused) {
        const data = dataArrayRef.current;
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const idx = Math.floor(time * 60);
        if (!loudnessHistoryRef.current[idx]) loudnessHistoryRef.current[idx] = avg;
      }
    }
    requestRef.current = requestAnimationFrame(step);
  }, [audioBuffer]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateProgress);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [updateProgress]);

  /**
   * 初始化音频分析环境（AudioContext & Analyser）。
   */
  useEffect(() => {
    if (!audioRef.current || sourceConnectedRef.current) return;
    try {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      const source = audioCtx.createMediaElementSource(audioRef.current);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      sourceConnectedRef.current = true;
    } catch (e) {
      console.error("AudioContext setup failed:", e);
    }
  }, [audioUrl]);

  /**
   * 在 Canvas 上绘制音频波形图。
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const audioWidth = Math.floor(audioBuffer.duration * zoom);
    const h = canvas.height;
    if (canvas.width !== audioWidth) {
      canvas.width = audioWidth;
      canvas.style.width = `${audioWidth}px`;
    }
    ctx.clearRect(0, 0, audioWidth, h);
    const data = audioBuffer.getChannelData(0);
    const samplesPerPixel = data.length / audioWidth;
    const amp = h / 2;
    ctx.fillStyle = "rgba(77, 144, 254, 0.4)";
    for (let i = 0; i < audioWidth; i++) {
      let min = 1.0;
      let max = -1.0;
      const start = Math.floor(i * samplesPerPixel);
      const end = Math.floor((i + 1) * samplesPerPixel);
      for (let j = start; j < end; j++) {
        const datum = data[j]; 
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, amp * (1 + min), 1, Math.max(1, amp * (max - min)));
    }
    const history = loudnessHistoryRef.current;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < history.length; i++) {
      if (history[i]) {
        const x = (i / 60) * zoom;
        const barH = (history[i] / 255) * h;
        ctx.fillRect(x, h - barH, 2, barH);
      }
    }
  }, [audioBuffer, zoom]);

  /**
   * 播放时自动滚动时间轴，保持播放头在可视范围内。
   */
  useEffect(() => {
    if (scrollRef.current && isPlaying) {
      const playheadX = currentTime * zoom;
      const { scrollLeft, clientWidth } = scrollRef.current;
      if (playheadX > scrollLeft + clientWidth * 0.8) {
        scrollRef.current.scrollLeft = playheadX - clientWidth * 0.2;
      }
    }
  }, [currentTime, zoom, isPlaying]);

  /**
   * 处理拖拽小节线
   */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIdx === null || !scrollRef.current) return;
      const rect = scrollRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
      const time = Math.max(0, Math.min(duration, x / zoom));
      const beat = getBeatOfMeasure(draggingIdx);
      setSessionAnchors(prev => {
        const existing = prev.find(a => a.beat === beat);
        if (existing) return prev.map(a => a.beat === beat ? { ...a, timeSec: time } : a);
        else return [...prev, { beat, timeSec: time }];
      });
    };
    const handleMouseUp = () => setDraggingIdx(null);
    if (draggingIdx !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingIdx, duration, zoom, getBeatOfMeasure]);

  const currentTargetIdx = baseTargetIdx + sessionAnchors.length;

  return (
    <div className="advanced-tapper-overlay">
      <div className="advanced-tapper-window" style={{ width: 1000 }}>
        <header className="tapper-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h2 style={{ margin: 0 }}>打拍对齐窗口 (时间轴单位: 秒)</h2>
            <div style={{ fontSize: 11, background: "#333", padding: "2px 8px", borderRadius: 4, color: "#888" }}>
              Space: {isRecording ? "TAP" : "播放/暂停"}
            </div>
          </div>
          <button className="btn" onClick={onClose}>×</button>
        </header>

        <div className="tapper-body">
          <div className="tapper-controls" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 15, background: "rgba(255,255,255,0.05)", padding: 10, borderRadius: 8 }}>
            <button className="btn" onClick={togglePlay}>
              {isPlaying ? "暂停 (Space)" : "播放 (Space)"}
            </button>
            <button className="btn" onClick={() => { if (audioRef.current) audioRef.current.currentTime = 0; }}>
              重置播放
            </button>
            <div style={{ width: 1, height: 20, background: "#444", margin: "0 5px" }} />
            <button 
              className={`btn ${isRecording ? "active" : ""}`} 
              onClick={() => setIsRecording(!isRecording)}
              style={{ background: isRecording ? "var(--accent)" : undefined }}
            >
              {isRecording ? "停止录制" : "开始录制 (空格打拍)"}
            </button>
            
            <div style={{ width: 1, height: 20, background: "#444", margin: "0 5px" }} />
            
            <button 
              className="btn btn--primary" 
              onClick={handleAddMeasureAtCursor}
              title="在当前播放光标处添加一个新的小节"
            >
              ➕ 在光标处添加小节
            </button>
            
            <button 
              className="btn" 
              onClick={handleAddMeasure}
              title="在项目末尾添加一个新小节"
            >
              ➕ 末尾添加小节
            </button>
            
            <button 
              className="btn" 
              onClick={handleDeleteMeasureAtCursor}
              style={{ color: "#ff4d4f" }}
              title="删除当前光标所在的小节"
              disabled={localMeasures.length === 0}
            >
              🗑️ 删除当前小节
            </button>

            <div style={{ flex: 1 }} />
            
            <div className="zoom-controls" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 12, opacity: 0.6 }}>缩放:</span>
              <input 
                type="range" 
                min="10" 
                max="500" 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))} 
                style={{ width: 120 }}
              />
            </div>
            <button className="btn" onClick={onClose} style={{ marginLeft: 10 }}>关闭</button>
          </div>

          <div 
            className="tapper-visualizer" 
            ref={scrollRef} 
            style={{ height: 100, overflowX: "auto", overflowY: "hidden", cursor: "pointer" }}
            onClick={handleTimelineClick}
          >
            <div style={{ width: duration * zoom, position: "relative", height: "100%" }}>
              <div className="time-ruler" style={{ height: 18 }}>
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                  <div key={i} className="time-tick" style={{ left: i * zoom, width: zoom, borderLeft: "1px solid #222", fontSize: 10 }}>
                    {i}s
                  </div>
                ))}
              </div>
              
              <div className="waveform-container" style={{ height: 82, position: "relative" }}>
                <canvas ref={canvasRef} width={duration * zoom} height={82} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
                
                {localMeasures.map((m, i) => {
                  const beat = getBeatOfMeasure(i);
                  const time = beatToTime(beat, localSync);
                  const sessionAnchor = sessionAnchors.find(sa => sa.beat === beat);
                  const displayTime = sessionAnchor ? sessionAnchor.timeSec : time;

                  return (
                    <div 
                      key={`measure-${i}`} 
                      className={`anchor-line ${sessionAnchor ? "new" : "old"}`} 
                      style={{ 
                        left: displayTime * zoom, 
                        background: sessionAnchor ? undefined : "rgba(255, 255, 255, 0.5)", 
                        borderLeft: sessionAnchor ? "2px solid var(--accent)" : "1px solid rgba(255, 255, 255, 0.2)",
                        cursor: "col-resize",
                        width: 4,
                        marginLeft: -2,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, i)}
                    >
                      <div className="measure-info-box" style={{ width: 80 }} onMouseDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                          <span className="m-idx" style={{ fontWeight: 700 }}>第 {m.index} 小节</span>
                          <select 
                            value={m.timeSignature.upper} 
                            onChange={(e) => updateTimeSignature(i, { upper: Number(e.target.value) })}
                            style={{ background: "#333", border: "none", color: "white", fontSize: 10, borderRadius: 2 }}
                          >
                            {[2,3,4,5,6,7,8,9,12].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <span style={{ fontSize: 10 }}>/</span>
                          <select 
                            value={m.timeSignature.lower} 
                            onChange={(e) => updateTimeSignature(i, { lower: Number(e.target.value) })}
                            style={{ background: "#333", border: "none", color: "white", fontSize: 10, borderRadius: 2 }}
                          >
                            {[2,4,8,16].map(n => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {isRecording && (
                  <div className="anchor-line target" style={{ left: beatToTime(getBeatOfMeasure(currentTargetIdx), localSync) * zoom, borderLeft: "2px dashed #ff4444", opacity: 0.5, pointerEvents: "none" }}>
                    <span style={{ position: "absolute", top: 10, left: 4, fontSize: 9, color: "#ff4444" }}>即将打拍: 第 {localMeasures[currentTargetIdx]?.index ?? (localMeasures.length + 1)} 小节</span>
                  </div>
                )}
                <div className="tapper-playhead" style={{ left: currentTime * zoom }} />
              </div>
            </div>
          </div>

          <div className="tapper-status" style={{ background: "#111", padding: "8px 16px", borderRadius: 8 }}>
            <span>时间: {currentTime.toFixed(2)}s / {duration.toFixed(2)}s</span>
            <span>当前打拍目标: 第 {localMeasures[currentTargetIdx]?.index ?? (localMeasures.length + 1)} 小节</span>
            <span>本次已修正/新增: {sessionAnchors.length} 个小节</span>
          </div>
        </div>

        <footer className="tapper-footer">
          <button className="btn" onClick={onClose}>取消</button>
          <button className="btn btn--primary" onClick={applySync} disabled={sessionAnchors.length === 0} style={{ minWidth: 150 }}>应用修正</button>
        </footer>
        <audio ref={audioRef} src={audioUrl} crossOrigin="anonymous" />
      </div>
    </div>
  );
};

