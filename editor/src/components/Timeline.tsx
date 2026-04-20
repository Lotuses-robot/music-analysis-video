import type { FC } from "react";
import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import type { MusicAnalysisVideoProject, MeasureEvent, SyncAnchor } from "../../../src/types/project";
import { getLastContentBeat } from "../../../src/analysis/duration";
import { flattenEvents } from "../../../src/analysis/selectors";
import { beatToTime, timeToBeat } from "../../../src/sync/beatTime";

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

  // 计算时间轴总长度
  const maxBeat = useMemo(() => Math.max(getLastContentBeat(project) + 8, 32), [project]);
  const maxTimeSec = useMemo(() => beatToTime(maxBeat, project.sync), [maxBeat, project.sync]);
  const width = maxTimeSec * zoom;

  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);

  /**
   * 加载并解码音频文件，用于生成波形图。
   */
  useEffect(() => {
    if (!project.meta.audioPath) return;
    
    const url = `/${project.meta.audioPath}`;
    fetch(url)
      .then(res => res.arrayBuffer())
      .then(buffer => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        return ctx.decodeAudioData(buffer);
      })
      .then(decodedBuffer => {
        setAudioBuffer(decodedBuffer);
      })
      .catch(err => console.error("Failed to decode audio for waveform:", err));
  }, [project.meta.audioPath]);

  const waveformCanvasRef = useRef<HTMLCanvasElement>(null);

  /**
   * 渲染音频波形到 Canvas。
   */
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas || !audioBuffer) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = width;
    const h = canvas.height;
    
    canvas.width = w;
    canvas.height = h;
    
    ctx.clearRect(0, 0, w, h);
    
    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / w);
    const amp = h / 2;

    ctx.fillStyle = "rgba(77, 144, 254, 0.4)";
    ctx.beginPath();
    ctx.moveTo(0, amp);

    for (let i = 0; i < w; i++) {
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const datum = data[(i * step) + j]; 
        if (datum < min) min = datum;
        if (datum > max) max = datum;
      }
      ctx.fillRect(i, amp * (1 + min), 1, Math.max(1, amp * (max - min)));
    }
  }, [audioBuffer, width, zoom]);

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
   * @param upper 拍号分子 (beats per measure)
   */
  const updateTimeSignature = useCallback((idx: number, upper: number) => {
    if (!onUpdateProject) return;
    
    const prevMeasures = project.measures;
    const nextMeasures = [...prevMeasures];
    
    // 1. 锁定当前小节的起始和结束物理时间
    let oldStartBeat = 0;
    for (let i = 0; i < idx; i++) oldStartBeat += prevMeasures[i].timeSignature.upper;
    const oldEndBeat = oldStartBeat + prevMeasures[idx].timeSignature.upper;
    
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
    const oldMeasureStartBeats: number[] = [0];
    for (let i = 0; i < prevMeasures.length; i++) {
      oldMeasureStartBeats.push(oldMeasureStartBeats[i] + prevMeasures[i].timeSignature.upper);
    }

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

    // 3. 全局重映射同步锚点
    const newMeasureStartBeats: number[] = [0];
    for (let i = 0; i < nextMeasures.length; i++) {
      newMeasureStartBeats.push(newMeasureStartBeats[i] + nextMeasures[i].timeSignature.upper);
    }

    const nextSync = { ...tempSync, anchors: [...tempSync.anchors] };
    nextSync.anchors = nextSync.anchors.map(a => {
      let mIdx = 0;
      for (let i = 0; i < prevMeasures.length; i++) {
        if (a.beat < oldMeasureStartBeats[i+1]) {
          mIdx = i;
          break;
        }
        mIdx = i;
      }

      const oldStart = oldMeasureStartBeats[mIdx];
      const oldLen = prevMeasures[mIdx].timeSignature.upper;
      const ratio = (a.beat - oldStart) / oldLen;

      const newStart = newMeasureStartBeats[mIdx];
      const newLen = nextMeasures[mIdx].timeSignature.upper;
      const newBeat = newStart + (newLen * ratio);

      return { ...a, beat: Number(newBeat.toFixed(4)) };
    });

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
        const prevTS = !isFirst ? project.measures[mIdx-1].timeSignature.upper : null;
        const isChangePoint = isFirst || m.timeSignature.upper !== prevTS;

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
              zIndex: 10,
            }}
          >
            <div className="measure-info-box" style={{ top: 2, background: "rgba(0,0,0,0.8)" }} onClick={(e) => e.stopPropagation()}>
              <span className="m-idx">第 {m.index} 小节</span>
              {isChangePoint ? (
                <>
                  <div className="ts-select-container" title="修改此小节及之后所有小节的拍号">
                    <select 
                      className="ts-select"
                      value={m.timeSignature.upper}
                      onChange={(e) => updateTimeSignature(mIdx, Number(e.target.value))}
                    >
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                  <span className="ts-lower">/ {m.timeSignature.lower}</span>
                  {!isFirst && (
                    <button 
                      className="ts-del-btn" 
                      title="删除此拍号变更（跟随前一小节）"
                      onClick={() => updateTimeSignature(mIdx, project.measures[mIdx-1].timeSignature.upper)}
                    >
                      ×
                    </button>
                  )}
                </>
              ) : (
                <button 
                  className="ts-add-btn" 
                  title="在此处添加拍号变更"
                  onClick={() => updateTimeSignature(mIdx, m.timeSignature.upper === 4 ? 3 : 4)}
                >
                  +
                </button>
              )}
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
    return (
      <div 
        className="timeline-track comment-track"
        onClick={(e) => handleTrackClick(e, "comment")}
        onDoubleClick={(e) => handleTrackDoubleClick(e, "comment")}
      >
        <div className="track-label">备注</div>
        {comments.map((c, i) => {
          const sec = beatToTime(c.beat, project.sync);
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
                left: sec * zoom,
                height: "70%",
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
          <div className="timeline-ruler" style={{ height: 30, borderBottom: "1px solid #333", position: "relative" }}>
            {renderRuler()}
          </div>
          
          {/* Tracks */}
          {renderSections()}
          {renderChords()}
          {renderKeyChanges()}
          {renderComments()}
          
          {/* Waveform / Emotion (Adjacent) */}
          {renderEmotion()}
          <div className="timeline-track" style={{ height: 80, overflow: "hidden" }}>
            <div className="track-label">波形</div>
            <div style={{ position: "absolute", width: "100%", height: "100%", background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.02), transparent)" }}>
              <canvas 
                ref={waveformCanvasRef} 
                style={{ position: "absolute", left: 0, top: 0, height: "100%" }} 
              />
            </div>
          </div>

          {/* Playhead */}
          <div
            style={{
              position: "absolute",
              left: currentTimeSec * zoom,
              top: 0,
              width: 2,
              height: "100%",
              background: "var(--accent)",
              zIndex: 100,
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
