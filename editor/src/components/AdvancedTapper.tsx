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
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  
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

  const audioUrl = useMemo(() => {
    if (!project.meta.audioPath) return "";
    return project.meta.audioPath.startsWith("blob:") || project.meta.audioPath.startsWith("http")
      ? project.meta.audioPath 
      : `/${project.meta.audioPath}`;
  }, [project.meta.audioPath]);

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  /**
   * 加载并解码音频文件，用于生成波形图。
   */
  useEffect(() => {
    if (!audioUrl) return;
    
    fetch(audioUrl)
      .then(res => res.arrayBuffer())
      .then(async buffer => {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        try {
          const decodedBuffer = await ctx.decodeAudioData(buffer);
          setAudioBuffer(decodedBuffer);
          setDuration(decodedBuffer.duration); // 以解码后的精确时长为准
        } finally {
          await ctx.close();
        }
      })
      .catch(err => console.error("Failed to decode audio for AdvancedTapper waveform:", err));
  }, [audioUrl]);

  const timelineWidth = useMemo(() => duration * zoom, [duration, zoom]);

  /**
   * 实时更新播放进度及采集响度数据 (updateProgress)
   */
  const updateProgress = useCallback(function step() {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      
      // 如果还没有解码好的 buffer，先用 HTML5 Audio 的时长顶一下
      if (!audioBuffer) {
        setDuration(audioRef.current.duration || 0);
      }

      if (analyserRef.current && dataArrayRef.current && !audioRef.current.paused) {
        const data = dataArrayRef.current;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        analyserRef.current.getByteFrequencyData(data as any);
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
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
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
   * 在 Canvas 上绘制音频波形图。
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 关键：音频波形的物理宽度必须严格等于 duration * zoom
    const audioWidth = Math.floor(audioBuffer.duration * zoom);
    const h = canvas.height;
    
    // 只有在宽度变化时才重设 canvas 尺寸，避免闪烁
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
      // 绘制对称波形
      ctx.fillRect(i, amp * (1 + min), 1, Math.max(1, amp * (max - min)));
    }

    // 绘制当前响度历史作为叠加（可选，为了保留实时感）
    const history = loudnessHistoryRef.current;
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    for (let i = 0; i < history.length; i++) {
      if (history[i]) {
        const x = (i / 60) * zoom;
        const barH = (history[i] / 255) * h;
        ctx.fillRect(x, h - barH, 2, barH);
      }
    }
  }, [audioBuffer, timelineWidth, zoom]);

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
   * 在当前播放位置添加一个新的小节起始点（将当前时间锁定为最近小节的开始）
   */
  const handleAddMeasureAtCursor = useCallback(() => {
    // 找到当前时间应该处于哪个小节之后，或者直接作为新小节插入
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

    // 插入小节
    handleInsertMeasure(insertIdx);
    
    // 立即添加一个锚点到当前时间
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
    
    if (targetIdx !== -1) {
      handleDeleteMeasure(targetIdx);
    }
  }, [currentTime, localMeasures, getBeatOfMeasure, localSync, handleDeleteMeasure]);

  /**
   * 切换播放/暂停状态 (togglePlay)
   */
  const togglePlay = useCallback(async () => {
    if (audioRef.current) {
      if (analyserRef.current?.context.state === "suspended") {
        await (analyserRef.current.context as AudioContext).resume();
      }
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play().catch(console.error);
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

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
   * 在指定索引处插入一个小节
   * @param idx 插入位置的索引
   */
  const handleInsertMeasure = useCallback((idx: number) => {
    setLocalMeasures(prev => {
      const next = [...prev];
      const prevTS = idx > 0 ? prev[idx - 1].timeSignature : { upper: 4, lower: 4 };
      next.splice(idx, 0, {
        index: 0, // 后面统一重新计算 index
        timeSignature: { ...prevTS },
        events: []
      });
      return next.map((m, i) => ({ ...m, index: i + 1 }));
    });
    
    // 时间重映射：新小节之后的锚点需要往后移
    // 逻辑较复杂，简单处理：清除插入点之后的 sessionAnchors 或者保持不变
    // 这里选择保持不变，让用户手动对齐，因为插入一个小节会改变后续所有小节的 beat 编号
    const insertBeat = getBeatOfMeasure(idx);
    const addedBeats = idx > 0 ? localMeasures[idx-1].timeSignature.upper : 4;

    setSessionAnchors(prev => prev.map(a => a.beat >= insertBeat ? { ...a, beat: a.beat + addedBeats } : a));
  }, [getBeatOfMeasure, localMeasures]);

  /**
   * 删除指定索引的小节
   * @param idx 小节索引
   */
  const handleDeleteMeasure = useCallback((idx: number) => {
    const deletedBeat = getBeatOfMeasure(idx);
    const deletedBeats = localMeasures[idx].timeSignature.upper;

    setLocalMeasures(prev => {
      const next = prev.filter((_, i) => i !== idx).map((m, i) => ({ ...m, index: i + 1 }));
      return next;
    });
    
    // 同时移除该小节对应的打拍锚点，并让后续锚点前移
    setSessionAnchors(prev => {
      const filtered = prev.filter(a => a.beat !== deletedBeat);
      return filtered.map(a => a.beat > deletedBeat ? { ...a, beat: a.beat - deletedBeats } : a);
    });
  }, [getBeatOfMeasure, localMeasures]);

  /**
   * 手动添加小节
   */
  const handleAddMeasure = useCallback(() => {
    const lastTS = localMeasures.length > 0 ? localMeasures[localMeasures.length - 1].timeSignature : { upper: 4, lower: 4 };
    setLocalMeasures(prev => [...prev, {
      index: prev.length + 1,
      timeSignature: { ...lastTS },
      events: []
    }]);
  }, [localMeasures]);

  /**
   * 手动删除最后一个小节
   */
  const handleDeleteLastMeasure = useCallback(() => {
    if (localMeasures.length === 0) return;
    handleDeleteMeasure(localMeasures.length - 1);
  }, [localMeasures.length, handleDeleteMeasure]);

  /**
   * 处理拖拽小节线
   */
  const handleMouseDown = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setDraggingIdx(idx);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingIdx === null || !scrollRef.current) return;
      
      const rect = scrollRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left + scrollRef.current.scrollLeft;
      const time = Math.max(0, Math.min(duration, x / zoom));
      
      const beat = getBeatOfMeasure(draggingIdx);
      setSessionAnchors(prev => {
        const existing = prev.find(a => a.beat === beat);
        if (existing) {
          return prev.map(a => a.beat === beat ? { ...a, timeSec: time } : a);
        } else {
          return [...prev, { beat, timeSec: time }];
        }
      });
    };

    const handleMouseUp = () => {
      setDraggingIdx(null);
    };

    if (draggingIdx !== null) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [draggingIdx, duration, zoom, getBeatOfMeasure]);

  /**
   * 修改拍号并执行时间锁定重映射 (updateTimeSignature)
   * 
   * 逻辑与 Timeline.tsx 保持一致，确保在打拍器中修改拍号也不会导致小节线漂移。
   * 
   * @param idx 小节索引
   * @param patch 拍号修改部分 (upper 或 lower)
   */
  const updateTimeSignature = useCallback((idx: number, patch: Partial<{ upper: number; lower: number }>) => {
    setLocalMeasures(prevMeasures => {
      const nextMeasures = [...prevMeasures];
      const m = prevMeasures[idx];
      const nextTS = { ...m.timeSignature, ...patch };
      
      // 1. 物理边界时间锁定
      let oldStartBeatOfTarget = 0;
      for (let i = 0; i < idx; i++) oldStartBeatOfTarget += prevMeasures[i].timeSignature.upper;
      const oldEndBeatOfTarget = oldStartBeatOfTarget + m.timeSignature.upper;
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
        const curM = nextMeasures[i];
        const mOldUpper = curM.timeSignature.upper;
        const newUpper = nextTS.upper;
        nextMeasures[i] = {
          ...curM,
          timeSignature: { ...curM.timeSignature, ...patch },
          events: curM.events.map(e => ({
            ...e,
            beatOffset: Number((e.beatOffset * (newUpper / mOldUpper)).toFixed(4))
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
  }, [handleTap, isRecording, togglePlay]);

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
   * 应用所有打拍修正 (applySync)
   */
  const applySync = useCallback(() => {
    // 1. 合并锚点并去重/排序
    const existingAnchors = project.sync.anchors;
    const newAnchors = [...sessionAnchors];
    
    // 如果 sessionAnchors 中有重复的 beat，以 sessionAnchors 为准
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
      sync: {
        ...project.sync,
        anchors: merged
      }
    });
    onClose();
  }, [project, sessionAnchors, localMeasures, onUpdateProject, onClose]);

  /**
   * 处理点击时间轴跳转进度 (handleTimelineClick)
   * @param e 鼠标点击事件
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
          <div className="tapper-controls" style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 15, background: "rgba(255,255,255,0.05)", padding: 10, borderRadius: 8 }}>
            <button className="btn" onClick={togglePlay}>
              {isPlaying ? "暂停 (Space)" : "播放 (Space)"}
            </button>
            <button className="btn" onClick={() => { audioRef.current && (audioRef.current.currentTime = 0); }}>
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
                      style={{ 
                        left: displayTime * zoom, 
                        background: sessionAnchor ? undefined : "rgba(255, 255, 255, 0.5)", 
                        borderLeft: sessionAnchor ? "2px solid var(--accent)" : "1px solid rgba(255, 255, 255, 0.2)",
                        cursor: "col-resize",
                        width: 4, // 增加点击区域
                        marginLeft: -2,
                      }}
                      onMouseDown={(e) => handleMouseDown(e, i)}
                    >
                      <div className="measure-info-box" style={{ width: 80 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span className="m-idx" style={{ fontWeight: 700 }}>第 {m.index} 小节</span>
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

