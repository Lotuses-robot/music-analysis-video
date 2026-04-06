import { getContentEndSec } from "../../src/analysis/duration";
import {
  getActiveChord,
  getActiveSection,
  getBarInfo,
  getBeatAtTimeSec,
  getNextChord,
  keyAtBeat,
  timeSignatureAtBeat,
} from "../../src/analysis/selectors";
import type { MusicAnalysisVideoProject } from "../../src/types/project";
import { beatToTime } from "../../src/sync/beatTime";
import type { FrameAnalysis } from "../theme/types";

function buildMelodyGeometry(
  project: MusicAnalysisVideoProject,
  timeSec: number,
  totalSec: number,
  chartW: number,
  chartH: number,
): { lineD: string; playheadX: number } {
  const melodyPoints = [...project.melody].sort((a, b) => a.beat - b.beat);
  const midiMin = melodyPoints.length ? Math.min(...melodyPoints.map((p) => p.midi)) : 60;
  const midiMax = melodyPoints.length ? Math.max(...melodyPoints.map((p) => p.midi)) : 72;
  const midiSpan = Math.max(1, midiMax - midiMin);

  const toX = (b: number) => (beatToTime(b, project.sync) / totalSec) * chartW;
  const toY = (midi: number) =>
    chartH - ((midi - midiMin) / midiSpan) * (chartH * 0.72) - chartH * 0.14;

  const lineD =
    melodyPoints.length > 0
      ? melodyPoints
          .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.beat).toFixed(1)} ${toY(p.midi).toFixed(1)}`)
          .join(" ")
      : "";

  const playheadX =
    totalSec > 0 ? Math.min(chartW, Math.max(0, (timeSec / totalSec) * chartW)) : 0;

  return { lineD, playheadX };
}

export function buildFrameAnalysis(
  project: MusicAnalysisVideoProject,
  timeSec: number,
  chartW: number,
  chartH: number,
): FrameAnalysis {
  const beat = getBeatAtTimeSec(project, timeSec);
  const chord = getActiveChord(project, beat);
  const nextChord = getNextChord(project, beat);
  const section = getActiveSection(project, beat);
  const key = keyAtBeat(project, beat);
  const ts = timeSignatureAtBeat(project, beat);
  const totalSec = getContentEndSec(project);
  const { lineD, playheadX } = buildMelodyGeometry(project, timeSec, totalSec, chartW, chartH);
  const barInfo = getBarInfo(project, beat);

  // Extract chords within the current section
  const sectionChords = section
    ? project.chords
        .filter((c) => {
          const end = section.endBeat ?? Number.POSITIVE_INFINITY;
          return c.beat >= section.startBeat && c.beat < end;
        })
        .sort((a, b) => a.beat - b.beat)
        .map((c) => {
          // A chord is "active" if it's the latest one before or at current beat
          const activeChord = getActiveChord(project, beat);
          return {
            symbol: c.symbol,
            beat: c.beat,
            isActive: activeChord?.beat === c.beat,
          };
        })
    : [];

  return {
    timeSec,
    beat,
    chordSymbol: chord?.symbol ?? "—",
    nextChordSymbol: nextChord?.symbol ?? null,
    sectionLabel: section?.label ?? null,
    sectionComment: section?.comment ?? null,
    keyLabel: key,
    timeSignatureLabel: `${ts.upper}/${ts.lower}`,
    bpmHint: project.meta.bpmDisplayHint ?? null,
    melodyLinePath: lineD,
    playheadX,
    barNumber: barInfo.barNumber,
    beatInBar: barInfo.beatInBar,
    beatsPerBar: barInfo.beatsPerBar,
    sectionChords,
  };
}
