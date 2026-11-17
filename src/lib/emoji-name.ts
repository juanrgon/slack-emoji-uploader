const JAPANESE = "ぁ-ゖ゠-ヿ㐀-䶵一-鿋豈-頻";
const NAME_CHARS = `a-z0-9_\\-${JAPANESE}`;
const VALID_NAME = new RegExp(`^[${NAME_CHARS}]+$`, "u");
const INVALID_RUN = new RegExp(`[^${NAME_CHARS}]+`, "gu");

/** Slack's limit on emoji name length. */
export const MAX_NAME_LENGTH = 100;

/**
 * Turns what someone typed into the form Slack stores: lowercase, with spaces
 * collapsed into dashes. Surrounding colons are dropped so ":party parrot:"
 * and "party parrot" both become "party-parrot".
 */
export function normalizeEmojiName(raw: string): string {
  return raw
    .trim()
    .replace(/^:+|:+$/g, "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .join("-");
}

/** Returns a message describing what is wrong with a normalized name, or null if it is fine. */
export function emojiNameProblem(name: string): string | null {
  if (name === "") return "Give your emoji a name.";
  if (name.length > MAX_NAME_LENGTH) return `Names can be at most ${MAX_NAME_LENGTH} characters.`;
  if (!VALID_NAME.test(name)) return "Use only letters, numbers, dashes, and underscores.";
  return null;
}

/** Guesses a name from an image URL's file name, e.g. ".../Party_Parrot.gif?v=2" gives "party_parrot". */
export function suggestEmojiName(imageUrl: string): string {
  let fileName: string;
  try {
    const url = new URL(imageUrl);
    if (url.protocol === "data:" || url.protocol === "blob:") return "";
    fileName = decodeURIComponent(url.pathname.split("/").pop() ?? "");
  } catch {
    return "";
  }
  return fileName
    .replace(/\.[a-z0-9]{1,5}$/i, "")
    .toLowerCase()
    .replace(INVALID_RUN, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_NAME_LENGTH);
}
