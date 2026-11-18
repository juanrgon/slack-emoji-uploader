import { describe, expect, it } from "vitest";
import { sniffType } from "../../src/lib/prepare";

const bytes = (text: string) => Uint8Array.from(text, (character) => character.charCodeAt(0));

describe("sniffType", () => {
  it.each([
    ["GIF89a\x01\x00", "image/gif"],
    ["\x89PNG\r\n\x1a\n", "image/png"],
    ["\xff\xd8\xff\xe0\x00\x10JFIF", "image/jpeg"],
    ["RIFF\x24\x00\x00\x00WEBPVP8 ", "image/webp"],
    ["\x00\x00\x00\x1cftypavif", "image/avif"],
    ['<svg xmlns="http://www.w3.org/2000/svg"/>', "image/svg+xml"],
    ['<?xml version="1.0"?><svg/>', "image/svg+xml"],
  ])("recognises %j", (start, type) => {
    expect(sniffType(bytes(start))).toBe(type);
  });

  it("returns null for anything else", () => {
    expect(sniffType(bytes("<!doctype html><html>"))).toBeNull();
    expect(sniffType(new Uint8Array())).toBeNull();
  });
});
