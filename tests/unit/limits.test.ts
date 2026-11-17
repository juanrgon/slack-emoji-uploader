import { describe, expect, it } from "vitest";
import { fitWithin, mergeDelays, pickFrames, scaleToSide } from "../../src/lib/limits";

describe("fitWithin", () => {
  it("shrinks the longest side to the limit and keeps the proportions", () => {
    expect(fitWithin({ width: 1000, height: 600 }, 128)).toEqual({ width: 128, height: 77 });
    expect(fitWithin({ width: 300, height: 900 }, 128)).toEqual({ width: 43, height: 128 });
  });

  it("never enlarges an image", () => {
    expect(fitWithin({ width: 64, height: 32 }, 128)).toEqual({ width: 64, height: 32 });
  });

  it("keeps very thin images at least one pixel wide", () => {
    expect(fitWithin({ width: 2, height: 2000 }, 128)).toEqual({ width: 1, height: 128 });
  });
});

describe("scaleToSide", () => {
  it("enlarges as well as shrinks", () => {
    expect(scaleToSide({ width: 24, height: 12 }, 128)).toEqual({ width: 128, height: 64 });
  });
});

describe("pickFrames", () => {
  it("keeps every frame when there are few enough", () => {
    expect(pickFrames(4, 50)).toEqual([0, 1, 2, 3]);
  });

  it("spreads the kept frames evenly, starting with the first", () => {
    expect(pickFrames(10, 5)).toEqual([0, 2, 4, 6, 8]);
    expect(pickFrames(120, 50)).toHaveLength(50);
    expect(pickFrames(7, 3)).toEqual([0, 2, 4]);
  });
});

describe("mergeDelays", () => {
  it("adds the time of dropped frames to the kept frame before them", () => {
    const delays = [10, 20, 30, 40, 50, 60, 70];
    const merged = mergeDelays(delays, [0, 2, 4]);
    expect(merged).toEqual([30, 70, 180]);
    expect(merged.reduce((a, b) => a + b)).toBe(delays.reduce((a, b) => a + b));
  });
});
