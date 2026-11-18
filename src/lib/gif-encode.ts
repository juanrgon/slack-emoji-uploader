import { GIFEncoder, applyPalette, quantize } from "gifenc";
import { mergeDelays, pickFrames } from "./limits";

export interface ImageFrame {
  /** Full-canvas RGBA pixels, width * height * 4 bytes. */
  rgba: Uint8ClampedArray;
  delayMs: number;
}

export interface AnimatedImage {
  width: number;
  height: number;
  frames: ImageFrame[];
  /** As in the GIF format: 0 loops forever, -1 plays once, n repeats n more times. */
  repeat: number;
}

/** Opaque colours as [red, green, blue]. At most 255, leaving room for the transparent entry. */
export type Palette = number[][];

export interface EncodeOptions {
  palette: Palette;
  /**
   * How far (as an RGB distance) a pixel may drift from what is already on
   * screen before it gets redrawn. 0 redraws every pixel that changes; higher
   * values trade a little accuracy for a smaller file.
   */
  fuzz?: number;
}

/** GIF has one-bit transparency: pixels below this alpha become fully transparent. */
const ALPHA_CUTOFF = 128;
/** Browsers play frames faster than this at 100 ms instead, so never emit one. */
const MIN_DELAY_MS = 20;
/**
 * Picking a palette gets slow with many distinct colours. Past this many,
 * colours are grouped more coarsely first, which photos and noise hide well.
 */
const FINE_COLOR_LIMIT = 4096;

const KEEP = 1;
const CLEAR = 2;

interface EncodedFrame {
  indexes: Uint8Array;
  delayMs: number;
  dispose: typeof KEEP | typeof CLEAR;
}

/**
 * Chooses the colours that best represent every frame of an animation.
 * `colors` is the size of the GIF colour table, 2 to 256; one entry of it is
 * reserved for transparency.
 */
export function createPalette(image: AnimatedImage, colors: number): Palette {
  const maxColors = Math.min(256, Math.max(2, colors)) - 1;

  let opaqueCount = 0;
  for (const { rgba } of image.frames) {
    for (let i = 3; i < rgba.length; i += 4) {
      if (rgba[i]! >= ALPHA_CUTOFF) opaqueCount++;
    }
  }
  // An image with nothing visible still needs one colour to be a valid GIF.
  if (opaqueCount === 0) return [[0, 0, 0]];

  const opaque = new Uint8Array(opaqueCount * 4);
  const seen = new Uint8Array(1 << 16);
  let distinct = 0;
  let offset = 0;
  for (const { rgba } of image.frames) {
    for (let i = 0; i < rgba.length; i += 4) {
      if (rgba[i + 3]! < ALPHA_CUTOFF) continue;
      const red = rgba[i]!;
      const green = rgba[i + 1]!;
      const blue = rgba[i + 2]!;
      opaque[offset] = red;
      opaque[offset + 1] = green;
      opaque[offset + 2] = blue;
      opaque[offset + 3] = 255;
      offset += 4;

      const bucket = ((red >> 3) << 11) | ((green >> 2) << 5) | (blue >> 3);
      if (seen[bucket] === 0) {
        seen[bucket] = 1;
        distinct++;
      }
    }
  }
  return quantize(opaque, maxColors, { format: distinct > FINE_COLOR_LIMIT ? "rgb444" : "rgb565" });
}

/**
 * Encodes frames as a GIF with one shared palette. Frames after the first
 * only store the pixels that changed, which is where most of the size goes
 * for typical animations.
 */
export function encodeGif(image: AnimatedImage, { palette, fuzz = 0 }: EncodeOptions): Uint8Array {
  const { width, height, frames } = image;
  const [first, ...rest] = indexFrames(image, palette);
  if (!first) throw new Error("Cannot encode an animation with no frames");

  const pixelCount = width * height;
  const transparent = palette.length;
  const fuzzSquared = fuzz ** 2;

  // `screen` tracks the palette index showing at each pixel after the frames
  // written so far, which is what the next frame gets compared against.
  let screen = first;
  const encoded: EncodedFrame[] = [{ indexes: first.slice(), delayMs: frames[0]!.delayMs, dispose: KEEP }];

  rest.forEach((next, i) => {
    const { rgba, delayMs } = frames[i + 1]!;
    const previous = encoded[encoded.length - 1]!;

    // A GIF frame can paint over pixels but not erase them. If this frame is
    // see-through somewhere the screen is not, wipe the screen first and
    // store the frame whole.
    if (erasesPixels(screen, next, transparent)) {
      previous.dispose = CLEAR;
      encoded.push({ indexes: next.slice(), delayMs, dispose: KEEP });
      screen = next;
      return;
    }

    const delta = new Uint8Array(pixelCount).fill(transparent);
    let changed = 0;
    for (let p = 0; p < pixelCount; p++) {
      const wanted = next[p]!;
      const shown = screen[p]!;
      if (wanted === transparent || wanted === shown) continue;
      if (shown !== transparent && fuzzSquared > 0) {
        const color = palette[shown]!;
        const dr = rgba[p * 4]! - color[0]!;
        const dg = rgba[p * 4 + 1]! - color[1]!;
        const db = rgba[p * 4 + 2]! - color[2]!;
        if (dr * dr + dg * dg + db * db <= fuzzSquared) continue;
      }
      delta[p] = wanted;
      screen[p] = wanted;
      changed++;
    }

    if (changed === 0) {
      previous.delayMs += delayMs;
    } else {
      encoded.push({ indexes: delta, delayMs, dispose: KEEP });
    }
  });

  // When the animation loops, the first frame is drawn over the last. If the
  // first frame has see-through pixels the last one has to be wiped first.
  if (encoded[0]!.indexes.includes(transparent)) {
    encoded[encoded.length - 1]!.dispose = CLEAR;
  }

  const gif = GIFEncoder();
  const colorTable = [...palette, [0, 0, 0]];
  const colorDepth = Math.max(2, Math.ceil(Math.log2(colorTable.length)));
  encoded.forEach((frame, i) => {
    gif.writeFrame(frame.indexes, width, height, {
      palette: i === 0 ? colorTable : undefined,
      repeat: image.repeat,
      delay: Math.max(MIN_DELAY_MS, frame.delayMs),
      transparent: frame.indexes.includes(transparent),
      transparentIndex: transparent,
      dispose: frame.dispose,
      colorDepth,
    });
  });
  gif.finish();
  return gif.bytes();
}

/** Drops frames evenly until at most `maxFrames` remain, keeping the total duration. */
export function limitFrames(image: AnimatedImage, maxFrames: number): AnimatedImage {
  if (image.frames.length <= maxFrames) return image;
  const kept = pickFrames(image.frames.length, maxFrames);
  const delays = mergeDelays(
    image.frames.map((frame) => frame.delayMs),
    kept,
  );
  return {
    ...image,
    frames: kept.map((index, i) => ({ rgba: image.frames[index]!.rgba, delayMs: delays[i]! })),
  };
}

/**
 * Maps every frame's pixels to palette indexes, using the index one past the
 * end of the palette for see-through pixels.
 */
function indexFrames({ width, height, frames }: AnimatedImage, palette: Palette): Uint8Array[] {
  // All frames go through the colour matcher in one call so that it only
  // has to work out the nearest palette entry for each colour once.
  const frameBytes = width * height * 4;
  const pixels = new Uint8Array(frameBytes * frames.length);
  frames.forEach(({ rgba }, i) => pixels.set(rgba, i * frameBytes));

  const indexes = applyPalette(pixels, palette, "rgb565");
  const transparent = palette.length;
  for (let p = 0; p < indexes.length; p++) {
    if (pixels[p * 4 + 3]! < ALPHA_CUTOFF) indexes[p] = transparent;
  }
  return frames.map((_, i) => indexes.subarray(i * width * height, (i + 1) * width * height));
}

function erasesPixels(screen: Uint8Array, next: Uint8Array, transparent: number): boolean {
  for (let p = 0; p < next.length; p++) {
    if (next[p] === transparent && screen[p] !== transparent) return true;
  }
  return false;
}
