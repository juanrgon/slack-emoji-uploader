// Loads the built extension into a real Chromium and replaces the network
// with fakes: a Slack that records uploads, and a web server for images.

import { test as base, chromium, type BrowserContext, type Page, type Route, type Worker } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const DIST = path.resolve(import.meta.dirname, "../../dist");
const FIXTURES = path.resolve(import.meta.dirname, "fixtures");

export interface Upload {
  team: string;
  name: string;
  token: string;
  fileName: string;
  image: Buffer;
}

/** Stands in for every *.slack.com workspace. */
export class FakeSlack {
  readonly uploads: Upload[] = [];
  /** Workspaces that answer like Slack does when nobody is signed in. */
  readonly signedOut = new Set<string>();
  /** Workspaces that don't exist. */
  readonly missing = new Set<string>();
  private readonly rejections: Array<{ team: string; error: string }> = [];

  /** Makes the next upload to `team` fail with a Slack error code. */
  rejectNextUpload(team: string, error: string): void {
    this.rejections.push({ team, error });
  }

  async handle(route: Route): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const team = url.hostname.replace(/\.slack\.com$/, "");

    if (this.missing.has(team)) {
      return route.fulfill({ status: 404, contentType: "text/html", body: "<h1>There's been a glitch…</h1>" });
    }
    if (url.pathname === "/customize/emoji") {
      if (this.signedOut.has(team)) {
        // Real Slack first redirects to /?redir=... on the same host. Playwright
        // can't answer the second request of a redirect, so skip to its result.
        return route.fulfill({ contentType: "text/html", body: `<h1>Sign in to ${team}</h1>` });
      }
      return route.fulfill({
        contentType: "text/html",
        body: `<script>var boot_data = {"team_url":"https://${url.hostname}/","api_token":"xoxc-${team}-session"};</script>`,
      });
    }
    if (url.pathname === "/api/emoji.add" && request.method() === "POST") {
      const fields = parseMultipart(request.postDataBuffer()!, (await request.headerValue("content-type"))!);
      const rejection = this.rejections.findIndex((entry) => entry.team === team);
      if (rejection >= 0) {
        const [rejected] = this.rejections.splice(rejection, 1);
        return route.fulfill({ json: { ok: false, error: rejected!.error } });
      }
      const image = fields.get("image")!;
      this.uploads.push({
        team,
        name: fields.get("name")!.data.toString(),
        token: fields.get("token")!.data.toString(),
        fileName: image.fileName ?? "",
        image: image.data,
      });
      return route.fulfill({ json: { ok: true } });
    }
    return route.fulfill({ contentType: "text/html", body: `<h1>Sign in to ${team}</h1>` });
  }
}

interface FormField {
  fileName?: string;
  data: Buffer;
}

function parseMultipart(body: Buffer, contentType: string): Map<string, FormField> {
  const boundary = Buffer.from(`--${/boundary=(.+)$/.exec(contentType)![1]}`);
  const fields = new Map<string, FormField>();
  let start = body.indexOf(boundary) + boundary.length;
  for (;;) {
    const end = body.indexOf(boundary, start);
    if (end < 0) break;
    // Each part is "\r\n<headers>\r\n\r\n<data>\r\n".
    const part = body.subarray(start + 2, end - 2);
    const split = part.indexOf("\r\n\r\n");
    const headers = part.subarray(0, split).toString();
    const name = /name="([^"]*)"/.exec(headers)![1]!;
    fields.set(name, { fileName: /filename="([^"]*)"/.exec(headers)?.[1], data: part.subarray(split + 4) });
    start = end + boundary.length;
  }
  return fields;
}

const CONTENT_TYPES: Record<string, string> = {
  ".gif": "image/gif",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

/** Serves images at https://images.test/<name>, from memory or from the fixtures folder. */
export class FakeWeb {
  private readonly files = new Map<string, { body: Buffer; contentType: string }>();

  /** Registers a file and returns its URL. */
  serve(name: string, body: Buffer | string, contentType?: string): string {
    const type = contentType ?? CONTENT_TYPES[path.extname(name)] ?? "application/octet-stream";
    this.files.set(name, { body: Buffer.from(body), contentType: type });
    return this.url(name);
  }

  url(name: string): string {
    return `https://images.test/${name}`;
  }

  async handle(route: Route): Promise<void> {
    const name = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
    const registered = this.files.get(name);
    if (registered) return route.fulfill(registered);
    try {
      const body = await readFile(path.join(FIXTURES, name));
      return route.fulfill({ body, contentType: CONTENT_TYPES[path.extname(name)] });
    } catch {
      return route.fulfill({ status: 404, body: "Not found" });
    }
  }
}

export function fixture(name: string): Promise<Buffer> {
  return readFile(path.join(FIXTURES, name));
}

/** The file: address of a fixture, as the browser shows for an image opened from disk. */
export function fixtureFileUrl(name: string): string {
  return pathToFileURL(path.join(FIXTURES, name)).href;
}

/** Fires an extension event in the service worker, as the browser would. */
function dispatch(background: Worker, event: string, ...args: unknown[]): Promise<void> {
  return background.evaluate(
    ([eventPath, eventArgs]) => {
      let target: any = chrome;
      for (const key of eventPath.split(".")) target = target[key];
      target.dispatch(...eventArgs);
    },
    [event, args] as const,
  );
}

export class Extension {
  constructor(
    readonly context: BrowserContext,
    readonly id: string,
  ) {}

  /** The extension's service worker. Looked up each time, since Chrome stops and restarts it at will. */
  async background(): Promise<Worker> {
    const find = () => this.context.serviceWorkers().find((candidate) => candidate.url().includes(this.id));
    for (let attempt = 0; attempt < 20 && !find(); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!find()) {
      // A stopped worker starts again when it has an event to handle, such as a message.
      const page = await this.context.newPage();
      await page.goto(this.url("base.css"));
      await page.evaluate(() => chrome.runtime.sendMessage("wake up").catch(() => {}));
      await page.close();
    }
    return find() ?? this.context.waitForEvent("serviceworker");
  }

  /** Runs a function inside the service worker. */
  async inBackground<Result, Arg>(run: (arg: Arg) => Result | Promise<Result>, arg?: Arg): Promise<Result> {
    return (await this.background()).evaluate(run as never, arg) as Promise<Result>;
  }

  url(page: string): string {
    return `chrome-extension://${this.id}/${page}`;
  }

  /** Saves workspaces as the options page would and waits for the right-click menu to catch up. */
  async setTeams(teams: string[]): Promise<void> {
    await this.inBackground((teamDomains) => chrome.storage.sync.set({ teamDomains }), teams);
    for (const team of teams) await this.waitForMenuItem(`team:${team}`);
  }

  /** The address of every open tab, including ones still loading. */
  tabUrls(): Promise<string[]> {
    return this.inBackground(async () => (await chrome.tabs.query({})).map((tab) => tab.pendingUrl || tab.url || ""));
  }

  async getTeams(): Promise<unknown> {
    return this.inBackground(async () => (await chrome.storage.sync.get("teamDomains")).teamDomains);
  }

  /** Chrome has no API to list menu items, but updating one fails unless it exists. */
  hasMenuItem(id: string): Promise<boolean> {
    return this.inBackground(
      (menuId) =>
        chrome.contextMenus.update(menuId, {}).then(
          () => true,
          () => false,
        ),
      id,
    );
  }

  async waitForMenuItem(id: string): Promise<void> {
    for (let attempt = 0; attempt < 50; attempt++) {
      if (await this.hasMenuItem(id)) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Menu item ${id} never appeared`);
  }

  /** Simulates picking one of the extension's entries in an image's right-click menu. */
  async chooseMenuItem(imageUrl: string, menuItemId: string): Promise<void> {
    return dispatch(await this.background(), "contextMenus.onClicked", {
      menuItemId,
      srcUrl: imageUrl,
      editable: false,
      pageUrl: "https://example.com/",
    });
  }

  /** Picks a right-click menu entry on an image and returns the "add emoji" window that opens. */
  rightClickImage(imageUrl: string, menuItemId: string): Promise<Page> {
    return this.pageOpenedBy(() => this.chooseMenuItem(imageUrl, menuItemId));
  }

  async clickToolbarButton(): Promise<void> {
    return dispatch(await this.background(), "action.onClicked", {});
  }

  async simulateUpdateFrom(previousVersion: string): Promise<void> {
    return dispatch(await this.background(), "runtime.onInstalled", { reason: "update", previousVersion });
  }

  /** Waits for a tab showing the options page. */
  async waitForOptionsTab(): Promise<Page> {
    const address = this.url("options.html");
    for (let attempt = 0; attempt < 100; attempt++) {
      const page = this.context.pages().find((open) => open.url() === address);
      if (page) return page;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("The options page never opened");
  }

  async pageOpenedBy(action: () => Promise<unknown>): Promise<Page> {
    const opened = this.context.waitForEvent("page");
    await action();
    const page = await opened;
    await page.waitForLoadState("domcontentloaded");
    return page;
  }
}

export interface DecodedImage {
  width: number;
  height: number;
  /** How many extra times the animation plays; Infinity when it loops forever. */
  repetitions: number;
  frames: Array<{ durationMs: number; pixels: number[] }>;
}

/** Side length of the grid each frame is sampled down to for comparisons. */
export const GRID = 16;

/**
 * Decodes an image with the browser's own decoder, so tests judge output
 * files by how Chrome will actually show them.
 */
export async function decodeImage(page: Page, image: Buffer, type: string): Promise<DecodedImage> {
  const decoded = await page.evaluate(
    async ({ base64, type, grid }) => {
      const data = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
      const decoder = new ImageDecoder({ data, type, preferAnimation: true });
      await Promise.all([decoder.tracks.ready, decoder.completed]);
      const track = decoder.tracks.selectedTrack!;
      const context = new OffscreenCanvas(grid, grid).getContext("2d", { willReadFrequently: true })!;
      const frames = [];
      let width = 0;
      let height = 0;
      for (let index = 0; index < track.frameCount; index++) {
        const { image: frame } = await decoder.decode({ frameIndex: index });
        width = frame.displayWidth;
        height = frame.displayHeight;
        context.clearRect(0, 0, grid, grid);
        context.drawImage(frame, 0, 0, grid, grid);
        frames.push({
          durationMs: (frame.duration ?? 0) / 1000,
          pixels: Array.from(context.getImageData(0, 0, grid, grid).data),
        });
        frame.close();
      }
      // Infinity does not survive the trip back to Node, so send it as -1.
      return { width, height, repetitions: track.repetitionCount === Infinity ? -1 : track.repetitionCount, frames };
    },
    { base64: image.toString("base64"), type, grid: GRID },
  );
  return { ...decoded, repetitions: decoded.repetitions === -1 ? Infinity : decoded.repetitions };
}

/** The frame on screen `timeMs` into the animation. */
export function frameAt(image: DecodedImage, timeMs: number): number[] {
  let elapsed = 0;
  for (const frame of image.frames) {
    elapsed += frame.durationMs;
    if (timeMs < elapsed) return frame.pixels;
  }
  return image.frames.at(-1)!.pixels;
}

/**
 * Average difference between two sampled frames on a 0 to 255 scale, with
 * colours weighted by opacity so invisible pixels can't disagree.
 */
export function difference(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i += 4) {
    const alphaA = a[i + 3]! / 255;
    const alphaB = b[i + 3]! / 255;
    for (let channel = 0; channel < 3; channel++) {
      total += Math.abs(a[i + channel]! * alphaA - b[i + channel]! * alphaB);
    }
    total += Math.abs(a[i + 3]! - b[i + 3]!);
  }
  return total / a.length;
}

interface Session {
  context: BrowserContext;
  extension: Extension;
  profile: string;
}

/** Starts a browser with the extension loaded and waits for its first-install work to finish. */
async function startSession(): Promise<Session> {
  const profile = await mkdtemp(path.join(tmpdir(), "slack-emoji-uploader-"));
  const executablePath = process.env.CHROMIUM_PATH;
  let context: BrowserContext | undefined;
  try {
    context = await chromium.launchPersistentContext(profile, {
      ...(executablePath ? { executablePath } : { channel: "chromium" }),
      headless: !process.env.HEADED,
      timeout: 15_000,
      args: [
        `--disable-extensions-except=${DIST}`,
        `--load-extension=${DIST}`,
        // Anything the fakes don't answer fails instead of reaching the real internet.
        "--host-resolver-rules=MAP * ~NOTFOUND",
      ],
    });
    const background =
      context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker", { timeout: 10_000 }));
    const extension = new Extension(context, new URL(background.url()).host);
    // Installing builds the right-click menu and opens the options page. Wait
    // for both, then close that tab, so every test starts from the same state.
    await extension.waitForMenuItem("setup");
    await (await extension.waitForOptionsTab()).close();
    return { context, extension, profile };
  } catch (error) {
    await context?.close().catch(() => {});
    await rm(profile, { recursive: true, force: true });
    throw error;
  }
}

export const test = base.extend<{
  session: Session;
  context: BrowserContext;
  extension: Extension;
  slack: FakeSlack;
  web: FakeWeb;
  /** A blank extension page for running browser APIs such as the image decoder. */
  lab: Page;
}>({
  session: async ({}, use) => {
    // Now and then Chromium dies while starting up with an extension that
    // opens a tab on install, before a test has done anything. Start over
    // when that happens rather than failing the test.
    let session: Session | undefined;
    for (let attempt = 1; !session; attempt++) {
      try {
        session = await startSession();
      } catch (error) {
        if (attempt === 3) throw error;
      }
    }
    await use(session);
    await session.context.close();
    await rm(session.profile, { recursive: true, force: true });
  },

  context: async ({ session }, use) => use(session.context),

  slack: async ({ context }, use) => {
    const slack = new FakeSlack();
    await context.route("https://*.slack.com/**", (route) => slack.handle(route));
    await use(slack);
  },

  web: async ({ context }, use) => {
    const web = new FakeWeb();
    await context.route("https://images.test/**", (route) => web.handle(route));
    await use(web);
  },

  // The fakes are listed so they are always in place before a test touches the extension.
  extension: async ({ session, slack: _slack, web: _web }, use) => use(session.extension),

  lab: async ({ context, extension }, use) => {
    const page = await context.newPage();
    await page.goto(extension.url("base.css"));
    await use(page);
  },
});

export { expect } from "@playwright/test";
