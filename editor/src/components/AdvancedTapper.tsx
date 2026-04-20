import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import type { FC } from "react";
import type { MusicAnalysisVideoProject, SyncAnchor, ProjectMeasure } from "../../../src/types/project";
import { beatToTime } from "../../../src/sync/beatTime";

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
  const [localSync, setLocalSync] = useState(project.sync);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const loudnessHistoryRef = useRef<number[]>([]);
  const sourceConnectedRef = useRef(false);

  /**
   * 获取指定小节的起始绝对拍数。
   * @param measureIdx 小节索引 (0-based)
   * @returns 该小节开始时的累计拍数
   */
  const getBeatOfMeasure = useCallback((measureIdx: number) => {
    let beat = 0;
    for (let i = 0; i < measureIdx; i++) {
      beat += (i < localMeasures.length) ? localMeasures[i].timeSignature.upper : 4;
    }
    return beat;
  }, [localMeasures]);

  /**
   * 自动根据当前播放时间定位初始打拍目标小节。
   */
  useEffect(() => {
    if (isPlaying && sessionAnchors.length > 0) return;
    
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
    // 使用 requestAnimationFrame 或 setTimeout 来避免在 Effect 中直接同步 setState 触发渲染告警
    requestAnimationFrame(() => {
      setBaseTargetIdx(found ? bestIdx : localMeasures.length);
    });
  }, [currentTime, localMeasures, localSync, sessionAnchors.length, isPlaying, getBeatOfMeasure]);

  const currentTargetIdx = baseTargetIdx + sessionAnchors.length;

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

  const audioUrl = useMemo(() => project.meta.audioPath ? `/${project.meta.audioPath}` : "", [project.meta.audioPath]);
  const timelineWidth = useMemo(() => duration * zoom, [duration, zoom]);

  /**
   * 实时更新播放进度及采集响度数据 (updateProgress)
   */
  const updateProgress = useCallback(function step() {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      setDuration(audioRef.current.duration || 0);

      if (analyserRef.current && dataArrayRef.current && !audioRef.current.paused) {
        const data = dataArrayRef.current;
        analyserRef.current.getByteFrequencyData(data as any);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const idx = Math.floor(time * 60);
        if (!loudnessHistoryRef.current[idx]) loudnessHistoryRef.current[idx] = avg;
      }
    }
    requestRef.current = requestAnimationFrame(step);
  }, []);

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
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaElementSource(audioRef.current);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyser.connect(audioCtx.destination);
      
      analyserRef.current = analyser;
      dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
      sourceConnectedRef.current = true;
      console.log("Audio analysis environment initialized");
    } catch (e) {
      console.error("AudioContext setup failed:", e);
    }
  }, [audioUrl]);

  /**
   * 在 Canvas 上绘制采集到的响度波形图。
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const history = loudnessHistoryRef.current;
      ctx.fillStyle = "rgba(77, 144, 254, 0.5)";
      for (let i = 0; i < history.length; i++) {
        if (history[i]) {
          const x = (i / 60) * zoom;
          const h = (history[i] / 255) * canvas.height;
          ctx.fillRect(x, canvas.height - h, 2, h);
        }
      }
      requestAnimationFrame(draw);
    };
    const animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, [zoom]);

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
   * 切换播放/暂停状态 (togglePlay)
   */
  const togglePlay = async () => {
    if (audioRef.current) {
      if (analyserRef.current?.context.state === "suspended") {
        await (analyserRef.current.context as AudioContext).resume();
      }
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(console.error);
      setIsPlaying(!isPlaying);
    }
  };

  /**
   * 处理实时打拍动作 (handleTap)
   * 
   * 核心逻辑：
   * 1. 记录当前时间作为指定小节的锚点。
   * 2. 如果当前打拍超过了现有小节，自动生成新小节。
   */
  const handleTap = useCallback(() => {
    if (!isRecording) return;
    if (currentTime >= duration && duration > 0) {
      setIsRecording(false);
      return;
    }

    const beat = getBeatOfMeasure(currentTargetIdx);
    setSessionAnchors(prev => [...prev, { beat, timeSec: currentTime }]);

    // 自动补全小节：如果打拍到了最后，自动新增小节
    if (currentTargetIdx >= localMeasures.length) {
      const lastTS = localMeasures.length > 0 ? localMeasures[localMeasures.length - 1].timeSignature : { upper: 4, lower: 4 };
      setLocalMeasures(prev => [...prev, {
        index: prev.length + 1,
        timeSignature: { ...lastTS },
        events: []
      }]);
    }
  }, [isRecording, currentTargetIdx, localMeasures, getBeatOfMeasure, currentTime, duration]);

  /**
   * 修改拍号并执行时间锁定重映射 (updateTimeSignature)
   * 
   * 逻辑与 Timeline.tsx 保持一致，确保在打拍器中修改拍号也不会导致小节线漂移。
   * 
   * @param idx 小节索引
   * @param upper 拍号分子
   */
  const updateTimeSignature = useCallback((idx: number, upper: number) => {
    setLocalMeasures(prevMeasures => {
      const nextMeasures = [...prevMeasures];
      
      // 1. 物理边界时间锁定
      let oldStartBeatOfTarget = 0;
      for (let i = 0; i < idx; i++) oldStartBeatOfTarget += prevMeasures[i].timeSignature.upper;
      const oldEndBeatOfTarget = oldStartBeatOfTarget + prevMeasures[idx].timeSignature.upper;
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

      // 2. 更新拍号及事件比例缩放
      const oldMeasureStartBeats = [0];
      for (let i = 0; i < prevMeasures.length; i++) oldMeasureStartBeats.push(oldMeasureStartBeats[i] + prevMeasures[i].timeSignature.upper);

      for (let i = idx; i < nextMeasures.length; i++) {
        const m = nextMeasures[i];
        const mOldUpper = m.timeSignature.upper;
        nextMeasures[i] = {
          ...m,
          timeSignature: { ...m.timeSignature, upper },
          events: m.events.map(e => ({
            ...e,
            beatOffset: Number((e.beatOffset * (upper / mOldUpper)).toFixed(4))
          }))
        };
      }

      const newMeasureStartBeats = [0];
      for (let i = 0; i < nextMeasures.length; i++) newMeasureStartBeats.push(newMeasureStartBeats[i] + nextMeasures[i].timeSignature.upper);

      // 3. 全局重映射映射表 (Helper)
      const remap = (a: SyncAnchor) => {
        let mIdx = 0;
        for (let i = 0; i < prevMeasures.length; i++) {
          if (a.beat < oldMeasureStartBeats[i+1]) { mIdx = i; break; }
          mIdx = i;
        }
        const ratio = (a.beat - oldMeasureStartBeats[mIdx]) / prevMeasures[mIdx].timeSignature.upper;
        const newBeat = newMeasureStartBeats[mIdx] + (nextMeasures[mIdx].timeSignature.upper * ratio);
        return { ...a, beat: Number(newBeat.toFixed(4)) };
      };

      // 执行重映射
      setLocalSync(s => ({ ...s, anchors: tempSync.anchors.map(remap) }));
      setSessionAnchors(s => s.map(remap));

      return nextMeasures;
    });
  }, [localSync]);

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
  }, [handleTap, isRecording, isPlaying]);

  /**
   * 开始一个新的打拍会话 (startSession)
   */
  const startSession = async () => {
    setSessionAnchors([]);
    setIsRecording(true);
    if (audioRef.current) {
      if (analyserRef.current?.context.state === "suspended") await (analyserRef.current.context as AudioContext).resume();
      audioRef.current.play().catch(console.error);
      setIsPlaying(true);
    }
  };

  /**
   * 将打拍结果同步至主工程 (applySync)
   */
  const applySync = useCallback(() => {
    const sessionBeats = new Set(sessionAnchors.map(a => a.beat));
    const mergedAnchors = [
      ...localSync.anchors.filter(a => !sessionBeats.has(a.beat)),
      ...sessionAnchors
    ].sort((a, b) => a.beat - b.beat);

    onUpdateProject({
      ...project,
      sync: { ...localSync, anchors: mergedAnchors },
      measures: localMeasures
    });
    onClose();
  }, [project, sessionAnchors, localMeasures, localSync, onUpdateProject, onClose]);

  /**
   * 处理点击时间轴跳转进度 (handleTimelineClick)
   * @param e
   */
  const handleTimelineClick = (e: React.MouseEvent) => {
    if (!audioRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    const time = Math.max(0, Math.min(duration, x / zoom));
    audioRef.current.currentTime = time;
    if (isRecording) setSessionAnchors([]);
  };

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
          <div className="tapper-config" style={{ display: "flex", gap: 24, alignItems: "flex-end" }}>
            <div className="field" style={{ margin: 0 }}>
              <label>时间轴缩放:</label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input 
                  type="range" min="10" max="200" value={zoom} 
                  onChange={(e) => setZoom(Number(e.target.value))} 
                  style={{ width: 150 }}
                />
                <span style={{ fontSize: 10, color: "var(--muted)" }}>(Ctrl + 滚轮也可缩放)</span>
              </div>
            </div>

            <div className="tapper-controls" style={{ marginLeft: "auto", display: "flex", gap: 12 }}>
              <button className="btn" onClick={() => { setSessionAnchors([]); setLocalMeasures([...(project.measures || [])]); }} disabled={sessionAnchors.length === 0}>
                重置本次打拍
              </button>
              <button className={`btn btn--large ${isPlaying ? "active" : ""}`} onClick={togglePlay}>
                {isPlaying ? "暂停 (Space)" : "播放 (Space)"}
              </button>
              <button 
                className={`btn btn--large btn--primary ${isRecording ? "recording" : ""}`} 
                onClick={isRecording ? handleTap : startSession}
              >
                {isRecording ? `TAP (标记第 ${localMeasures[currentTargetIdx]?.index ?? (localMeasures.length + 1)} 小节)` : "开始实时打拍"}
              </button>
            </div>
          </div>

          <div 
            className="tapper-visualizer" 
            ref={scrollRef} 
            style={{ height: 100, overflowX: "auto", overflowY: "hidden", cursor: "pointer" }}
            onClick={handleTimelineClick}
          >
            <div style={{ width: timelineWidth, position: "relative", height: "100%" }}>
              <div className="time-ruler" style={{ height: 18 }}>
                {Array.from({ length: Math.ceil(duration) + 1 }).map((_, i) => (
                  <div key={i} className="time-tick" style={{ left: i * zoom, width: zoom, borderLeft: "1px solid #222", fontSize: 10 }}>
                    {i}s
                  </div>
                ))}
              </div>
              
              <div className="waveform-container" style={{ height: 82, position: "relative" }}>
                <canvas ref={canvasRef} width={timelineWidth} height={82} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
                
                {localMeasures.map((m, i) => {
                  const beat = getBeatOfMeasure(i);
                  const time = beatToTime(beat, localSync);
                  const sessionAnchor = sessionAnchors.find(sa => sa.beat === beat);
                  const displayTime = sessionAnchor ? sessionAnchor.timeSec : time;

                  const isFirst = i === 0;
                  const isChangePoint = isFirst || m.timeSignature.upper !== localMeasures[i-1].timeSignature.upper;

                  return (
                    <div 
                      key={`measure-${i}`} 
                      className={`anchor-line ${sessionAnchor ? "new" : "old"}`} 
                      style={{ left: displayTime * zoom, background: sessionAnchor ? undefined : "rgba(255, 255, 255, 0.5)", borderLeft: sessionAnchor ? undefined : "1px solid rgba(255, 255, 255, 0.2)" }}
                    >
                      <div className="measure-info-box" onClick={(e) => e.stopPropagation()}>
                        <span className="m-idx">第 {m.index} 小节</span>
                        {isChangePoint ? (
                          <>
                            <div className="ts-select-container" title="修改此小节及之后所有小节的拍号">
                              <select className="ts-select" value={m.timeSignature.upper} onChange={(e) => updateTimeSignature(i, Number(e.target.value))}>
                                {[1,2,3,4,5,6,7,8,9,10,11,12].map(v => <option key={v} value={v}>{v}</option>)}
                              </select>
                            </div>
                            <span className="ts-lower">/ {m.timeSignature.lower}</span>
                            {!isFirst && <button className="ts-del-btn" title="删除此拍号变更" onClick={() => updateTimeSignature(i, localMeasures[i-1].timeSignature.upper)}>×</button>}
                          </>
                        ) : (
                          <button className="ts-add-btn" title="添加拍号变更" onClick={() => updateTimeSignature(i, m.timeSignature.upper === 4 ? 3 : 4)}>+</button>
                        )}
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

