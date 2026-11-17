import type { Page } from "@playwright/test";
import { createRequire } from "node:module";
import {
  GRID,
  decodeImage,
  difference,
  expect,
  fixture,
  fixtureFileUrl,
  frameAt,
  test,
  type DecodedImage,
} from "./harness";

// Test GIFs are built with the encoder library directly rather than with the
// extension's own code, so the code under test never produces its own input.
const { GIFEncoder } = createRequire(import.meta.url)("gifenc") as typeof import("gifenc");

const MAX_SIDE = 128;
const MAX_BYTES = 128_000;
const MAX_FRAMES = 50;

/** A GIF of drifting waves buried in per-pixel noise, which is about as badly as a GIF can compress. */
function noisyGif(options: { width: number; height: number; frames: number; delayMs: number }): Buffer {
  let seed = 42;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  // A 256-colour palette with 8 levels of red and green and 4 of blue.
  const palette = Array.from({ length: 256 }, (_, i) => [(i >> 5) * 36, ((i >> 2) & 7) * 36, (i & 3) * 85]);
  const gif = GIFEncoder();
  for (let frame = 0; frame < options.frames; frame++) {
    const indexes = new Uint8Array(options.width * options.height);
    for (let y = 0; y < options.height; y++) {
      for (let x = 0; x < options.width; x++) {
        const wave = (Math.sin(x / 9 + frame / 3) + Math.cos(y / 7 - frame / 4) + 2) / 4;
        indexes[y * options.width + x] = Math.floor(wave * 200 + random() * 55);
      }
    }
    gif.writeFrame(indexes, options.width, options.height, {
      palette: frame === 0 ? palette : undefined,
      delay: options.delayMs,
    });
  }
  gif.finish();
  return Buffer.from(gif.bytes());
}

const totalDuration = (image: DecodedImage) => image.frames.reduce((sum, frame) => sum + frame.durationMs, 0);

async function waitForPreview(page: Page): Promise<void> {
  try {
    await expect(page.locator("#preview-light")).toBeVisible({ timeout: 15_000 });
  } catch (cause) {
    const status = await page.locator("#details").textContent();
    throw new Error(`The preview never appeared. The window says: "${status}"`, { cause });
  }
}

/** Submits the form and waits for the window to close itself, which it only does after every upload succeeds. */
async function addAndWaitForClose(page: Page): Promise<void> {
  const closed = page.waitForEvent("close");
  await page.click("#submit");
  await closed;
}

test.describe("setup", () => {
  test("saving workspaces on the options page updates the right-click menu", async ({ context, extension }) => {
    const page = await context.newPage();
    await page.goto(extension.url("options.html"));

    await page.locator(".team-name").fill("https://Acme.slack.com/customize/emoji");
    await page.click("#add-team");
    await page.locator(".team-name").nth(1).fill("globex");
    await page.click("#save");

    await expect(page.locator(".team-status").first()).toHaveText("Signed in");
    await expect(page.locator(".team-name").first()).toHaveValue("acme");
    expect(await extension.getTeams()).toEqual(["acme", "globex"]);
    await extension.waitForMenuItem("team:acme");
    await extension.waitForMenuItem("team:globex");
    expect(await extension.hasMenuItem("setup")).toBe(false);

    // Removing a workspace takes its menu entry away again.
    await page.locator(".remove").first().click();
    await page.click("#save");
    await expect.poll(() => extension.hasMenuItem("team:acme")).toBe(false);
    expect(await extension.getTeams()).toEqual(["globex"]);
  });

  test("the options page flags workspaces that aren't signed in or can't be found", async ({ context, extension, slack }) => {
    slack.signedOut.add("acme");
    slack.missing.add("typo");
    const page = await context.newPage();
    await page.goto(extension.url("options.html"));

    await page.locator(".team-name").fill("acme");
    await page.click("#add-team");
    await page.locator(".team-name").nth(1).fill("typo");
    await page.click("#save");

    await expect(page.locator(".team-status").first()).toContainText("Not signed in");
    await expect(page.locator(".team-status").nth(1)).toContainText("Couldn't open this workspace");
    // Being signed out is a warning, not an error: the workspaces are still saved.
    expect(await extension.getTeams()).toEqual(["acme", "typo"]);

    await page.locator(".team-sign-in").first().click();
    await expect.poll(() => extension.tabUrls()).toContain("https://acme.slack.com/");
  });

  test("the options page refuses a workspace that can't be an address", async ({ context, extension }) => {
    const page = await context.newPage();
    await page.goto(extension.url("options.html"));

    await page.locator(".team-name").fill("my team!");
    await page.click("#save");

    await expect(page.locator(".team-status")).toContainText("doesn't look like a workspace");
    await expect(page.locator("#save-status")).toContainText("Not saved");
    expect(await extension.getTeams()).toBeUndefined();
  });

  test("right-clicking an image before any workspace is saved opens the options page", async ({ extension, web }) => {
    await extension.chooseMenuItem(web.url("small.png"), "setup");
    await extension.waitForOptionsTab();
  });

  test("the toolbar button opens every workspace's emoji page", async ({ extension }) => {
    await extension.setTeams(["acme", "globex"]);
    await extension.clickToolbarButton();

    await expect
      .poll(() => extension.tabUrls())
      .toEqual(expect.arrayContaining(["https://acme.slack.com/customize/emoji", "https://globex.slack.com/customize/emoji"]));
  });

  test("updating from a version that stored a single workspace keeps it", async ({ extension }) => {
    await extension.inBackground(() => chrome.storage.sync.set({ team_domain: "oldteam" }));
    await extension.simulateUpdateFrom("1.2.0");

    await extension.waitForMenuItem("team:oldteam");
    expect(await extension.getTeams()).toEqual(["oldteam"]);
  });
});

test.describe("still images", () => {
  test("a large photo is shrunk to a 128 px PNG and uploaded under the chosen name", async ({ extension, slack, web, lab }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("photo.jpg"), "team:acme");
    await waitForPreview(page);

    await expect(page.locator("#name")).toHaveValue("photo");
    await expect(page.locator("#details")).toContainText("Resized from 600 × 400");
    await page.fill("#name", " Sunset  Swirl ");
    await addAndWaitForClose(page);

    expect(slack.uploads).toHaveLength(1);
    const [upload] = slack.uploads;
    expect(upload).toMatchObject({ team: "acme", name: "sunset-swirl", token: "xoxc-acme-session", fileName: "emoji.png" });
    const uploaded = await decodeImage(lab, upload!.image, "image/png");
    expect(uploaded).toMatchObject({ width: 128, height: 85 });

    // The upload should look like the original, just smaller.
    const original = await decodeImage(lab, await fixture("photo.jpg"), "image/jpeg");
    expect(difference(uploaded.frames[0]!.pixels, original.frames[0]!.pixels)).toBeLessThan(3);
  });

  test("an image that already fits Slack's limits is uploaded byte for byte", async ({ extension, slack, web }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("small.png"), "team:acme");
    await waitForPreview(page);

    await expect(page.locator("#details")).toContainText("Already fits");
    await addAndWaitForClose(page);

    expect(slack.uploads[0]!.image.equals(await fixture("small.png"))).toBe(true);
  });

  test("a vector image is drawn at full emoji size", async ({ extension, slack, web, lab }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("icon.svg"), "team:acme");
    await waitForPreview(page);
    await addAndWaitForClose(page);

    const uploaded = await decodeImage(lab, slack.uploads[0]!.image, "image/png");
    expect(uploaded).toMatchObject({ width: 128, height: 64 });
    expect(uploaded.frames[0]!.pixels.slice(0, 4)).toEqual([0xe0, 0x1e, 0x5a, 255]);
  });

  test("the file's contents decide its type, not what the server claims", async ({ extension, slack, web, lab }) => {
    await extension.setTeams(["acme"]);
    const url = web.serve("download", await fixture("moving-dot.gif"), "application/octet-stream");
    const page = await extension.rightClickImage(url, "team:acme");
    await waitForPreview(page);
    await page.fill("#name", "dot");
    await addAndWaitForClose(page);

    expect(slack.uploads[0]!.fileName).toBe("emoji.gif");
    expect((await decodeImage(lab, slack.uploads[0]!.image, "image/gif")).frames.length).toBeGreaterThan(1);
  });

  test("an image embedded in the page as a data: URL can be added", async ({ extension, slack }) => {
    await extension.setTeams(["acme"]);
    const dataUrl = `data:image/png;base64,${(await fixture("small.png")).toString("base64")}`;
    const page = await extension.rightClickImage(dataUrl, "team:acme");
    await waitForPreview(page);

    // There is no file name to suggest, so the name starts empty and has to be typed.
    await expect(page.locator("#name")).toHaveValue("");
    await page.click("#submit");
    await expect(page.locator("#name-error")).toHaveText("Give your emoji a name.");
    expect(slack.uploads).toHaveLength(0);

    await page.fill("#name", "orange");
    await addAndWaitForClose(page);
    expect(slack.uploads[0]).toMatchObject({ name: "orange" });
  });

  test("an image opened from the computer can be added", async ({ extension, slack, lab }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(fixtureFileUrl("photo.jpg"), "team:acme");
    await waitForPreview(page);
    await addAndWaitForClose(page);

    expect(slack.uploads[0]).toMatchObject({ name: "photo", fileName: "emoji.png" });
    expect(await decodeImage(lab, slack.uploads[0]!.image, "image/png")).toMatchObject({ width: 128, height: 85 });
  });

  test("a local image explains how to allow file access when Chrome has it turned off", async ({ context, extension, slack }) => {
    // Chrome grants file access to extensions loaded for testing, so pretend it didn't.
    await context.addInitScript(() => {
      if (globalThis.chrome?.extension) chrome.extension.isAllowedFileSchemeAccess = async () => false;
    });
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(fixtureFileUrl("photo.jpg"), "team:acme");

    await expect(page.locator("#details")).toContainText('turn on "Allow access to file URLs"');
    await expect(page.locator("#submit")).toBeDisabled();
    await page.click("#file-access");
    // Chrome hides chrome:// addresses from extensions, so ask the browser instead.
    await expect
      .poll(() => context.pages().map((open) => open.url()))
      .toContain(`chrome://extensions/?id=${extension.id}`);
    expect(slack.uploads).toHaveLength(0);
  });

  test("something that isn't an image is reported instead of uploaded", async ({ extension, slack, web }) => {
    await extension.setTeams(["acme"]);
    const url = web.serve("page.html", "<!doctype html><p>Not an image</p>", "text/html");
    const page = await extension.rightClickImage(url, "team:acme");

    await expect(page.locator("#details")).toHaveText("This doesn't look like an image Chrome can read.");
    await expect(page.locator("#submit")).toBeDisabled();
    expect(slack.uploads).toHaveLength(0);
  });

  test("an image that fails to download is reported", async ({ extension, web }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("missing.png"), "team:acme");

    await expect(page.locator("#details")).toHaveText("Couldn't download this image.");
    await expect(page.locator("#submit")).toBeDisabled();
  });
});

test.describe("animated images", () => {
  test("a long, busy GIF is cut down to Slack's limits and keeps its running time", async ({ extension, slack, web, lab }) => {
    const source = noisyGif({ width: 300, height: 200, frames: 120, delayMs: 30 });
    expect(source.length).toBeGreaterThan(MAX_BYTES * 10);
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.serve("busy.gif", source), "team:acme");
    await waitForPreview(page);
    await addAndWaitForClose(page);

    const { image, fileName } = slack.uploads[0]!;
    expect(fileName).toBe("emoji.gif");
    expect(image.length).toBeLessThanOrEqual(MAX_BYTES);
    const uploaded = await decodeImage(lab, image, "image/gif");
    expect(Math.max(uploaded.width, uploaded.height)).toBeLessThanOrEqual(MAX_SIDE);
    expect(uploaded.width / uploaded.height).toBeCloseTo(300 / 200, 1);
    expect(uploaded.frames.length).toBeGreaterThan(1);
    expect(uploaded.frames.length).toBeLessThanOrEqual(MAX_FRAMES);
    expect(uploaded.repetitions).toBe(Infinity);
    expect(totalDuration(uploaded)).toBe(120 * 30);

    // Each frame that survived should show what the original showed at that moment.
    const original = await decodeImage(lab, source, "image/gif");
    let elapsed = 0;
    for (const frame of uploaded.frames) {
      expect(difference(frame.pixels, frameAt(original, elapsed))).toBeLessThan(12);
      elapsed += frame.durationMs;
    }
  });

  test("a GIF with a transparent background keeps it, without smearing", async ({ extension, slack, web, lab }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("moving-dot.gif"), "team:acme");
    await waitForPreview(page);
    await addAndWaitForClose(page);

    const original = await decodeImage(lab, await fixture("moving-dot.gif"), "image/gif");
    const uploaded = await decodeImage(lab, slack.uploads[0]!.image, "image/gif");
    expect(uploaded).toMatchObject({ width: 128, height: 85, repetitions: Infinity });
    expect(uploaded.frames.map((frame) => frame.durationMs)).toEqual(original.frames.map((frame) => frame.durationMs));

    const visiblePixels = (pixels: number[]) => pixels.filter((value, i) => i % 4 === 3 && value > 127).length;
    uploaded.frames.forEach((frame, i) => {
      // The dot covers a small part of each frame. If old frames weren't
      // erased, the visible area would grow as the dot moves.
      expect(visiblePixels(frame.pixels)).toBeLessThan((GRID * GRID) / 8);
      expect(difference(frame.pixels, original.frames[i]!.pixels)).toBeLessThan(8);
    });
  });

  test("a GIF that plays a fixed number of times, with frames too fast for browsers, plays the same afterwards", async ({ extension, slack, web, lab }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("plays-twice.gif"), "team:acme");
    await waitForPreview(page);
    await addAndWaitForClose(page);

    const original = await decodeImage(lab, await fixture("plays-twice.gif"), "image/gif");
    const uploaded = await decodeImage(lab, slack.uploads[0]!.image, "image/gif");
    expect(uploaded.repetitions).toBe(original.repetitions);
    // The original asks for no delay at all, which browsers play at 100 ms a frame.
    expect(original.frames.map((frame) => frame.durationMs)).toEqual([0, 0, 0]);
    expect(uploaded.frames.map((frame) => frame.durationMs)).toEqual([100, 100, 100]);
  });

  test("a small GIF that already fits is uploaded byte for byte", async ({ extension, slack, web }) => {
    const source = noisyGif({ width: 48, height: 32, frames: 6, delayMs: 100 });
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.serve("tiny.gif", source), "team:acme");
    await waitForPreview(page);
    await addAndWaitForClose(page);

    expect(slack.uploads[0]!.image.equals(source)).toBe(true);
  });

  test("a small GIF with too many frames is thinned out even though its size is fine", async ({ extension, slack, web, lab }) => {
    const source = noisyGif({ width: 24, height: 24, frames: 80, delayMs: 50 });
    expect(source.length).toBeLessThan(MAX_BYTES);
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.serve("flipbook.gif", source), "team:acme");
    await waitForPreview(page);
    await addAndWaitForClose(page);

    const uploaded = await decodeImage(lab, slack.uploads[0]!.image, "image/gif");
    expect(uploaded).toMatchObject({ width: 24, height: 24 });
    expect(uploaded.frames).toHaveLength(MAX_FRAMES);
    expect(totalDuration(uploaded)).toBe(80 * 50);
  });

  test("an animated WebP is converted to an animated GIF", async ({ extension, slack, web, lab }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("animated.webp"), "team:acme");
    await waitForPreview(page);
    await addAndWaitForClose(page);

    const original = await decodeImage(lab, await fixture("animated.webp"), "image/webp");
    const uploaded = await decodeImage(lab, slack.uploads[0]!.image, "image/gif");
    expect(slack.uploads[0]!.image.length).toBeLessThanOrEqual(MAX_BYTES);
    expect(uploaded).toMatchObject({ width: 128, height: 102 });
    expect(uploaded.frames).toHaveLength(original.frames.length);
    expect(totalDuration(uploaded)).toBe(totalDuration(original));
    uploaded.frames.forEach((frame, i) => {
      expect(difference(frame.pixels, original.frames[i]!.pixels)).toBeLessThan(8);
    });
  });
});

test.describe("uploading", () => {
  test("only the workspace that was right-clicked is ticked, and more can be added", async ({ extension, slack, web }) => {
    await extension.setTeams(["acme", "globex", "initech"]);
    const page = await extension.rightClickImage(web.url("small.png"), "team:globex");
    await waitForPreview(page);

    await expect(page.locator(".team input:checked")).toHaveCount(1);
    await page.getByLabel("initech.slack.com").check();
    await addAndWaitForClose(page);

    expect(slack.uploads.map((upload) => [upload.team, upload.token])).toEqual([
      ["globex", "xoxc-globex-session"],
      ["initech", "xoxc-initech-session"],
    ]);
  });

  test("when a name is taken, a new one can be tried without starting over", async ({ extension, slack, web }) => {
    await extension.setTeams(["acme", "globex"]);
    slack.rejectNextUpload("globex", "error_name_taken");
    const page = await extension.rightClickImage(web.url("small.png"), "team:acme");
    await waitForPreview(page);
    await page.getByLabel("globex.slack.com").check();
    await page.fill("#name", "shipit");
    await page.click("#submit");

    await expect(page.locator(".team.done")).toContainText("Added :shipit:");
    await expect(page.locator(".team.failed")).toContainText("That name is already taken.");
    await expect(page.locator("#submit")).toHaveText("Try again");

    await page.fill("#name", "shipit2");
    await addAndWaitForClose(page);

    // The workspace that already has the emoji isn't uploaded to a second time.
    expect(slack.uploads.map((upload) => [upload.team, upload.name])).toEqual([
      ["acme", "shipit"],
      ["globex", "shipit2"],
    ]);
  });

  test("a signed-out workspace offers a way to sign in, then the upload can be retried", async ({ extension, slack, web }) => {
    slack.signedOut.add("acme");
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("small.png"), "team:acme");
    await waitForPreview(page);
    await page.click("#submit");

    await expect(page.locator(".team.failed")).toContainText("You're not signed in to acme.slack.com.");
    await page.click(".team-sign-in");
    await expect.poll(() => extension.tabUrls()).toContain("https://acme.slack.com/");
    expect(slack.uploads).toHaveLength(0);

    slack.signedOut.delete("acme");
    await addAndWaitForClose(page);
    expect(slack.uploads).toHaveLength(1);
  });

  test("an unfamiliar Slack error is shown with its code", async ({ extension, slack, web }) => {
    await extension.setTeams(["acme"]);
    slack.rejectNextUpload("acme", "something_new");
    const page = await extension.rightClickImage(web.url("small.png"), "team:acme");
    await waitForPreview(page);
    await page.click("#submit");

    await expect(page.locator(".team.failed")).toContainText("Slack rejected the emoji (something_new).");
  });

  test("a name Slack wouldn't accept is caught before anything is uploaded", async ({ extension, slack, web }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("small.png"), "team:acme");
    await waitForPreview(page);
    await page.fill("#name", "what?!");
    await page.click("#submit");

    await expect(page.locator("#name-error")).toHaveText("Use only letters, numbers, dashes, and underscores.");
    expect(slack.uploads).toHaveLength(0);
  });

  test("Escape closes the window without uploading", async ({ extension, slack, web }) => {
    await extension.setTeams(["acme"]);
    const page = await extension.rightClickImage(web.url("small.png"), "team:acme");
    await waitForPreview(page);

    const closed = page.waitForEvent("close");
    // The key press closes the page it is sent to, so it may never be acknowledged.
    await page.keyboard.press("Escape").catch(() => {});
    await closed;
    expect(slack.uploads).toHaveLength(0);
  });
});

test.describe("slackmojis.com", () => {
  // The same markup slackmojis.com uses for each emoji in its lists.
  const SLACKMOJIS_PAGE = `<!doctype html>
    <ul class="emojis">
      <li class="emoji blob_smiley" title="blob_smiley">
        <a class="downloader" download="blob_smiley.png" href="/emojis/6917-blob_smiley/download">
          <div class="wrapper"><img loading="lazy" src="https://images.test/small.png?1643514689" /></div>
          <div class="name" title="blob_smiley - Added by jonathan">
            :blob_smiley:
          </div>
        </a>
      </li>
    </ul>`;

  test.beforeEach(async ({ context }) => {
    await context.route("https://slackmojis.com/**", (route) =>
      route.fulfill({ contentType: "text/html", body: SLACKMOJIS_PAGE }),
    );
  });

  test("clicking an emoji offers to add it to every workspace under its own name", async ({ context, extension, slack }) => {
    await extension.setTeams(["acme", "globex"]);
    const site = await context.newPage();
    await site.goto("https://slackmojis.com/");

    const page = await extension.pageOpenedBy(() => site.click(".name"));
    await waitForPreview(page);
    await expect(page.locator("#name")).toHaveValue("blob_smiley");
    await expect(page.locator(".team input:checked")).toHaveCount(2);
    await addAndWaitForClose(page);

    expect(slack.uploads.map((upload) => [upload.team, upload.name])).toEqual([
      ["acme", "blob_smiley"],
      ["globex", "blob_smiley"],
    ]);
    // The click was taken over, so the site's own download didn't start.
    expect(site.url()).toBe("https://slackmojis.com/");
  });

  test("clicking an emoji before any workspace is saved opens the options page", async ({ context, extension }) => {
    const site = await context.newPage();
    await site.goto("https://slackmojis.com/");

    await site.click(".name");
    await extension.waitForOptionsTab();
  });
});
