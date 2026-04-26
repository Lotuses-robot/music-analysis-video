import type { MusicAnalysisVideoProject } from "../types/project";
import { beatToTime } from "../sync/beatTime";
import { flattenEvents } from "./selectors";

/** Extra seconds after the last musical event. */
export const TAIL_SEC = 2;

/**
 * 收集项目中所有可能的“内容结束”拍数点。
 * 包括所有同步锚点、所有事件所在的拍数以及所有小节的总长度。
 * @param project 项目数据
 * @returns 拍数候选值数组
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
 * 获取项目中最后一个有内容（锚点、事件或小节结束）的绝对拍数。
 * @param project 项目数据
 * @returns 最后一个内容点的绝对拍数
 */
export function getLastContentBeat(project: MusicAnalysisVideoProject): number {
  const beats = collectBeatCandidates(project);
  return beats.length === 0 ? 0 : Math.max(0, ...beats);
}

/**
 * 获取时间轴在同步时钟下的总秒数（不包含结尾留白）。
 * 同时考虑乐谱内容时长与音频元数据时长。
 * @param project 项目数据
 * @returns 同步后的总时长（秒）
 */
export function getSyncedEndSec(project: MusicAnalysisVideoProject): number {
  const beatTime = beatToTime(getLastContentBeat(project), project.sync);
  const audioFileDuration = project.meta.duration || 0;
  const audioOffset = project.meta.audioStartOffsetSec || 0;
  
  // 实际在时间轴上可用的音频时长 = 总时长 - 起始偏移
  const availableAudioDuration = Math.max(0, audioFileDuration - audioOffset);
  
  // 取乐谱内容时长与可用音频时长的最大值，确保两者都能完整显示
  return Math.max(beatTime, availableAudioDuration);
}

/**
 * 获取项目的完整视频总时长（包含结尾留白）。
 * @param project 项目数据
 * @returns 视频总时长（秒）
 */
export function getContentEndSec(project: MusicAnalysisVideoProject): number {
  return getSyncedEndSec(project) + TAIL_SEC;
}

/**
 * 获取项目定义的导出帧率。
 * @param project 项目数据
 * @returns 帧率 (FPS)
 */
export function getFps(project: MusicAnalysisVideoProject): number {
  return project.export?.fps ?? 30;
}
