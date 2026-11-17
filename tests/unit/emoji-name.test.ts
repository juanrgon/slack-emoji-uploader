import { describe, expect, it } from "vitest";
import { emojiNameProblem, normalizeEmojiName, suggestEmojiName } from "../../src/lib/emoji-name";

describe("normalizeEmojiName", () => {
  it("lowercases and joins words with dashes", () => {
    expect(normalizeEmojiName("  Party   Parrot ")).toBe("party-parrot");
  });

  it("drops the colons people type around emoji names", () => {
    expect(normalizeEmojiName(":shipit:")).toBe("shipit");
  });
});

describe("emojiNameProblem", () => {
  it.each(["party-parrot", "blob_wave", "100", "ねこ"])("accepts %s", (name) => {
    expect(emojiNameProblem(name)).toBeNull();
  });

  it.each(["", "what?", "a/b", "tada!", "a".repeat(101)])("rejects %j", (name) => {
    expect(emojiNameProblem(name)).toEqual(expect.any(String));
  });
});

describe("suggestEmojiName", () => {
  it("uses the file name without its extension", () => {
    expect(suggestEmojiName("https://example.com/img/Party_Parrot.gif?v=2")).toBe("party_parrot");
  });

  it("replaces characters Slack would reject", () => {
    expect(suggestEmojiName("https://example.com/My%20Cool%20Logo%20(final).png")).toBe("my-cool-logo-final");
  });

  it("has no suggestion for data URLs", () => {
    expect(suggestEmojiName("data:image/png;base64,AAAA")).toBe("");
  });

  it("only suggests names that pass validation", () => {
    const suggestion = suggestEmojiName("https://example.com/a%20b/@2x~Ünïcode--logo.final.webp");
    expect(emojiNameProblem(suggestion)).toBeNull();
  });
});
