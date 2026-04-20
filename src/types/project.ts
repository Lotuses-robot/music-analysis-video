/**
 * TypeScript mirror of schemas/project.schema.json.
 * Keep in sync when bumping schemaVersion or adding fields.
 */

export type SyncExtrapolation = "clamp" | "extend";

export interface SyncAnchor {
  /** Musical beat from project origin (fractional beats allowed). */
  beat: number;
  /** Time in seconds on the (trimmed) audio timeline. */
  timeSec: number;
}

export interface ProjectSync {
  anchors: SyncAnchor[];
  /** Default in schema: clamp. */
  extrapolation?: SyncExtrapolation;
}

export interface TimeSignature {
  upper: number;
  lower: number;
}

export interface MeasureEvent {
  /** Beat offset relative to the start of this measure (0 to TS.upper). */
  beatOffset: number;
  /** Type of event. */
  type: "chord" | "key_change" | "bpm_change" | "comment" | "emotion" | "section";
  /** Value of the event (chord symbol, key string, bpm number, emotion value, etc.). */
  value: string | number;
  /** Visual style overrides for this event. */
  style?: {
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    bold?: boolean;
    italic?: boolean;
  };
}

export interface ProjectSection {
  id: string;
  label: string;
  comment?: string;
}

export interface ProjectMeasure {
  /** 1-indexed bar number. */
  index: number;
  /** Musical time signature for this measure. */
  timeSignature: TimeSignature;
  /** Events occurring within this measure. */
  events: MeasureEvent[];
}

export interface ProjectStyle {
  themeId?: string;
  primaryColor?: string;
  secondaryColor?: string;
  footerText?: string;
}

export interface ProjectExportDefaults {
  fps?: 24 | 25 | 30 | 60;
  defaultComposition?: "9:16" | "16:9";
  /** Output file name base (without extension). */
  outputName?: string;
  /** Quality level (CRF for H.264), typically 0-51 (23 is default). */
  crf?: number;
  /** Audio bitrate in kbps (e.g., 128, 192, 256). */
  audioBitrate?: number;
  /** Pixel format (e.g., "yuv420p"). */
  pixelFormat?: "yuv420p" | "yuv422p" | "yuv444p";
}

export interface ProjectMeta {
  title: string;
  artist?: string;
  audioPath: string;
  audioStartOffsetSec?: number;
  /** UI-only; anchors are authoritative for timing. */
  bpmDisplayHint?: number;
}

export interface MusicAnalysisVideoProject {
  schemaVersion: string;
  meta: ProjectMeta;
  sync: ProjectSync;
  /** Key/Scale used globally or as a starting point. */
  key: {
    default: string;
  };
  /** Measures are the primary organizational unit. */
  measures: ProjectMeasure[];
  style?: ProjectStyle;
  export?: ProjectExportDefaults;
}
