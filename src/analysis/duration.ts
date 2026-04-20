import type { MusicAnalysisVideoProject } from "../types/project";
import { beatToTime } from "../sync/beatTime";
import { flattenEvents } from "./selectors";

/** Extra seconds after the last musical event. */
export const TAIL_SEC = 2;

/**
 *
 * @param project
 */
export function collectBeatCandidates(project: MusicAnalysisVideoProject): number[] {
  const beats: number[] = [];
  
  // Anchors are already absolute beats
  for (const a of project.sync.anchors) {
    beats.push(a.beat);
  }
  
  // Flatten all measure events to get their absolute beats
  const allEvents = flattenEvents(project, () => true);
  for (const e of allEvents) {
    beats.push(e.beat);
  }
  
  // Calculate end beat of the last measure
  let totalBeats = 0;
  if (project.measures) {
    for (const m of project.measures) {
      totalBeats += m.timeSignature.upper;
    }
  }
  beats.push(totalBeats);
  
  return beats;
}

/**
 *
 * @param project
 */
export function getLastContentBeat(project: MusicAnalysisVideoProject): number {
  const beats = collectBeatCandidates(project);
  return beats.length === 0 ? 0 : Math.max(0, ...beats);
}

/**
 * Timeline length in seconds on the trimmed/synced clock (before tail).
 * @param project
 */
export function getSyncedEndSec(project: MusicAnalysisVideoProject): number {
  return beatToTime(getLastContentBeat(project), project.sync);
}

/**
 *
 * @param project
 */
export function getContentEndSec(project: MusicAnalysisVideoProject): number {
  return getSyncedEndSec(project) + TAIL_SEC;
}

/**
 *
 * @param project
 */
export function getFps(project: MusicAnalysisVideoProject): number {
  return project.export?.fps ?? 30;
}
