import type { ProjectSync, SyncAnchor } from "../types/project";

function sortedAnchors(anchors: readonly SyncAnchor[]): SyncAnchor[] {
  return [...anchors].sort((a, b) => a.beat - b.beat);
}

function extrapolationMode(sync: ProjectSync): NonNullable<ProjectSync["extrapolation"]> {
  return sync.extrapolation ?? "clamp";
}

/**
 * Map musical beat to audio time using piecewise-linear anchors.
 * Requires at least one anchor; two or more recommended for meaningful tempo shape.
 * @param beat
 * @param sync
 */
export function beatToTime(beat: number, sync: ProjectSync): number {
  const mode = extrapolationMode(sync);
  const a = sortedAnchors(sync.anchors);
  if (a.length === 0) {
    throw new Error("sync.anchors must contain at least one point");
  }
  if (a.length === 1) {
    return a[0].timeSec;
  }

  if (beat <= a[0].beat) {
    if (mode === "clamp") return a[0].timeSec;
    const slope = (a[1].timeSec - a[0].timeSec) / (a[1].beat - a[0].beat);
    return a[0].timeSec + (beat - a[0].beat) * slope;
  }

  const last = a[a.length - 1];
  if (beat >= last.beat) {
    if (mode === "clamp") return last.timeSec;
    const prev = a[a.length - 2];
    const slope = (last.timeSec - prev.timeSec) / (last.beat - prev.beat);
    return last.timeSec + (beat - last.beat) * slope;
  }

  for (let i = 0; i < a.length - 1; i++) {
    const left = a[i];
    const right = a[i + 1];
    if (beat >= left.beat && beat <= right.beat) {
      if (right.beat === left.beat) return left.timeSec;
      const t =
        left.timeSec + ((beat - left.beat) / (right.beat - left.beat)) * (right.timeSec - left.timeSec);
      return t;
    }
  }

  return last.timeSec;
}

/**
 * Inverse of beatToTime for the same anchor set (piecewise linear).
 * If multiple beats share the same timeSec, the first matching segment wins.
 * @param timeSec
 * @param sync
 */
export function timeToBeat(timeSec: number, sync: ProjectSync): number {
  const mode = extrapolationMode(sync);
  const a = sortedAnchors(sync.anchors);
  if (a.length === 0) {
    throw new Error("sync.anchors must contain at least one point");
  }
  if (a.length === 1) {
    return a[0].beat;
  }

  if (timeSec <= a[0].timeSec) {
    if (mode === "clamp") return a[0].beat;
    const slope = (a[1].beat - a[0].beat) / (a[1].timeSec - a[0].timeSec);
    return a[0].beat + (timeSec - a[0].timeSec) * slope;
  }

  const last = a[a.length - 1];
  if (timeSec >= last.timeSec) {
    if (mode === "clamp") return last.beat;
    const prev = a[a.length - 2];
    const slope = (last.beat - prev.beat) / (last.timeSec - prev.timeSec);
    return last.beat + (timeSec - last.timeSec) * slope;
  }

  for (let i = 0; i < a.length - 1; i++) {
    const left = a[i];
    const right = a[i + 1];
    if (timeSec >= left.timeSec && timeSec <= right.timeSec) {
      if (right.timeSec === left.timeSec) return left.beat;
      return left.beat + ((timeSec - left.timeSec) / (right.timeSec - left.timeSec)) * (right.beat - left.beat);
    }
  }

  return last.beat;
}

/**
 *
 * @param beat
 * @param sync
 * @param fps
 */
export function beatToFrame(beat: number, sync: ProjectSync, fps: number): number {
  return Math.round(beatToTime(beat, sync) * fps);
}
