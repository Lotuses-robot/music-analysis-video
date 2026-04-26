import type { FC } from "react";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { MusicAnalysisVideoProject, MeasureEvent, SyncAnchor } from "../../../src/types/project";
import { getLastContentBeat, getSyncedEndSec } from "../../../src/analysis/duration";
import { flattenEvents } from "../../../src/analysis/selectors";
import { beatToTime, timeToBeat, remapSyncAfterTimeSignatureChange } from "../../../src/sync/beatTime";

import { useAudioBuffer } from "../hooks/useAudioBuffer";

interface TimelineProps {
  project: MusicAnalysisVideoProject;
  currentBeat: number;
  selectedTool: "select" | "add" | "delete";
  onSeek: (beat: number) => void;
  onSelectEvent?: (measureIndex: number, eventIndex: number) => void;
  onUpdateEvent?: (measureIndex: number, eventIndex: number, patch: Partial<MeasureEvent> & { newMeasureIndex?: number }) => void;
  onAddEvent?: (measureIndex: number, event: MeasureEvent) => void;
  onDeleteEvent?: (measureIndex: number, eventIndex: number) => void;
  onUpdateProject?: (project: MusicAnalysisVideoProject) => void;
}

/**
 * 时间轴组件：负责可视化音频波形、网格、事件轨道以及处理用户交互逻辑。
 * @param props 组件属性
 * @param props.project 当前项目数据
 * @param props.currentBeat 当前播放拍数
 * @param props.selectedTool 当前选中的工具 (选择/添加/删除)
 * @param props.onSeek 跳转进度回调
 * @param props.onSelectEvent 选中事件回调
 * @param props.onUpdateEvent 更新事件回调
 * @param props.onAddEvent 添加事件回调
 * @param props.onDeleteEvent 删除事件回调
 * @param props.onUpdateProject 更新整个项目回调
 */
export const Timeline: FC<TimelineProps> = ({ 
  project, 
  currentBeat, 
  selectedTool,
  onSeek, 
  onSelectEvent, 
  onUpdateEvent, 
  onAddEvent,
  onDeleteEvent,
  onUpdateProject
}) => {
  const [zoom, setZoom] = useState(100); // 像素/秒 (Pixels per Second)
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDraggingSeek, setIsDraggingSeek] = useState(false);

  const { audioBuffer } = useAudioBuffer(project.meta.audioPath);

  // 计算时间轴总长度
  const maxBeat = useMemo(() => Math.max(getLastContentBeat(project) + 8, 32), [project]);
  const maxTimeSec = useMemo(() => {
    // 使用统一的时长计算逻辑，该逻辑已包含 Math.max(beatTime, audioDuration)
    return getSyncedEndSec(project);
  }, [project]);
  const width = maxTimeSec * zoom;

  // 关键：以解码后的精确时长为准，更新项目元数据
  // 解决 VBR MP3 等容器时长不准确导致的波形对齐问题
  useEffect(() => {
    if (audioBuffer && Math.abs((project.meta.duration || 0) - audioBuffer.duration) > 0.1) {
      console.log(`Updating project duration to decoded value: ${audioBuffer.duration}`);
      onUpdateProject?.({
        ...project,
        meta: { ...project.meta, duration: audioBuffer.duration }
      });
    }
  }, [audioBuffer, project, onUpdateProject]);

  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * 渲染音频波形到 Canvas。
   */
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 关键：音频波形的物理宽度必须严格等于 duration * zoom
    // 不再使用 Math.floor，允许亚像素渲染或由浏览器处理
    const audioWidth = audioBuffer.duration * zoom;
    const h = canvas.height;
    
    // 这里的 canvas.width 必须是整数，所以我们取 ceil 确保不截断
    const canvasWidth = Math.ceil(audioWidth);
    if (canvas.width !== canvasWidth) {
      canvas.width = canvasWidth;
      canvas.style.width = `${canvasWidth}px`;
    }
    
    ctx.clearRect(0, 0, canvasWidth, h);
    
    const data = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const audioStartOffset = project.meta.audioStartOffsetSec || 0;
    
    // 1像素对应的采样数 = 采样率 / 缩放倍率 (samples/sec / pixels/sec = samples/pixel)
    const samplesPerPixel = sampleRate / zoom;
    const amp = h / 2;

    ctx.fillStyle = "rgba(77, 144, 254, 0.4)";
    
    for (let i = 0; i < canvasWidth; i++) {
      // 计算当前像素对应的音频文件中的起始和结束时间
      // 核心修复：考虑 audioStartOffset，确保波形与播放进度对齐
      const startTimeInFile = (i / zoom) + audioStartOffset;
      const endTimeInFile = ((i + 1) / zoom) + audioStartOffset;
      
      const startSample = Math.floor(startTimeInFile * sampleRate);
      const endSample = Math.floor(endTimeInFile * sampleRate);
      
      if (startSample >= data.length || endSample < 0) continue;
      
      let min = 1.0;
      let max = -1.0;
      
      // 边界检查
      const actualStart = Math.max(0, startSample);
      const actualEnd = Math.min(data.length, endSample);
      
      if (actualStart >= actualEnd) continue;

      for (let j = actualStart; j < actualEnd; j++) {
        const datum = data[j]; 
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      
      if (min <= max) {
        ctx.fillRect(i, amp * (1 + min), 1, Math.max(1, amp * (max - min)));
      }
    }
  }, [audioBuffer, zoom, project.meta.audioStartOffsetSec]);

  /**
   * 处理鼠标滚轮缩放逻辑 (Ctrl + Wheel)。
   */
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.min(Math.max(z * delta, 10), 2000));
      }
    };
    
    const el = scrollRef.current;
    if (el) {
      el.addEventListener("wheel", handleWheel, { passive: false });
      return () => el.removeEventListener("wheel", handleWheel);
    }
  }, []);

  /**
   * 处理时间轴鼠标按下事件，开始拖拽进度或跳转进度。
   * @param e 鼠标事件
   */
  const handleTimelineMouseDown = useCallback((e: React.MouseEvent) => {
    if (selectedTool !== "select") return;
    if ((e.target as HTMLElement).classList.contains("timeline-tracks-inner") || 
        (e.target as HTMLElement).classList.contains("timeline-ruler")) {
      setIsDraggingSeek(true);
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      const timeSec = x / zoom;
      onSeek(timeToBeat(timeSec, project.sync));
    }
  }, [zoom, onSeek, selectedTool, project.sync]);

  /**
   * 处理时间轴拖拽移动进度。
   */
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDraggingSeek) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
      const timeSec = Math.max(0, x / zoom);
      onSeek(timeToBeat(timeSec, project.sync));
    }
  }, [isDraggingSeek, zoom, onSeek, project.sync]);

  const handleMouseUp = useCallback(() => {
    setIsDraggingSeek(false);
  }, []);

  /**
   * 修改拍号并执行“时间锁定重映射”。
   * 核心逻辑：确保小节线在物理秒数位置保持不动。
   * @param idx 小节索引 (0-based)
   * @param patch 拍号修改部分 (upper 或 lower)
   */
  const updateTimeSignature = useCallback((idx: number, patch: Partial<{ upper: number; lower: number }>) => {
    if (!onUpdateProject) return;
    
    const prevMeasures = project.measures;
    const nextMeasures = [...prevMeasures];
    const m = prevMeasures[idx];
    const nextTS = { ...m.timeSignature, ...patch };
    
    // 1. 锁定当前小节的起始和结束物理时间
    let oldStartBeat = 0;
    for (let i = 0; i < idx; i++) oldStartBeat += prevMeasures[i].timeSignature.upper;
    const oldEndBeat = oldStartBeat + m.timeSignature.upper;
    
    const startTimeSec = beatToTime(oldStartBeat, project.sync);
    const endTimeSec = beatToTime(oldEndBeat, project.sync);
    
    const tempSync = { ...project.sync, anchors: [...project.sync.anchors] };
    
    // 插入时间锚点锁
    const lockAnchor = (sync: { anchors: SyncAnchor[] }, beat: number, time: number) => {
      const existing = sync.anchors.find((a: SyncAnchor) => Math.abs(a.beat - beat) < 0.001);
      if (existing) {
        existing.timeSec = time;
      } else {
        sync.anchors.push({ beat, timeSec: time });
      }
      sync.anchors.sort((a: SyncAnchor, b: SyncAnchor) => a.beat - b.beat);
    };

    lockAnchor(tempSync, oldStartBeat, startTimeSec);
    lockAnchor(tempSync, oldEndBeat, endTimeSec);

    // 2. 更新小节拍号和内部事件位移
    const oldUpper = m.timeSignature.upper;
    const newUpper = nextTS.upper;
    
    for (let i = idx; i < nextMeasures.length; i++) {
      const curM = nextMeasures[i];
      const mOldUpper = curM.timeSignature.upper;
      const curNewUpper = (i === idx) ? newUpper : mOldUpper;
      nextMeasures[i] = {
        ...curM,
        timeSignature: (i === idx) ? nextTS : curM.timeSignature,
        events: curM.events.map(e => ({
          ...e,
          beatOffset: Number((e.beatOffset * (curNewUpper / mOldUpper)).toFixed(4))
        }))
      };
    }

    // 3. 全局重映射同步锚点
    const nextSync = {
      ...tempSync,
      anchors: remapSyncAfterTimeSignatureChange(
        tempSync.anchors,
        prevMeasures,
        nextMeasures,
        idx
      )
    };

    onUpdateProject({
      ...project,
      measures: nextMeasures,
      sync: nextSync
    });
  }, [project, onUpdateProject]);

  /**
   * 渲染刻度尺：绘制小节线和拍号选择器。
   */
  const renderRuler = () => {
    const ticks = [];
    
    if (project.measures) {
      let currentBeatAcc = 0;
      for (let mIdx = 0; mIdx < project.measures.length; mIdx++) {
        const m = project.measures[mIdx];
        const mLen = m.timeSignature.upper;
        
        // 关键：将拍数映射为物理时间秒数绘制
        const mStartSec = beatToTime(currentBeatAcc, project.sync);
        
        const isFirst = mIdx === 0;
        const prevM = !isFirst ? project.measures[mIdx - 1] : null;
        const isChangePoint = isFirst || 
          m.timeSignature.upper !== prevM?.timeSignature.upper || 
          m.timeSignature.lower !== prevM?.timeSignature.lower;

        // 绘制小节线
        ticks.push(
          <div
            key={`m-${mIdx}`}
            style={{
              position: "absolute",
              left: mStartSec * zoom,
              top: 0,
              bottom: 0,
              width: 1,
              background: "rgba(255,255,255,0.15)",
              zIndex: 100, // 提升层级到事件之上
              pointerEvents: "none", // 让小节线本身不挡点击
            }}
          >
            <div 
              className="measure-info-box" 
              style={{ 
                top: 2, 
                background: "transparent", // 去掉背景挡道
                padding: "2px 4px", 
                fontSize: "9px",
                pointerEvents: "auto", // 内部允许点击
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: 2,
                color: "rgba(255,255,255,0.5)",
                textShadow: "0 0 2px black" // 增加阴影确保在透明背景下可见
              }} 
              onClick={(e) => e.stopPropagation()}
            >
              <span className="m-idx">{m.index}</span>
              <div className="ts-edit-container" style={{ 
                display: isChangePoint ? "inline-flex" : "none", // 默认不显示，除非是变更点
                alignItems: "center", 
                gap: 2 
              }}>
                <select 
                  value={m.timeSignature.upper} 
                  onChange={(e) => updateTimeSignature(mIdx, { upper: Number(e.target.value) })}
                  style={{ background: "rgba(51,51,51,0.6)", border: "none", color: "var(--accent)", fontSize: 9, borderRadius: 2, cursor: "pointer" }}
                >
                  {[2,3,4,5,6,7,8,9,12].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                <span style={{ opacity: 0.5 }}>/</span>
                <select 
                  value={m.timeSignature.lower} 
                  onChange={(e) => updateTimeSignature(mIdx, { lower: Number(e.target.value) })}
                  style={{ background: "rgba(51,51,51,0.6)", border: "none", color: "var(--accent)", fontSize: 9, borderRadius: 2, cursor: "pointer" }}
                >
                  {[2,4,8,16].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            </div>
          </div>
        );

        // 绘制小节内部拍线
        for (let b = 1; b < mLen; b++) {
          const beatSec = beatToTime(currentBeatAcc + b, project.sync);
          ticks.push(
            <div
              key={`m-${mIdx}-b-${b}`}
              style={{
                position: "absolute",
                left: beatSec * zoom,
                top: 0,
                bottom: 0,
                width: 1,
                background: "rgba(255,255,255,0.05)",
                zIndex: 1,
                pointerEvents: "none",
              }}
            />
          );
        }
        currentBeatAcc += mLen;
      }

      // 绘制末尾的“添加小节”按钮
      const lastBeatSec = beatToTime(currentBeatAcc, project.sync);
      ticks.push(
        <div
          key="add-measure-btn"
          style={{
            position: "absolute",
            left: lastBeatSec * zoom + 5,
            top: 2,
            zIndex: 20,
          }}
        >
          <button 
            className="btn btn--small" 
            style={{ padding: "0 4px", fontSize: 10, background: "rgba(255,255,255,0.1)" }}
            onClick={(e) => {
              e.stopPropagation();
              const lastTS = project.measures.length > 0 ? project.measures[project.measures.length - 1].timeSignature : { upper: 4, lower: 4 };
              onUpdateProject({
                ...project,
                measures: [...project.measures, {
                  index: project.measures.length + 1,
                  timeSignature: { ...lastTS },
                  events: []
                }]
              });
            }}
            title="在末尾添加小节"
          >
            ➕
          </button>
        </div>
      );
    }

    return ticks;
  };

  /**
   * 处理轨道双击：在指定位置添加新事件。
   */
  const handleTrackDoubleClick = useCallback((e: React.MouseEvent, type: MeasureEvent["type"]) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    const timeSec = x / zoom;
    const beat = timeToBeat(timeSec, project.sync);
    
    let measureStartBeat = 0;
    let mIdx = 0;
    if (!project.measures) return;
    for (let i = 0; i < project.measures.length; i++) {
      const mLen = project.measures[i].timeSignature.upper;
      if (beat >= measureStartBeat && beat < measureStartBeat + mLen) {
        mIdx = i;
        break;
      }
      mIdx = i;
      measureStartBeat += mLen;
    }
    
    if (!project.measures[mIdx]) return;

    const offset = Math.max(0, beat - measureStartBeat);
    const defaultValue = 
      type === "chord" ? "C" : 
      type === "section" ? "新段落" : 
      type === "key_change" ? "C major" :
      type === "comment" ? "新备注" :
      "New Event";
    
    const newEvent: MeasureEvent = {
      type,
      beatOffset: Number(offset.toFixed(2)),
      value: defaultValue
    };
    
    onAddEvent?.(mIdx, newEvent);
  }, [zoom, project.measures, project.sync, onAddEvent]);

  /**
   * 处理事件点击逻辑。
   */
  const handleEventClick = useCallback((e: React.MouseEvent, mIndex: number, eIndex: number, beat: number) => {
    e.stopPropagation();
    if (selectedTool === "delete") {
      onDeleteEvent?.(mIndex, eIndex);
    } else {
      onSeek(beat);
      onSelectEvent?.(mIndex, eIndex);
    }
  }, [selectedTool, onDeleteEvent, onSeek, onSelectEvent]);

  const handleEventDoubleClick = useCallback((e: React.MouseEvent, mIndex: number, eIndex: number) => {
    e.stopPropagation();
    onDeleteEvent?.(mIndex, eIndex);
  }, [onDeleteEvent]);

  /**
   * 处理拖放放置 (onDrop)
   * 
   * 核心逻辑：
   * 1. 解析拖拽数据，获取原始小节和事件索引。
   * 2. 计算鼠标释放位置对应的目标拍数。
   * 3. 寻找目标小节。
   * 4. 严格边界锁定：如果拖拽到当前小节之外，自动吸附到当前小节的起始 (0) 或末尾 (upper - 0.01)。
   * 5. 调用 onUpdateEvent 更新项目状态。
   * 
   * @param e 拖拽事件
   */
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const { mIndex, eIndex } = JSON.parse(data);
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
    const timeSec = x / zoom;
    const targetBeat = timeToBeat(timeSec, project.sync);
    
    // 计算当前小节的起始拍数范围
    let measureStartBeat = 0;
    for (let i = 0; i < mIndex; i++) {
      measureStartBeat += project.measures[i].timeSignature.upper;
    }
    const currentMeasureUpper = project.measures[mIndex].timeSignature.upper;
    const measureEndBeat = measureStartBeat + currentMeasureUpper;

    // 自动吸附逻辑：如果目标位置超出了当前小节，则锁定在边缘
    let finalOffset: number;
    if (targetBeat < measureStartBeat) {
      finalOffset = 0; // 锁到开头
    } else if (targetBeat >= measureEndBeat) {
      finalOffset = currentMeasureUpper - 0.01; // 锁到末尾
    } else {
      finalOffset = targetBeat - measureStartBeat; // 在小节内正常移动
    }

    onUpdateEvent?.(mIndex, eIndex, { 
      beatOffset: Number(finalOffset.toFixed(2)),
      newMeasureIndex: mIndex // 显式保持在原小节，增强稳定性
    });
  }, [zoom, project.measures, project.sync, onUpdateEvent]);

  /**
   * 处理拖拽悬停 (onDragOver)
   * @param e 拖拽事件
   */
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); 
  }, []);

  /**
   * 处理轨道点击 (onClick)
   * 
   * 逻辑：
   * 1. 如果当前是“添加”工具，则执行双击逻辑（在点击处添加事件）。
   * 2. 如果当前是“选择”工具，则跳转到点击的时间点。
   * 
   * @param e 鼠标事件
   * @param type 事件类型
   */
  const handleTrackClick = useCallback((e: React.MouseEvent, type: MeasureEvent["type"]) => {
    if (selectedTool === "add") {
      handleTrackDoubleClick(e, type);
    } else if (selectedTool === "select") {
      const rect = scrollRef.current?.getBoundingClientRect();
      if (rect) {
        const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
        const timeSec = x / zoom;
        onSeek(timeToBeat(timeSec, project.sync));
      }
    }
  }, [selectedTool, handleTrackDoubleClick, zoom, onSeek, project.sync]);

  /**
   * 渲染轨道：和弦 (Chords)。
   * @returns 和弦轨道 JSX
   */
  const renderChords = () => {
    const chords = flattenEvents(project, (e) => e.type === "chord");
    return (
      <div 
        className="timeline-track chord-track"
        onClick={(e) => handleTrackClick(e, "chord")}
        onDoubleClick={(e) => handleTrackDoubleClick(e, "chord")}
      >
        <div className="track-label">和弦</div>
        {chords.map((c, i) => {
          const sec = beatToTime(c.beat, project.sync);
          return (
            <div
              key={`chord-${i}`}
              draggable={selectedTool === "select"}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/json", JSON.stringify({ mIndex: c.mIndex, eIndex: c.eIndex, startBeat: c.beat }));
              }}
              onClick={(e) => handleEventClick(e, c.mIndex, c.eIndex, c.beat)}
              onDoubleClick={(e) => handleEventDoubleClick(e, c.mIndex, c.eIndex)}
              style={{
                position: "absolute",
                left: sec * zoom,
                height: "70%",
                padding: "0 8px",
                background: "#222",
                borderLeft: "2px solid var(--accent)",
                display: "flex",
                alignItems: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent)",
                cursor: selectedTool === "delete" ? "not-allowed" : "grab",
                whiteSpace: "nowrap",
                zIndex: 10,
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                borderRadius: "2px",
              }}
            >
              {c.event.value}
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染轨道：调式变更 (Key Changes)。
   * @returns 调式轨道 JSX
   */
  const renderKeyChanges = () => {
    const changes = flattenEvents(project, (e) => e.type === "key_change");
    return (
      <div 
        className="timeline-track key-track"
        onClick={(e) => handleTrackClick(e, "key_change")}
        onDoubleClick={(e) => handleTrackDoubleClick(e, "key_change")}
      >
        <div className="track-label">调式</div>
        {changes.map((c, i) => {
          const sec = beatToTime(c.beat, project.sync);
          return (
            <div
              key={`key-${i}`}
              draggable={selectedTool === "select"}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/json", JSON.stringify({ mIndex: c.mIndex, eIndex: c.eIndex, startBeat: c.beat }));
              }}
              onClick={(e) => handleEventClick(e, c.mIndex, c.eIndex, c.beat)}
              onDoubleClick={(e) => handleEventDoubleClick(e, c.mIndex, c.eIndex)}
              style={{
                position: "absolute",
                left: sec * zoom,
                height: "70%",
                padding: "0 8px",
                background: "#222",
                borderLeft: "2px solid #f59e0b",
                display: "flex",
                alignItems: "center",
                fontSize: 10,
                color: "#f59e0b",
                cursor: selectedTool === "delete" ? "not-allowed" : "grab",
                zIndex: 10,
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                borderRadius: "2px",
              }}
            >
              {c.event.value}
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染轨道：曲目段落 (Sections)。
   * @returns 段落轨道 JSX
   */
  const renderSections = () => {
    const sectionEvents = flattenEvents(project, (e) => e.type === "section");
    const sections: Array<{ label: string; startBeat: number; endBeat: number; mIndex: number; eIndex: number }> = [];
    
    if (sectionEvents.length > 0) {
      for (let i = 0; i < sectionEvents.length; i++) {
        const e = sectionEvents[i];
        const next = sectionEvents[i+1];
        sections.push({
          label: e.event.value as string,
          startBeat: e.beat,
          endBeat: next?.beat ?? maxBeat,
          mIndex: e.mIndex,
          eIndex: e.eIndex
        });
      }
    }

    return (
      <div 
        className="timeline-track section-track"
        onClick={(e) => handleTrackClick(e, "section")}
        onDoubleClick={(e) => handleTrackDoubleClick(e, "section")}
      >
        <div className="track-label">段落</div>
        {sections.map((s, i) => {
          const startSec = beatToTime(s.startBeat, project.sync);
          const endSec = beatToTime(s.endBeat, project.sync);
          return (
            <div
              key={`section-${i}`}
              draggable={selectedTool === "select"}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/json", JSON.stringify({ mIndex: s.mIndex, eIndex: s.eIndex, startBeat: s.startBeat }));
              }}
              onClick={(e) => handleEventClick(e, s.mIndex, s.eIndex, s.startBeat)}
              onDoubleClick={(e) => handleEventDoubleClick(e, s.mIndex, s.eIndex)}
              style={{
                position: "absolute",
                left: startSec * zoom,
                width: Math.max(20, (endSec - startSec) * zoom),
                height: "100%",
                background: "rgba(77, 144, 254, 0.1)",
                borderLeft: "3px solid #4d90fe",
                fontSize: 10,
                color: "#4d90fe",
                fontWeight: 700,
                display: "flex",
                alignItems: "flex-start",
                padding: "4px 8px",
                cursor: selectedTool === "delete" ? "not-allowed" : "grab",
                zIndex: 5,
                overflow: "hidden",
                whiteSpace: "nowrap",
                textOverflow: "ellipsis"
              }}
            >
              <span style={{ background: "#4d90fe", color: "#000", padding: "0 4px", borderRadius: "2px", marginRight: "4px" }}>
                {s.label}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染轨道：备注 (Comments)。
   * @returns 备注轨道 JSX
   */
  const renderComments = () => {
    const comments = flattenEvents(project, (e) => e.type === "comment");
    
    // 处理自动分块布局逻辑
    const lanes: { endX: number }[] = [];
    const commentItems = comments.map(c => {
      const x = beatToTime(c.beat, project.sync) * zoom;
      // 估算宽度：图标(16px) + 文字长度 * 约6px + 左右padding(16px)
      const estimatedWidth = 32 + (String(c.event.value).length * 6);
      
      // 寻找第一个可用的轨道(lane)
      let laneIndex = lanes.findIndex(l => x >= l.endX + 10);
      if (laneIndex === -1) {
        laneIndex = lanes.length;
        lanes.push({ endX: x + estimatedWidth });
      } else {
        lanes[laneIndex].endX = x + estimatedWidth;
      }
      
      return { ...c, x, laneIndex };
    });

    const laneHeight = 24;
    const totalHeight = Math.max(1, lanes.length) * laneHeight + 20;

    return (
      <div 
        className="timeline-track comment-track"
        onClick={(e) => handleTrackClick(e, "comment")}
        onDoubleClick={(e) => handleTrackDoubleClick(e, "comment")}
        style={{ height: totalHeight }}
      >
        <div className="track-label">备注</div>
        {commentItems.map((c, i) => {
          return (
            <div
              key={`comment-${i}`}
              draggable={selectedTool === "select"}
              onDragStart={(e) => {
                e.dataTransfer.setData("application/json", JSON.stringify({ mIndex: c.mIndex, eIndex: c.eIndex, startBeat: c.beat }));
              }}
              onClick={(e) => handleEventClick(e, c.mIndex, c.eIndex, c.beat)}
              onDoubleClick={(e) => handleEventDoubleClick(e, c.mIndex, c.eIndex)}
              style={{
                position: "absolute",
                left: c.x,
                top: c.laneIndex * laneHeight + 4,
                height: laneHeight - 4,
                padding: "0 8px",
                background: "rgba(255,255,255,0.05)",
                borderLeft: "2px solid #888",
                display: "flex",
                alignItems: "center",
                fontSize: 10,
                color: "#aaa",
                fontStyle: "italic",
                cursor: selectedTool === "delete" ? "not-allowed" : "grab",
                zIndex: 8,
                whiteSpace: "nowrap",
              }}
            >
              💬 {c.event.value}
            </div>
          );
        })}
      </div>
    );
  };

  /**
   * 渲染轨道：情感线 (Emotion Line)。
   */
  const renderEmotion = () => {
    const emotionPoints = flattenEvents(project, (e) => e.type === "emotion")
      .map((e) => ({ beat: e.beat, value: e.event.value as number }));
    
    if (emotionPoints.length === 0) return null;

    const valMin = Math.min(...emotionPoints.map((p) => p.value));
    const valMax = Math.max(...emotionPoints.map((p) => p.value));
    const valSpan = Math.max(1, valMax - valMin);

    return (
      <div className="timeline-track emotion-track" style={{ height: 60 }}>
        <div className="track-label">情感线</div>
        <svg style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "100%", overflow: "visible" }}>
          {emotionPoints.map((p, i) => {
            const x = beatToTime(p.beat, project.sync) * zoom;
            const y = 60 - ((p.value - valMin) / valSpan) * 40 - 10;
            const next = emotionPoints[i + 1];
            if (!next) return <circle key={i} cx={x} cy={y} r={2} fill="var(--accent)" />;
            const nextX = beatToTime(next.beat, project.sync) * zoom;
            const nextY = 60 - ((next.value - valMin) / valSpan) * 40 - 10;
            return (
              <g key={i}>
                <line x1={x} y1={y} x2={nextX} y2={nextY} stroke="var(--accent)" strokeWidth={1.5} opacity={0.6} />
                <circle cx={x} cy={y} r={2} fill="var(--accent)" />
              </g>
            );
          })}
        </svg>
      </div>
    );
  };

  const currentTimeSec = useMemo(() => beatToTime(currentBeat, project.sync), [currentBeat, project.sync]);

  return (
    <div className="timeline-content">
      <div className="timeline-zoom-controls">
        <span>Zoom: {Math.round(zoom)}px/sec</span>
        <span>(Ctrl + Scroll to Zoom)</span>
        <div style={{ marginLeft: "auto" }}>
          Beat: {currentBeat.toFixed(2)} | Time: {currentTimeSec.toFixed(2)}s
        </div>
      </div>
      
      <div 
        className="timeline-tracks" 
        ref={scrollRef}
        onMouseDown={handleTimelineMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDrop={onDrop}
        onDragOver={onDragOver}
      >
        <div className="timeline-tracks-inner" style={{ width, position: "relative", minHeight: "100%" }}>
          {/* Ruler */}
          <div className="timeline-ruler" style={{ height: 40, borderBottom: "1px solid #333", position: "relative", background: "#1a1a1a" }}>
            {/* Time Ticks (Seconds) */}
            <div className="time-ticks" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 20, pointerEvents: "none" }}>
              {Array.from({ length: Math.ceil(maxTimeSec) + 1 }).map((_, i) => (
                <div key={`sec-${i}`} style={{ position: "absolute", left: i * zoom, top: 0, height: 10, borderLeft: "1px solid rgba(255,255,255,0.2)", fontSize: 9, color: "#666", paddingLeft: 2 }}>
                  {i}s
                </div>
              ))}
            </div>
            {/* Measure Ticks */}
            <div className="measure-ticks" style={{ position: "absolute", bottom: 0, left: 0, width: "100%", height: 20 }}>
              {renderRuler()}
            </div>
          </div>
          
          {/* Audio Track (Waveform) */}
          <div className="timeline-track audio-track" style={{ height: 80, overflow: "hidden", background: "rgba(0,0,0,0.2)" }}>
            <div className="track-label">音频线</div>
            <div style={{ position: "absolute", width: "100%", height: "100%", background: "linear-gradient(to bottom, transparent, rgba(77, 144, 254, 0.05), transparent)" }}>
              <canvas 
                ref={waveformCanvasRef} 
                width={width}
                style={{ position: "absolute", left: 0, top: 0, height: "100%" }} 
              />
            </div>
          </div>

          {/* Tracks */}
          {renderSections()}
          {renderChords()}
          {renderKeyChanges()}
          {renderComments()}
          
          {/* Emotion (Adjacent) */}
          {renderEmotion()}

          {/* Playhead */}
          <div
            style={{
              position: "absolute",
              left: currentTimeSec * zoom,
              top: 0,
              width: 2,
              height: "100%",
              background: "var(--accent)",
              zIndex: 1000,
              pointerEvents: "none",
            }}
          >
            <div style={{ position: "absolute", top: 0, left: -4, width: 10, height: 10, background: "var(--accent)", borderRadius: "2px", transform: "rotate(45deg)" }} />
          </div>
        </div>
      </div>
    </div>
  );
};
