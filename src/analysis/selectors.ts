import type {
  ChordEvent,
  MusicAnalysisVideoProject,
  ProjectSection,
  TimeSignature,
} from "../types/project";
import { timeToBeat } from "../sync/beatTime";

export function getBeatAtTimeSec(project: MusicAnalysisVideoProject, timeSec: number): number {
  return timeToBeat(timeSec, project.sync);
}

export function getActiveChord(project: MusicAnalysisVideoProject, beat: number): ChordEvent | undefined {
  const sorted = [...project.chords].sort((a, b) => a.beat - b.beat);
  let current: ChordEvent | undefined;
  for (const c of sorted) {
    if (c.beat <= beat) current = c;
    else break;
  }
  return current;
}

export function getNextChord(project: MusicAnalysisVideoProject, beat: number): ChordEvent | undefined {
  const sorted = [...project.chords].sort((a, b) => a.beat - b.beat);
  return sorted.find((c) => c.beat > beat);
}

export function getActiveSection(project: MusicAnalysisVideoProject, beat: number): ProjectSection | undefined {
  return project.sections.find((s) => {
    const end = s.endBeat ?? Number.POSITIVE_INFINITY;
    return beat >= s.startBeat && beat < end;
  });
}

export function keyAtBeat(project: MusicAnalysisVideoProject, beat: number): string {
  let k = project.key.default;
  const changes = [...(project.key.changes ?? [])].sort((a, b) => a.beat - b.beat);
  for (const ch of changes) {
    if (ch.beat <= beat) k = ch.key;
  }
  return k;
}

export function timeSignatureAtBeat(project: MusicAnalysisVideoProject, beat: number): TimeSignature {
  let ts = project.timeSignature.default;
  const changes = [...(project.timeSignature.changes ?? [])].sort((a, b) => a.beat - b.beat);
  for (const ch of changes) {
    if (ch.beat <= beat) ts = { upper: ch.upper, lower: ch.lower };
  }
  return ts;
}
