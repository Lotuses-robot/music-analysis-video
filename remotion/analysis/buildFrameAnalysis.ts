import { getContentEndSec } from "../../src/analysis/duration";
import {
  getActiveChord,
  getActiveSection,
  getActiveComment,
  getBarInfo,
  getBeatAtTimeSec,
  getNextChord,
  keyAtBeat,
  timeSignatureAtBeat,
  flattenEvents,
  getEmotionAtBeat,
} from "../../src/analysis/selectors";
import type { MusicAnalysisVideoProject } from "../../src/types/project";
import { beatToTime } from "../../src/sync/beatTime";
import type { FrameAnalysis } from "../theme/types";

function buildEmotionGeometry(
  project: MusicAnalysisVideoProject,
  timeSec: number,
  totalSec: number,
  chartW: number,
  chartH: number,
): { lineD: string; playheadX: number } {
  const emotionPoints = flattenEvents(project, (e) => e.type === "emotion")
    .map((e) => ({ beat: e.beat, val: e.event.value as number }));
    
  const valMin = emotionPoints.length ? Math.min(...emotionPoints.map((p) => p.val)) : 60;
  const valMax = emotionPoints.length ? Math.max(...emotionPoints.map((p) => p.val)) : 72;
  const valSpan = Math.max(1, valMax - valMin);

  const toX = (b: number) => (beatToTime(b, project.sync) / totalSec) * chartW;
  const toY = (val: number) =>
    chartH - ((val - valMin) / valSpan) * (chartH * 0.72) - chartH * 0.14;

  const lineD =
    emotionPoints.length > 0
      ? emotionPoints
          .map((p, i) => `${i === 0 ? "M" : "L"} ${toX(p.beat).toFixed(1)} ${toY(p.val).toFixed(1)}`)
          .join(" ")
      : "";

  const playheadX =
    totalSec > 0 ? Math.min(chartW, Math.max(0, (timeSec / totalSec) * chartW)) : 0;

  return { lineD, playheadX };
}

/**
 * 构建指定时间点的完整帧分析数据。
 * @param project 项目数据
 * @param timeSec 当前时间（秒）
 * @param chartW 图表渲染区域宽度
 * @param chartH 图表渲染区域高度
 * @returns 包含当前时间点分析结果的对象
 */
export function buildFrameAnalysis(
  project: MusicAnalysisVideoProject,
  timeSec: number,
  chartW: number,
  chartH: number
): FrameAnalysis {
  const beat = getBeatAtTimeSec(project, timeSec);
  const chord = getActiveChord(project, beat);
  const nextChord = getNextChord(project, beat);
  const activeSection = getActiveSection(project, beat);
  const activeComment = getActiveComment(project, beat);
  const key = keyAtBeat(project, beat);
  const ts = timeSignatureAtBeat(project, beat);
  const totalSec = getContentEndSec(project);
  const { lineD, playheadX } = buildEmotionGeometry(project, timeSec, totalSec, chartW, chartH);
  const barInfo = getBarInfo(project, beat);

  // Extract chords within the current section
  const allChords = flattenEvents(project, (e) => e.type === "chord")
    .map(c => ({ symbol: c.event.value as string, beat: c.beat }));

  const sectionChords = activeSection
    ? allChords
        .filter((c) => {
          const end = activeSection.endBeat ?? Number.POSITIVE_INFINITY;
          return c.beat >= activeSection.startBeat && c.beat < end;
        })
        .map((c) => {
          return {
            symbol: c.symbol,
            beat: c.beat,
            isActive: chord?.beat === c.beat,
          };
        })
    : [];

  return {
    timeSec,
    beat,
    chordSymbol: chord?.symbol ?? "—",
    nextChordSymbol: nextChord?.symbol ?? null,
    sectionLabel: activeSection?.label ?? null,
    sectionComment: activeComment?.value as string ?? null,
    sectionCommentStyle: activeComment?.style ?? null,
    keyLabel: key,
    timeSignatureLabel: `${ts.upper}/${ts.lower}`,
    bpmHint: project.meta.bpmDisplayHint ?? null,
    emotionLinePath: lineD,
    playheadX,
    currentEmotionValue: getEmotionAtBeat(project, beat),
    barNumber: barInfo.barNumber,
    beatInBar: barInfo.beatInBar,
    beatsPerBar: barInfo.beatsPerBar,
    sectionChords,
  };
}
