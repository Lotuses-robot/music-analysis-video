import type {
  MeasureEvent,
  MusicAnalysisVideoProject,
  TimeSignature,
} from "../types/project";
import { timeToBeat } from "../sync/beatTime";

/**
 * 获取指定时间点（秒）对应的绝对拍数。
 * @param project 项目数据
 * @param timeSec 时间（秒）
 * @returns 绝对拍数
 */
export function getBeatAtTimeSec(project: MusicAnalysisVideoProject, timeSec: number): number {
  return timeToBeat(timeSec, project.sync);
}

/**
 * 将基于小节的数据转换为平坦的绝对拍数事件流。
 * @param project 项目数据
 * @param filter 事件过滤器函数
 * @returns 包含拍数、事件内容及索引信息的数组
 */
export function flattenEvents(
  project: MusicAnalysisVideoProject,
  filter: (e: MeasureEvent) => boolean
): Array<{ beat: number; event: MeasureEvent; mIndex: number; eIndex: number }> {
  const result: Array<{ beat: number; event: MeasureEvent; mIndex: number; eIndex: number }> = [];
  if (!project.measures) return result;
  
  let currentStartBeat = 0;
  for (let mIndex = 0; mIndex < project.measures.length; mIndex++) {
    const m = project.measures[mIndex];
    for (let eIndex = 0; eIndex < m.events.length; eIndex++) {
      const e = m.events[eIndex];
      if (filter(e)) {
        result.push({ beat: currentStartBeat + e.beatOffset, event: e, mIndex, eIndex });
      }
    }
    currentStartBeat += m.timeSignature.upper;
  }
  return result.sort((a, b) => a.beat - b.beat);
}

/**
 * 获取当前拍数下的活动和弦。
 * @param project 项目数据
 * @param beat 当前绝对拍数
 * @returns 包含和弦符号和起始拍数的对象，若无则返回 undefined
 */
export function getActiveChord(project: MusicAnalysisVideoProject, beat: number): { symbol: string; beat: number } | undefined {
  const chords = flattenEvents(project, (e) => e.type === "chord");
  let current: { symbol: string; beat: number } | undefined;
  for (const c of chords) {
    if (c.beat <= beat) {
      current = { symbol: c.event.value as string, beat: c.beat };
    } else break;
  }
  return current;
}

/**
 * 获取下一个即将到来的和弦。
 * @param project 项目数据
 * @param beat 当前绝对拍数
 * @returns 包含和弦符号和起始拍数的对象，若无则返回 undefined
 */
export function getNextChord(project: MusicAnalysisVideoProject, beat: number): { symbol: string; beat: number } | undefined {
  const chords = flattenEvents(project, (e) => e.type === "chord");
  const next = chords.find((c) => c.beat > beat);
  return next ? { symbol: next.event.value as string, beat: next.beat } : undefined;
}

/**
 * 获取当前拍数下的活动段落（Section）。
 * @param project 项目数据
 * @param beat 当前绝对拍数
 * @returns 包含段落 ID、标签、起止拍数的对象
 */
export function getActiveSection(project: MusicAnalysisVideoProject, beat: number): { id: string; label: string; startBeat: number; endBeat?: number } | undefined {
  if (!project.measures) return undefined;
  
  const sectionEvents = flattenEvents(project, (e) => e.type === "section");
  let current: { id: string; label: string; startBeat: number; endBeat?: number } | undefined;
  
  if (sectionEvents.length > 0) {
    for (let i = 0; i < sectionEvents.length; i++) {
      const e = sectionEvents[i];
      if (e.beat <= beat) {
        const next = sectionEvents[i+1];
        current = {
          id: `sec-${i}`,
          label: e.event.value as string,
          startBeat: e.beat,
          endBeat: next?.beat
        };
      } else break;
    }
  }
  return current;
}

/**
 * 获取当前拍数下的活动注释。
 * @param project 项目数据
 * @param beat 当前绝对拍数
 * @returns 活动注释事件，若无则返回 undefined
 */
export function getActiveComment(project: MusicAnalysisVideoProject, beat: number): MeasureEvent | undefined {
  const comments = flattenEvents(project, (e) => e.type === "comment");
  let current: MeasureEvent | undefined;
  for (const c of comments) {
    if (c.beat <= beat) {
      current = c.event;
    } else break;
  }
  return current;
}

/**
 * 获取当前拍数下的调性（Key）。
 * @param project 项目数据
 * @param beat 当前绝对拍数
 * @returns 调性字符串（已去除小调标记等）
 */
export function keyAtBeat(project: MusicAnalysisVideoProject, beat: number): string {
  let currentKey = project.key.default;
  const keyChanges = flattenEvents(project, (e) => e.type === "key_change");
  for (const ch of keyChanges) {
    if (ch.beat <= beat) {
      currentKey = ch.event.value as string;
    } else break;
  }
  // Standardize to root only for degree calculation (remove "m" if present)
  return currentKey.replace(/m$/, "").replace(/\s.*$/, "");
}

/**
 * 获取当前拍数下的拍号（Time Signature）。
 * @param project 项目数据
 * @param beat 当前绝对拍数
 * @returns 拍号对象
 */
export function timeSignatureAtBeat(project: MusicAnalysisVideoProject, beat: number): TimeSignature {
  if (!project.measures || project.measures.length === 0) {
    return { upper: 4, lower: 4 }; // Fallback
  }
  let currentStartBeat = 0;
  for (const m of project.measures) {
    const measureLength = m.timeSignature.upper;
    if (beat >= currentStartBeat && beat < currentStartBeat + measureLength) {
      return m.timeSignature;
    }
    currentStartBeat += measureLength;
  }
  // Return last measure's TS if beyond
  return project.measures[project.measures.length - 1]?.timeSignature;
}

export interface BarInfo {
  barNumber: number; // 1-indexed
  beatInBar: number; // 1-indexed (e.g. 1.0, 2.5)
  beatsPerBar: number;
}

/**
 * 获取当前拍数对应的详细小节信息（小节号、拍位等）。
 * @param project 项目数据
 * @param beat 当前绝对拍数
 * @returns 包含小节号、小节内拍位和每小节拍数的对象
 */
export function getBarInfo(project: MusicAnalysisVideoProject, beat: number): BarInfo {
  if (!project.measures || project.measures.length === 0) {
    return { barNumber: 1, beatInBar: beat + 1, beatsPerBar: 4 };
  }
  let currentStartBeat = 0;
  for (const m of project.measures) {
    const measureLength = m.timeSignature.upper;
    if (beat >= currentStartBeat && beat < currentStartBeat + measureLength) {
      return {
        barNumber: m.index,
        beatInBar: (beat - currentStartBeat) + 1,
        beatsPerBar: measureLength,
      };
    }
    currentStartBeat += measureLength;
  }
  // If beyond last measure, return a plausible "extra" bar
  const last = project.measures[project.measures.length - 1];
  const lastStart = currentStartBeat - last.timeSignature.upper;
  const extraBeats = beat - lastStart;
  const extraBars = Math.floor(extraBeats / last.timeSignature.upper);
  return {
    barNumber: last.index + extraBars,
    beatInBar: (extraBeats % last.timeSignature.upper) + 1,
    beatsPerBar: last.timeSignature.upper,
  };
}

/**
 * 获取当前拍数下的线性插值情感温度。
 * @param project 项目数据
 * @param beat 当前绝对拍数
 * @returns 情感温度值 (通常在 60-72 之间，或根据项目设定)
 */
export function getEmotionAtBeat(project: MusicAnalysisVideoProject, beat: number): number {
  const points = flattenEvents(project, (e) => e.type === "emotion")
    .map((e) => ({ beat: e.beat, val: e.event.value as number }));
    
  if (points.length === 0) return 66; // 默认中等温度
  if (points.length === 1) return points[0].val;
  
  // 寻找前后的锚点
  const nextIdx = points.findIndex(p => p.beat > beat);
  if (nextIdx === -1) return points[points.length - 1].val;
  if (nextIdx === 0) return points[0].val;
  
  const prev = points[nextIdx - 1];
  const next = points[nextIdx];
  
  const ratio = (beat - prev.beat) / (next.beat - prev.beat);
  return prev.val + (next.val - prev.val) * ratio;
}

/**
 * 计算和弦相对于调性的级数。
 * @param keyRoot 调性根音 (如 "C", "F#")
 * @param chordSymbol 和弦符号 (如 "Cmaj7", "Am")
 * @returns 级数符号 (如 "I", "vi")
 */
export function getChordDegree(keyRoot: string, chordSymbol: string): string {
  if (!keyRoot || !chordSymbol) return "";

  const notes = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const flatMap: Record<string, string> = { "Db": "C#", "Eb": "D#", "Gb": "F#", "Ab": "G#", "Bb": "A#" };

  const normalize = (n: string) => flatMap[n] || n;

  // 提取和弦根音
  const chordRootMatch = chordSymbol.match(/^([A-G][#b]?)/);
  if (!chordRootMatch) return "";
  const chordRoot = normalize(chordRootMatch[1]);
  const chordSuffix = chordSymbol.slice(chordRootMatch[1].length);

  // 提取调性根音
  const keyRootNorm = normalize(keyRoot);

  const keyIdx = notes.indexOf(keyRootNorm);
  const chordIdx = notes.indexOf(chordRoot);

  if (keyIdx === -1 || chordIdx === -1) return chordSymbol;

  const semitones = (chordIdx - keyIdx + 12) % 12;
  const degrees = [
    { semitones: 0, roman: "I" },
    { semitones: 1, roman: "bII" },
    { semitones: 2, roman: "II" },
    { semitones: 3, roman: "bIII" },
    { semitones: 4, roman: "III" },
    { semitones: 5, roman: "IV" },
    { semitones: 6, roman: "bV" },
    { semitones: 7, roman: "V" },
    { semitones: 8, roman: "bVI" },
    { semitones: 9, roman: "VI" },
    { semitones: 10, roman: "bVII" },
    { semitones: 11, roman: "VII" },
  ];

  const degree = degrees.find(d => d.semitones === semitones);
  if (!degree) return chordSymbol;

  // 处理大小调风格：如果和弦是小调 (m, m7, dim)，级数通常用小写，但这里简单起见统一用大写加后缀
  let roman = degree.roman;
  if (chordSuffix.startsWith("m") && !chordSuffix.startsWith("maj")) {
    roman = roman.toLowerCase();
  }

  return roman + chordSuffix.replace(/^m/, "");
}
