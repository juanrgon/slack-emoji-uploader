// Talks to Slack as the signed-in user, the same way Slack's own
// "Customize" page does: with the browser's session cookies plus the API
// token that page embeds.

export type SlackErrorKind = "signed-out" | "rejected" | "network";

export class SlackError extends Error {
  constructor(
    message: string,
    readonly kind: SlackErrorKind,
  ) {
    super(message);
  }
}

/**
 * "unreachable" means the workspace's emoji page couldn't be opened at all:
 * the name is wrong, or the workspace signs people in on another site.
 */
export type TeamStatus = "signed-in" | "signed-out" | "unreachable";

export function teamUrl(team: string): string {
  return `https://${team}.slack.com`;
}

export function emojiPageUrl(team: string): string {
  return `${teamUrl(team)}/customize/emoji`;
}

/**
 * Accepts a workspace the way people tend to write it ("Acme",
 * "acme.slack.com", "https://acme.slack.com/") and returns the bare
 * subdomain, or null if it can't be one.
 */
export function normalizeTeam(input: string): string | null {
  const team = input
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/\.slack\.com$/, "");
  return /^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/.test(team) ? team : null;
}

/** Pulls the session's API token out of the HTML of Slack's emoji page. */
export function extractApiToken(html: string): string | null {
  return /["']?api_token["']?\s*:\s*["']([\w-]+)["']/.exec(html)?.[1] ?? null;
}

interface EmojiPage {
  status: TeamStatus;
  token: string | null;
}

async function loadEmojiPage(team: string): Promise<EmojiPage> {
  let response: Response;
  try {
    response = await fetch(emojiPageUrl(team), { credentials: "include" });
  } catch {
    throw new SlackError("Couldn't reach Slack. Check your internet connection.", "network");
  }
  // Slack redirects signed-out visitors to the workspace's sign-in page and
  // answers 404 for a workspace that doesn't exist.
  if (new URL(response.url).hostname !== `${team}.slack.com` || response.status === 404) {
    return { status: "unreachable", token: null };
  }
  const token = response.ok ? extractApiToken(await response.text()) : null;
  return { status: token ? "signed-in" : "signed-out", token };
}

export async function checkTeam(team: string): Promise<TeamStatus> {
  return (await loadEmojiPage(team)).status;
}

const REJECTIONS: Record<string, string> = {
  error_name_taken: "That name is already taken.",
  error_name_taken_i18n: "That name is already taken.",
  error_bad_name_i18n: "Slack doesn't allow that name.",
  error_missing_name: "Give your emoji a name.",
  error_too_big: "Slack says the image is too large.",
  resized_but_still_too_large: "Slack says the image is too large.",
  error_bad_wide: "Slack says the image is too large.",
  too_many_frames: "Slack says the animation has too many frames.",
  error_bad_format: "Slack couldn't read the image.",
  error_bad_upload: "Slack couldn't read the image.",
  ratelimited: "Slack is rate limiting uploads. Wait a moment and try again.",
  no_permission: "You don't have permission to add emoji to this workspace.",
  not_allowed: "You don't have permission to add emoji to this workspace.",
  restricted_action: "You don't have permission to add emoji to this workspace.",
};

const SIGNED_OUT_CODES = new Set(["not_authed", "invalid_auth", "token_revoked", "token_expired", "account_inactive"]);

/** Uploads an image as a custom emoji. Throws a SlackError with a message fit to show the user. */
export async function addEmoji(team: string, name: string, image: Blob): Promise<void> {
  const page = await loadEmojiPage(team);
  if (!page.token) {
    const message =
      page.status === "unreachable"
        ? `Couldn't open ${team}.slack.com. Check the workspace name and that you're signed in.`
        : `You're not signed in to ${team}.slack.com.`;
    throw new SlackError(message, "signed-out");
  }

  const form = new FormData();
  form.set("mode", "data");
  form.set("name", name);
  form.set("image", image, image.type === "image/gif" ? "emoji.gif" : "emoji.png");
  form.set("token", page.token);

  let result: { ok?: boolean; error?: string };
  try {
    const response = await fetch(`${teamUrl(team)}/api/emoji.add`, {
      method: "POST",
      body: form,
      credentials: "include",
    });
    result = await response.json();
  } catch {
    throw new SlackError("Couldn't reach Slack. Check your internet connection.", "network");
  }

  if (result.ok) return;
  const code = result.error ?? "unknown_error";
  if (SIGNED_OUT_CODES.has(code)) {
    throw new SlackError(`You're not signed in to ${team}.slack.com.`, "signed-out");
  }
  throw new SlackError(REJECTIONS[code] ?? `Slack rejected the emoji (${code}).`, "rejected");
}
