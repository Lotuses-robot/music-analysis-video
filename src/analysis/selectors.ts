import type {
  MeasureEvent,
  MusicAnalysisVideoProject,
  TimeSignature,
} from "../types/project";
import { timeToBeat } from "../sync/beatTime";

/**
 *
 * @param project
 * @param timeSec
 */
export function getBeatAtTimeSec(project: MusicAnalysisVideoProject, timeSec: number): number {
  return timeToBeat(timeSec, project.sync);
}

/**
 * Helper to convert measure-based data into a flat stream of absolute-beat events.
 * @param project
 * @param filter
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
 *
 * @param project
 * @param beat
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
 *
 * @param project
 * @param beat
 */
export function getNextChord(project: MusicAnalysisVideoProject, beat: number): { symbol: string; beat: number } | undefined {
  const chords = flattenEvents(project, (e) => e.type === "chord");
  const next = chords.find((c) => c.beat > beat);
  return next ? { symbol: next.event.value as string, beat: next.beat } : undefined;
}

/**
 *
 * @param project
 * @param beat
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
 *
 * @param project
 * @param beat
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
 *
 * @param project
 * @param beat
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
 *
 * @param project
 * @param beat
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
 *
 * @param project
 * @param beat
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
