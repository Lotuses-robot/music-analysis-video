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

export interface BarInfo {
  barNumber: number; // 1-indexed
  beatInBar: number; // 1-indexed (e.g. 1.0, 2.5)
  beatsPerBar: number;
}

/**
 * Calculates bar and beat-in-bar given the current beat,
 * respecting all time signature changes from the start (beat 0).
 */
export function getBarInfo(project: MusicAnalysisVideoProject, beat: number): BarInfo {
  const changes = [...(project.timeSignature.changes ?? [])].sort((a, b) => a.beat - b.beat);

  let currentBarStartBeat = 0;
  let currentBarNumber = 1;
  let currentTS = project.timeSignature.default;

  // We need to iterate through changes that happened BEFORE the current beat
  for (const change of changes) {
    if (change.beat > beat) break;

    // Calculate how many FULL bars passed in the PREVIOUS time signature
    const beatsInThisSegment = change.beat - currentBarStartBeat;
    const fullBarsInSegment = Math.floor(beatsInThisSegment / currentTS.upper);

    // Note: Time signature changes usually happen at the start of a bar.
    // If a change happens mid-bar in the JSON, we treat it as starting a new bar.
    currentBarNumber += fullBarsInSegment;
    if (beatsInThisSegment % currentTS.upper !== 0) {
      currentBarNumber += 1; // Partial bar also counts as one bar move
    }

    currentBarStartBeat = change.beat;
    currentTS = { upper: change.upper, lower: change.lower };
  }

  // Calculate position within the current segment
  const beatsSinceSegmentStart = beat - currentBarStartBeat;
  const barsInCurrentSegment = Math.floor(beatsSinceSegmentStart / currentTS.upper);

  return {
    barNumber: currentBarNumber + barsInCurrentSegment,
    beatInBar: (beatsSinceSegmentStart % currentTS.upper) + 1,
    beatsPerBar: currentTS.upper,
  };
}
