// What Slack accepts for a custom emoji.

/** Longest side, in pixels. */
export const MAX_SIDE = 128;
/** Slack documents the cap as 128 KB; staying under 128,000 bytes is safe whichever kilobyte it means. */
export const MAX_BYTES = 128_000;
/** Animated emoji with more frames than this are rejected. */
export const MAX_FRAMES = 50;

export interface Size {
  width: number;
  height: number;
}

/** Scales a size, up or down, so its longest side is exactly `side`. */
export function scaleToSide(size: Size, side: number): Size {
  const scale = side / Math.max(size.width, size.height);
  return {
    width: Math.max(1, Math.round(size.width * scale)),
    height: Math.max(1, Math.round(size.height * scale)),
  };
}

/** Scales a size down so its longest side is at most `maxSide`. Never scales up. */
export function fitWithin(size: Size, maxSide: number): Size {
  if (Math.max(size.width, size.height) <= maxSide) return { width: size.width, height: size.height };
  return scaleToSide(size, maxSide);
}

/** Picks at most `max` evenly spaced frame indexes out of `count`, always starting with the first. */
export function pickFrames(count: number, max: number): number[] {
  const kept = Math.min(count, Math.max(1, max));
  return Array.from({ length: kept }, (_, i) => Math.floor((i * count) / kept));
}

/**
 * Gives each kept frame the screen time of the frames dropped after it, so
 * an animation keeps its total duration when frames are removed.
 */
export function mergeDelays(delays: readonly number[], kept: readonly number[]): number[] {
  return kept.map((start, i) => {
    const end = kept[i + 1] ?? delays.length;
    let total = 0;
    for (let frame = start; frame < end; frame++) total += delays[frame] ?? 0;
    return total;
  });
}
