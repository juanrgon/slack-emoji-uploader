// gifenc ships without type declarations; this covers the parts we use.
declare module "gifenc" {
  export type Color = number[];
  export type PixelFormat = "rgb565" | "rgb444" | "rgba4444";

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: { format?: PixelFormat },
  ): Color[];

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Color[],
    format?: PixelFormat,
  ): Uint8Array;

  export interface WriteFrameOptions {
    /** Required on the first frame, where it becomes the global colour table. */
    palette?: Color[];
    transparent?: boolean;
    transparentIndex?: number;
    /** Milliseconds. */
    delay?: number;
    /** -1 plays once, 0 loops forever, n repeats n more times. */
    repeat?: number;
    /** GIF disposal method. */
    dispose?: number;
    colorDepth?: number;
  }

  export interface Encoder {
    writeFrame(index: Uint8Array, width: number, height: number, options?: WriteFrameOptions): void;
    finish(): void;
    bytes(): Uint8Array;
  }

  export function GIFEncoder(options?: { initialCapacity?: number }): Encoder;
}
