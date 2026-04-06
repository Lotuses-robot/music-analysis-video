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

export interface TimeSignatureChange extends TimeSignature {
  beat: number;
}

export interface KeyChange {
  beat: number;
  key: string;
}

export interface ProjectSection {
  id: string;
  label: string;
  startBeat: number;
  /** Exclusive; omit for open-ended. */
  endBeat?: number;
  comment?: string;
}

export interface ChordEvent {
  beat: number;
  symbol: string;
}

export interface MelodyPoint {
  beat: number;
  midi: number;
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
  timeSignature: {
    default: TimeSignature;
    changes?: TimeSignatureChange[];
  };
  key: {
    default: string;
    changes?: KeyChange[];
  };
  sections: ProjectSection[];
  chords: ChordEvent[];
  melody: MelodyPoint[];
  style?: ProjectStyle;
  export?: ProjectExportDefaults;
}
