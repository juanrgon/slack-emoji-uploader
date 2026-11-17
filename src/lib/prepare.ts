// Turns any image the browser can read into a file Slack accepts as an emoji.
// Everything here runs locally in an extension page; nothing is sent to a server.

import { createPalette, encodeGif, limitFrames, type AnimatedImage, type Palette } from "./gif-encode";
import { MAX_BYTES, MAX_FRAMES, MAX_SIDE, fitWithin, mergeDelays, pickFrames, scaleToSide, type Size } from "./limits";

export interface PreparedEmoji {
  blob: Blob;
  width: number;
  height: number;
  /** 1 for a still image. */
  frameCount: number;
  /** False when the original file already met Slack's limits and is used as is. */
  changed: boolean;
  source: Size & { bytes: number; frameCount: number };
}

/** An error whose message is written to be shown to the person adding the emoji. */
export class ImageError extends Error {}

export type Progress = (message: string) => void;

interface SourceFile {
  bytes: Uint8Array<ArrayBuffer>;
  type: string;
}

/** Formats Slack takes as they are. Anything else is converted to PNG or GIF. */
const SLACK_FORMATS = new Set(["image/png", "image/jpeg", "image/gif"]);

/**
 * Settings to try, best looking first, until the GIF fits under Slack's size
 * cap. Emoji are shown far smaller than 128 px, so pixels go before frames:
 * a smaller animation is hard to notice, a choppier one is not.
 */
const GIF_ATTEMPTS: ReadonlyArray<{ side: number; frames: number; colors: number; fuzz: number }> = [
  { side: 128, frames: 50, colors: 256, fuzz: 0 },
  { side: 128, frames: 50, colors: 256, fuzz: 8 },
  { side: 128, frames: 50, colors: 128, fuzz: 12 },
  { side: 112, frames: 50, colors: 128, fuzz: 12 },
  { side: 96, frames: 50, colors: 128, fuzz: 12 },
  { side: 96, frames: 50, colors: 64, fuzz: 16 },
  { side: 80, frames: 50, colors: 64, fuzz: 16 },
  { side: 96, frames: 25, colors: 64, fuzz: 16 },
  { side: 64, frames: 50, colors: 64, fuzz: 16 },
  { side: 80, frames: 25, colors: 64, fuzz: 16 },
  { side: 64, frames: 25, colors: 64, fuzz: 16 },
  { side: 64, frames: 25, colors: 32, fuzz: 20 },
  { side: 48, frames: 25, colors: 32, fuzz: 20 },
  { side: 64, frames: 12, colors: 32, fuzz: 20 },
  { side: 48, frames: 12, colors: 32, fuzz: 20 },
  { side: 32, frames: 12, colors: 16, fuzz: 24 },
];

const STILL_SIDES = [128, 112, 96, 80, 64, 48, 32];

export async function prepareEmoji(imageUrl: string, onProgress: Progress = () => {}): Promise<PreparedEmoji> {
  onProgress("Loading image…");
  const source = await loadSource(imageUrl);
  const animation = await decodeAnimation(source, onProgress);
  return animation ? prepareAnimated(source, animation, onProgress) : prepareStill(source);
}

async function loadSource(imageUrl: string): Promise<SourceFile> {
  let buffer: ArrayBuffer;
  let contentType: string;
  try {
    if (imageUrl.startsWith("file:")) {
      ({ buffer, contentType } = await readLocalFile(imageUrl));
    } else {
      // Send cookies so images that need a login load the way they did on the page.
      const response = await fetch(imageUrl, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      buffer = await response.arrayBuffer();
      contentType = response.headers.get("content-type") ?? "";
    }
  } catch (cause) {
    throw new ImageError("Couldn't download this image.", { cause });
  }
  const bytes = new Uint8Array(buffer);
  return { bytes, type: sniffType(bytes) ?? contentType.split(";")[0]!.trim().toLowerCase() };
}

/** fetch() refuses file: URLs, but XMLHttpRequest reads them when the extension is allowed file access. */
function readLocalFile(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("GET", url);
    request.responseType = "arraybuffer";
    request.onload = () => resolve({ buffer: request.response as ArrayBuffer, contentType: "" });
    request.onerror = () => reject(new Error("Could not read local file"));
    request.send();
  });
}

/** Identifies an image by its first bytes, which is more reliable than what servers claim. */
export function sniffType(bytes: Uint8Array): string | null {
  const ascii = (start: number, length: number) => String.fromCharCode(...bytes.subarray(start, start + length));
  if (ascii(0, 4) === "GIF8") return "image/gif";
  if (ascii(0, 4) === "\x89PNG") return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "image/webp";
  if (ascii(4, 4) === "ftyp" && ascii(8, 3) === "avi") return "image/avif";
  if (/^\s*<(\?xml|!doctype svg|svg)/i.test(ascii(bytes[0] === 0xef ? 3 : 0, 256))) return "image/svg+xml";
  return null;
}

interface DecodedAnimation {
  /** Already scaled to fit MAX_SIDE and thinned to MAX_FRAMES. */
  image: AnimatedImage;
  sourceSize: Size;
  sourceFrameCount: number;
}

/** Reads every frame of an animated image. Resolves to null for stills and formats without animation. */
async function decodeAnimation(source: SourceFile, onProgress: Progress): Promise<DecodedAnimation | null> {
  if (typeof ImageDecoder === "undefined" || !(await ImageDecoder.isTypeSupported(source.type))) return null;

  const decoder = new ImageDecoder({ data: source.bytes, type: source.type, preferAnimation: true });
  try {
    // The frame count is only final once the whole file has been parsed.
    await Promise.all([decoder.tracks.ready, decoder.completed]);
    const track = decoder.tracks.selectedTrack;
    if (!track?.animated || track.frameCount < 2) return null;

    // Durations are only known once a frame is decoded, so every frame is
    // decoded, but only the ones being kept are drawn and held in memory.
    const kept = new Set(pickFrames(track.frameCount, MAX_FRAMES));
    const delays: number[] = [];
    const pixels: Uint8ClampedArray[] = [];
    let sourceSize: Size | undefined;
    let size: Size | undefined;
    let context: OffscreenCanvasRenderingContext2D | undefined;

    for (let index = 0; index < track.frameCount; index++) {
      if (index % 10 === 0) onProgress(`Reading frame ${index + 1} of ${track.frameCount}…`);
      const { image: frame } = await decoder.decode({ frameIndex: index });
      try {
        delays.push(frameDelay(frame.duration));
        if (!kept.has(index)) continue;
        sourceSize ??= { width: frame.displayWidth, height: frame.displayHeight };
        size ??= fitWithin(sourceSize, MAX_SIDE);
        context ??= createContext(size);
        context.clearRect(0, 0, size.width, size.height);
        context.drawImage(frame, 0, 0, size.width, size.height);
        pixels.push(context.getImageData(0, 0, size.width, size.height).data);
      } finally {
        frame.close();
      }
    }
    if (!sourceSize || !size) return null;

    const keptDelays = mergeDelays(delays, [...kept]);
    const repeat = track.repetitionCount;
    return {
      image: {
        ...size,
        frames: pixels.map((rgba, i) => ({ rgba, delayMs: keptDelays[i]! })),
        repeat: repeat === Infinity ? 0 : repeat === 0 ? -1 : repeat,
      },
      sourceSize,
      sourceFrameCount: track.frameCount,
    };
  } catch (cause) {
    throw new ImageError("Couldn't read this image. The file may be damaged.", { cause });
  } finally {
    decoder.close();
  }
}

/** Frame duration in milliseconds, given microseconds. Browsers show very short frames for 100 ms. */
function frameDelay(durationMicros: number | null): number {
  const ms = Math.round((durationMicros ?? 0) / 1000);
  return ms < 20 ? 100 : ms;
}

async function prepareAnimated(
  source: SourceFile,
  { image, sourceSize, sourceFrameCount }: DecodedAnimation,
  onProgress: Progress,
): Promise<PreparedEmoji> {
  const sourceInfo = { ...sourceSize, bytes: source.bytes.length, frameCount: sourceFrameCount };
  const fitsAlready =
    source.type === "image/gif" &&
    Math.max(sourceSize.width, sourceSize.height) <= MAX_SIDE &&
    sourceFrameCount <= MAX_FRAMES &&
    source.bytes.length <= MAX_BYTES;
  if (fitsAlready) {
    return {
      blob: new Blob([source.bytes], { type: "image/gif" }),
      ...sourceSize,
      frameCount: sourceFrameCount,
      changed: false,
      source: sourceInfo,
    };
  }

  // Choosing a palette is the slow part of encoding, and the colours don't
  // change when frames are dropped or scaled, so choose once per palette size.
  const palettes = new Map<number, Palette>();
  const paletteOf = (colors: number): Palette => {
    const palette = palettes.get(colors) ?? createPalette(image, colors);
    palettes.set(colors, palette);
    return palette;
  };

  let lastTried = "";
  for (const attempt of GIF_ATTEMPTS) {
    const candidate = scaleAnimation(limitFrames(image, attempt.frames), attempt.side);
    // Short or small animations make several attempts identical; skip the repeats.
    const tried = [candidate.width, candidate.height, candidate.frames.length, attempt.colors, attempt.fuzz].join();
    if (tried === lastTried) continue;
    lastTried = tried;

    onProgress("Shrinking to fit Slack's size limit…");
    await nextTask();
    const bytes = encodeGif(candidate, { palette: paletteOf(attempt.colors), fuzz: attempt.fuzz });
    if (bytes.length <= MAX_BYTES) {
      return {
        blob: new Blob([bytes as Uint8Array<ArrayBuffer>], { type: "image/gif" }),
        width: candidate.width,
        height: candidate.height,
        frameCount: candidate.frames.length,
        changed: true,
        source: sourceInfo,
      };
    }
  }
  throw new ImageError("This animation is too detailed to fit in Slack's 128 KB emoji limit.");
}

async function prepareStill(source: SourceFile): Promise<PreparedEmoji> {
  const picture = await loadPicture(source);
  // An SVG without a size of its own reports 0; draw it as large as an emoji gets.
  const sourceSize: Size = {
    width: picture.naturalWidth || MAX_SIDE,
    height: picture.naturalHeight || MAX_SIDE,
  };
  const sourceInfo = { ...sourceSize, bytes: source.bytes.length, frameCount: 1 };

  const fitsAlready =
    SLACK_FORMATS.has(source.type) &&
    Math.max(sourceSize.width, sourceSize.height) <= MAX_SIDE &&
    source.bytes.length <= MAX_BYTES;
  if (fitsAlready) {
    return {
      blob: new Blob([source.bytes], { type: source.type }),
      ...sourceSize,
      frameCount: 1,
      changed: false,
      source: sourceInfo,
    };
  }

  // A 128 px PNG is almost always far below the cap; smaller sizes are a fallback for noisy images.
  // Vector images have no real pixel size, so they are drawn as large as an emoji gets.
  const isVector = source.type === "image/svg+xml";
  for (const side of STILL_SIDES) {
    const size = isVector ? scaleToSide(sourceSize, side) : fitWithin(sourceSize, side);
    const context = createContext(size);
    context.drawImage(picture, 0, 0, size.width, size.height);
    const blob = await context.canvas.convertToBlob({ type: "image/png" });
    if (blob.size <= MAX_BYTES) {
      return { blob, ...size, frameCount: 1, changed: true, source: sourceInfo };
    }
  }
  throw new ImageError("This image is too detailed to fit in Slack's 128 KB emoji limit.");
}

async function loadPicture(source: SourceFile): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(new Blob([source.bytes], { type: source.type }));
  try {
    const picture = new Image();
    picture.src = url;
    await picture.decode();
    return picture;
  } catch (cause) {
    throw new ImageError("This doesn't look like an image Chrome can read.", { cause });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Resamples every frame so the longest side is at most `maxSide`. */
function scaleAnimation(image: AnimatedImage, maxSide: number): AnimatedImage {
  const size = fitWithin(image, maxSide);
  if (size.width === image.width && size.height === image.height) return image;

  const from = createContext(image);
  const to = createContext(size);
  const frames = image.frames.map(({ rgba, delayMs }) => {
    from.putImageData(new ImageData(rgba as Uint8ClampedArray<ArrayBuffer>, image.width, image.height), 0, 0);
    to.clearRect(0, 0, size.width, size.height);
    to.drawImage(from.canvas, 0, 0, size.width, size.height);
    return { rgba: to.getImageData(0, 0, size.width, size.height).data, delayMs };
  });
  return { ...image, ...size, frames };
}

function createContext(size: Size): OffscreenCanvasRenderingContext2D {
  const context = new OffscreenCanvas(size.width, size.height).getContext("2d", { willReadFrequently: true });
  if (!context) throw new ImageError("Couldn't create a canvas to resize the image.");
  context.imageSmoothingQuality = "high";
  return context;
}

/** Lets the page repaint between encoding attempts so progress text stays live. */
function nextTask(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve));
}
