// The "add emoji" window: shows a preview of the resized image, asks for a
// name, and uploads to the chosen workspaces. The service worker opens it in
// response to a right-click or a click on slackmojis.com.

import { emojiNameProblem, normalizeEmojiName } from "./lib/emoji-name";
import { ImageError, prepareEmoji, type PreparedEmoji } from "./lib/prepare";
import { SlackError, addEmoji, teamUrl } from "./lib/slack";
import { getTeams, takePending } from "./lib/storage";

function byId<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing #${id}`);
  return element as T;
}

const details = byId<HTMLParagraphElement>("details");
const fileAccessButton = byId<HTMLButtonElement>("file-access");
const form = byId<HTMLFormElement>("form");
const nameInput = byId<HTMLInputElement>("name");
const nameError = byId<HTMLParagraphElement>("name-error");
const teamList = byId<HTMLUListElement>("teams");
const cancelButton = byId<HTMLButtonElement>("cancel");
const submitButton = byId<HTMLButtonElement>("submit");
const rowTemplate = byId<HTMLTemplateElement>("team-row");

/** One workspace in the list, with its checkbox and upload result. */
class TeamRow {
  done = false;
  private readonly element: HTMLLIElement;
  private readonly checkbox: HTMLInputElement;
  private readonly status: HTMLElement;
  private readonly signIn: HTMLButtonElement;

  constructor(
    readonly team: string,
    checked: boolean,
  ) {
    const fragment = rowTemplate.content.cloneNode(true) as DocumentFragment;
    this.element = fragment.querySelector("li")!;
    this.checkbox = fragment.querySelector("input")!;
    this.status = fragment.querySelector(".team-status")!;
    this.signIn = fragment.querySelector(".team-sign-in")!;
    fragment.querySelector(".team-name")!.textContent = `${team}.slack.com`;
    this.checkbox.checked = checked;
    this.signIn.addEventListener("click", () => void chrome.tabs.create({ url: teamUrl(team) }));
    teamList.append(fragment);
  }

  get selected(): boolean {
    return this.checkbox.checked;
  }

  setUploading(): void {
    this.show("", "Adding…");
  }

  setDone(name: string): void {
    this.done = true;
    this.checkbox.disabled = true;
    this.show("done", `Added :${name}:`);
  }

  setFailed(error: unknown): void {
    const message = error instanceof SlackError ? error.message : "Something went wrong. Try again.";
    this.show("failed", message);
    this.signIn.hidden = !(error instanceof SlackError && error.kind === "signed-out");
  }

  private show(state: string, text: string): void {
    this.element.className = `team ${state}`;
    this.status.textContent = text;
    this.signIn.hidden = true;
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} KB`;
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

function describe(emoji: PreparedEmoji): string {
  const format = emoji.blob.type.replace("image/", "").toUpperCase();
  const frames = emoji.frameCount > 1 ? ` · ${emoji.frameCount} frames` : "";
  const result = `${emoji.width} × ${emoji.height} ${format}${frames} · ${formatBytes(emoji.blob.size)}`;
  if (!emoji.changed) return `${result}. Already fits Slack's limits, so it's uploaded as is.`;

  const { source } = emoji;
  const sourceFrames = source.frameCount > 1 ? `, ${source.frameCount} frames` : "";
  return `${result}. Resized from ${source.width} × ${source.height}${sourceFrames}, ${formatBytes(source.bytes)}.`;
}

function showPreview(emoji: PreparedEmoji): void {
  const url = URL.createObjectURL(emoji.blob);
  for (const id of ["preview-light", "preview-dark"]) {
    const image = byId<HTMLImageElement>(id);
    image.src = url;
    image.hidden = false;
  }
  details.textContent = describe(emoji);
}

/** Shows a problem that can't be fixed from this window and turns off the form. */
function showFailure(message: string): void {
  details.textContent = message;
  details.classList.add("failed");
  submitButton.disabled = true;
}

async function prepare(imageUrl: string): Promise<PreparedEmoji> {
  try {
    if (imageUrl.startsWith("file:") && !(await chrome.extension.isAllowedFileSchemeAccess())) {
      fileAccessButton.hidden = false;
      throw new ImageError('To add images from your computer, turn on "Allow access to file URLs" for this extension.');
    }
    const emoji = await prepareEmoji(imageUrl, (message) => {
      details.textContent = message;
    });
    showPreview(emoji);
    return emoji;
  } catch (error) {
    console.error(error);
    showFailure(error instanceof ImageError ? error.message : "Something went wrong preparing this image.");
    throw error;
  }
}

async function upload(rows: TeamRow[], prepared: Promise<PreparedEmoji>): Promise<void> {
  const name = normalizeEmojiName(nameInput.value);
  const waiting = rows.filter((row) => row.selected && !row.done);
  nameError.textContent = emojiNameProblem(name) ?? (waiting.length === 0 ? "Pick at least one workspace." : "");
  if (nameError.textContent) {
    nameInput.focus();
    return;
  }

  nameInput.value = name;
  submitButton.disabled = true;
  submitButton.textContent = "Adding…";
  let emoji: PreparedEmoji;
  try {
    emoji = await prepared;
  } catch {
    // prepare() has already shown what went wrong and turned off the form.
    submitButton.textContent = "Add emoji";
    return;
  }

  for (const row of waiting) {
    row.setUploading();
    try {
      await addEmoji(row.team, name, emoji.blob);
      row.setDone(name);
    } catch (error) {
      console.error(error);
      row.setFailed(error);
    }
  }

  if (waiting.every((row) => row.done)) {
    submitButton.textContent = "Added";
    setTimeout(() => window.close(), 1200);
  } else {
    submitButton.disabled = false;
    submitButton.textContent = "Try again";
  }
}

async function main(): Promise<void> {
  cancelButton.addEventListener("click", () => window.close());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") window.close();
  });
  fileAccessButton.addEventListener("click", () => {
    void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
  });

  const id = new URLSearchParams(location.search).get("id");
  const [pending, teams] = await Promise.all([id ? takePending(id) : null, getTeams()]);
  if (!pending) {
    showFailure("This request has expired. Right-click the image and try again.");
    return;
  }

  const rows = teams.map((team) => new TeamRow(team, teams.length === 1 || pending.teams.includes(team)));
  teamList.classList.toggle("single", rows.length === 1);
  nameInput.value = pending.suggestedName;
  nameInput.select();

  // Start resizing right away so the preview is usually ready before a name is typed.
  const prepared = prepare(pending.imageUrl);
  prepared.catch(() => {});

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!submitButton.disabled) void upload(rows, prepared);
  });
}

void main();
