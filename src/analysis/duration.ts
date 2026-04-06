import type { MusicAnalysisVideoProject } from "../types/project";
import { beatToTime } from "../sync/beatTime";

/** Extra seconds after the last musical event. */
export const TAIL_SEC = 2;

export function collectBeatCandidates(project: MusicAnalysisVideoProject): number[] {
  const beats: number[] = [];
  for (const a of project.sync.anchors) beats.push(a.beat);
  for (const c of project.chords) beats.push(c.beat);
  for (const m of project.melody) beats.push(m.beat);
  for (const s of project.sections) {
    beats.push(s.startBeat);
    if (s.endBeat !== undefined) beats.push(s.endBeat);
  }
  return beats;
}

export function getLastContentBeat(project: MusicAnalysisVideoProject): number {
  const beats = collectBeatCandidates(project);
  return beats.length === 0 ? 0 : Math.max(0, ...beats);
}

/** Timeline length in seconds on the trimmed/synced clock (before tail). */
export function getSyncedEndSec(project: MusicAnalysisVideoProject): number {
  return beatToTime(getLastContentBeat(project), project.sync);
}

export function getContentEndSec(project: MusicAnalysisVideoProject): number {
  return getSyncedEndSec(project) + TAIL_SEC;
}

export function getFps(project: MusicAnalysisVideoProject): number {
  return project.export?.fps ?? 30;
}
