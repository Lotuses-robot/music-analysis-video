/**
 * TypeScript mirror of schemas/project.schema.json.
 * Keep in sync when bumping schemaVersion or adding fields.
 */

/**
 * 同步插值方式。
 * "clamp": 限制在锚点范围内；
 * "extend": 根据最后两个锚点的速率进行线性扩展。
 */
export type SyncExtrapolation = "clamp" | "extend";

/**
 * 同步锚点，用于将音乐拍数映射到视频时间。
 */
export interface SyncAnchor {
  /** 从项目起点开始的音乐拍数（允许分数值）。 */
  beat: number;
  /** 在（裁剪后的）音频时间轴上的时间（秒）。 */
  timeSec: number;
}

/**
 * 项目同步配置。
 */
export interface ProjectSync {
  /** 时间与拍数的同步锚点列表。 */
  anchors: SyncAnchor[];
  /** 默认插值方式：clamp。 */
  extrapolation?: SyncExtrapolation;
}

/**
 * 拍号定义。
 */
export interface TimeSignature {
  /** 分子（每小节拍数）。 */
  upper: number;
  /** 分母（拍子的单位音符）。 */
  lower: number;
}

/**
 * 小节内的事件定义（如和弦、调性变化、BPM 变化等）。
 */
export interface MeasureEvent {
  /** 相对于该小节开始的拍数偏移（0 到 TS.upper 之间）。 */
  beatOffset: number;
  /** 事件类型。 */
  type: "chord" | "key_change" | "bpm_change" | "comment" | "emotion" | "section";
  /** 事件的值（和弦符号、调性字符串、BPM 数值、情感值等）。 */
  value: string | number;
  /** 事件的视觉样式覆盖。 */
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
  };
}

/**
 * 项目章节定义。
 */
export interface ProjectSection {
  /** 章节唯一 ID。 */
  id: string;
  /** 章节标签。 */
  label: string;
  /** 章节备注。 */
  comment?: string;
}

/**
 * 项目小节数据。
 */
export interface ProjectMeasure {
  /** 小节序号（从 1 开始）。 */
  index: number;
  /** 该小节的音乐拍号。 */
  timeSignature: TimeSignature;
  /** 该小节内发生的事件列表。 */
  events: MeasureEvent[];
}

/**
 * 项目视觉样式配置。
 */
export interface ProjectStyle {
  /** 使用的主题 ID。 */
  themeId?: string;
  /** 主色调。 */
  primaryColor?: string;
  /** 次色调。 */
  secondaryColor?: string;
  /** 页脚文本。 */
  footerText?: string;
}

/**
 * 项目导出默认设置。
 */
export interface ProjectExportDefaults {
  /** 导出帧率。 */
  fps?: 24 | 25 | 30 | 60;
  /** 默认合成比例。 */
  defaultComposition?: "9:16" | "16:9";
  /** 输出文件名基础（不含扩展名）。 */
  outputName?: string;
  /** 质量级别 (H.264 的 CRF)，通常为 0-51（默认 23）。 */
  crf?: number;
  /** 音频码率 (kbps)。 */
  audioBitrate?: number;
  /** 像素格式。 */
  pixelFormat?: "yuv420p" | "yuv422p" | "yuv444p";
}

/**
 * 项目元数据信息。
 */
export interface ProjectMeta {
  /** 视频标题。 */
  title: string;
  /** 艺术家/创作者名称。 */
  artist?: string;
  /** 音频文件路径或 URL。 */
  audioPath: string;
  /** 音频开始偏移量（秒）。 */
  audioStartOffsetSec?: number;
  /** 仅用于 UI 显示的 BPM 提示；同步锚点才是计时的权威依据。 */
  bpmDisplayHint?: number;
}

/**
 * 音乐分析视频项目完整数据结构。
 */
export interface MusicAnalysisVideoProject {
  /** Schema 版本号。 */
  schemaVersion: string;
  /** 项目元数据。 */
  meta: ProjectMeta;
  /** 时间同步配置。 */
  sync: ProjectSync;
  /** 全局或起始调性。 */
  key: {
    default: string;
  };
  /** 小节列表，作为主要的组织单元。 */
  measures: ProjectMeasure[];
  /** 视觉样式设置。 */
  style?: ProjectStyle;
  /** 导出设置。 */
  export?: ProjectExportDefaults;
}
