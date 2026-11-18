import { decompressFrames, parseGIF } from "gifuct-js";
import { describe, expect, it } from "vitest";
import { createPalette, encodeGif, limitFrames, type AnimatedImage } from "../../src/lib/gif-encode";

type Rgba = [number, number, number, number];

const CLEAR: Rgba = [0, 0, 0, 0];
const RED: Rgba = [255, 0, 0, 255];
const GREEN: Rgba = [0, 255, 0, 255];
const BLUE: Rgba = [0, 0, 255, 255];

/** Builds a frame from one colour per pixel. */
function frame(pixels: Rgba[], delayMs = 100) {
  return { rgba: new Uint8ClampedArray(pixels.flat()), delayMs };
}

function animation(width: number, height: number, frames: ReturnType<typeof frame>[], repeat = 0): AnimatedImage {
  return { width, height, frames, repeat };
}

/**
 * Plays a GIF the way a browser does, honouring each frame's disposal
 * method, and returns what is on screen during every frame.
 */
function play(gif: Uint8Array) {
  const parsed = parseGIF(gif.buffer.slice(gif.byteOffset, gif.byteOffset + gif.byteLength) as ArrayBuffer);
  const { width, height } = parsed.lsd;
  const screen = new Uint8ClampedArray(width * height * 4);
  const frames = decompressFrames(parsed, true).map((patch) => {
    const { left, top, width: patchWidth, height: patchHeight } = patch.dims;
    for (let y = 0; y < patchHeight; y++) {
      for (let x = 0; x < patchWidth; x++) {
        const from = (y * patchWidth + x) * 4;
        if (patch.patch[from + 3] === 0) continue;
        screen.set(patch.patch.subarray(from, from + 4), ((top + y) * width + left + x) * 4);
      }
    }
    const shown = Array.from(screen);
    if (patch.disposalType === 2) screen.fill(0);
    return { delayMs: patch.delay, shown };
  });
  return { width, height, frames };
}

const shown = (pixels: Rgba[]) => pixels.flat();

function encode(image: AnimatedImage, options: { colors?: number; fuzz?: number } = {}): Uint8Array {
  return encodeGif(image, { palette: createPalette(image, options.colors ?? 256), fuzz: options.fuzz });
}

describe("encodeGif", () => {
  it("reproduces opaque frames exactly", () => {
    const frames = [
      [RED, RED, GREEN, GREEN],
      [RED, BLUE, GREEN, GREEN],
      [BLUE, BLUE, BLUE, RED],
    ];
    const played = play(encode(animation(2, 2, frames.map((pixels) => frame(pixels)))));

    expect(played).toMatchObject({ width: 2, height: 2 });
    expect(played.frames.map((f) => f.shown)).toEqual(frames.map(shown));
  });

  it("erases pixels that turn transparent instead of leaving a trail", () => {
    // A dot moving left to right over a transparent background.
    const frames = [
      [RED, CLEAR, CLEAR],
      [CLEAR, RED, CLEAR],
      [CLEAR, CLEAR, RED],
    ];
    const played = play(encode(animation(3, 1, frames.map((pixels) => frame(pixels)))));

    expect(played.frames.map((f) => f.shown)).toEqual(frames.map(shown));
  });

  it("handles a mix of frames that add pixels and frames that remove them", () => {
    const frames = [
      [RED, CLEAR, CLEAR, CLEAR],
      [RED, GREEN, CLEAR, CLEAR],
      [RED, GREEN, BLUE, CLEAR],
      [CLEAR, GREEN, BLUE, RED],
      [CLEAR, GREEN, GREEN, RED],
    ];
    const played = play(encode(animation(4, 1, frames.map((pixels) => frame(pixels)))));

    expect(played.frames.map((f) => f.shown)).toEqual(frames.map(shown));
  });

  it("keeps each frame's timing, with a floor browsers will honour", () => {
    const frames = [frame([RED], 40), frame([GREEN], 250), frame([BLUE], 0)];
    const played = play(encode(animation(1, 1, frames)));

    expect(played.frames.map((f) => f.delayMs)).toEqual([40, 250, 20]);
  });

  it("folds a frame that changes nothing into the one before it", () => {
    const frames = [frame([RED, GREEN], 100), frame([RED, GREEN], 100), frame([BLUE, GREEN], 100)];
    const played = play(encode(animation(2, 1, frames)));

    expect(played.frames.map((f) => f.delayMs)).toEqual([200, 100]);
    expect(played.frames.map((f) => f.shown)).toEqual([shown([RED, GREEN]), shown([BLUE, GREEN])]);
  });

  it("treats mostly transparent pixels as transparent and the rest as solid", () => {
    const played = play(encode(animation(2, 1, [frame([[255, 0, 0, 40], [0, 0, 255, 200]])])));

    expect(played.frames[0]!.shown).toEqual(shown([CLEAR, BLUE]));
  });

  it("encodes a fully transparent image", () => {
    const played = play(encode(animation(2, 1, [frame([CLEAR, CLEAR])])));

    expect(played.frames[0]!.shown).toEqual(shown([CLEAR, CLEAR]));
  });

  it("uses no more colours than asked for", () => {
    // A 16 x 16 image where every pixel is a different colour.
    const pixels: Rgba[] = Array.from({ length: 256 }, (_, i) => [i, 255 - i, (i * 7) % 256, 255]);
    const gif = encode(animation(16, 16, [frame(pixels)]), { colors: 8 });

    const colors = new Set<string>();
    const { shown: result } = play(gif).frames[0]!;
    for (let i = 0; i < result.length; i += 4) colors.add(result.slice(i, i + 3).join());
    expect(colors.size).toBeGreaterThan(1);
    expect(colors.size).toBeLessThanOrEqual(7);
  });

  it("with fuzz, leaves nearly unchanged pixels alone and still redraws real changes", () => {
    const nearlyRed: Rgba = [240, 12, 12, 255];
    const frames = [frame([RED, RED]), frame([nearlyRed, BLUE])];

    const exact = play(encode(animation(2, 1, frames)));
    const fuzzy = play(encode(animation(2, 1, frames), { fuzz: 24 }));

    expect(exact.frames[1]!.shown).toEqual(shown([nearlyRed, BLUE]));
    expect(fuzzy.frames[1]!.shown).toEqual(shown([RED, BLUE]));
  });

  it("writes the loop setting it is given", () => {
    const loopCount = (gif: Uint8Array) => {
      const text = Buffer.from(gif).toString("latin1");
      const at = text.indexOf("NETSCAPE2.0");
      return at < 0 ? null : gif[at + 13]! | (gif[at + 14]! << 8);
    };
    const frames = [frame([RED]), frame([BLUE])];

    expect(loopCount(encode(animation(1, 1, frames, 0)))).toBe(0);
    expect(loopCount(encode(animation(1, 1, frames, 3)))).toBe(3);
    expect(loopCount(encode(animation(1, 1, frames, -1)))).toBeNull();
  });
});

describe("limitFrames", () => {
  it("drops frames evenly and keeps the total running time", () => {
    const frames = Array.from({ length: 10 }, (_, i) => frame([[i * 20, 0, 0, 255]], 50));
    const limited = limitFrames(animation(1, 1, frames), 5);

    expect(limited.frames.map((f) => f.rgba[0])).toEqual([0, 40, 80, 120, 160]);
    expect(limited.frames.map((f) => f.delayMs)).toEqual([100, 100, 100, 100, 100]);
  });

  it("returns the animation untouched when it is short enough", () => {
    const image = animation(1, 1, [frame([RED]), frame([BLUE])]);
    expect(limitFrames(image, 50)).toBe(image);
  });
});
