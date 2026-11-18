# Contributing to Slack Emoji Uploader

## Setup

```bash
git clone https://github.com/juanrgon/slack-emoji-uploader.git
cd slack-emoji-uploader
npm install
```

Node 20.11 or newer is required.

## Running the extension

```bash
npm run watch
```

This bundles the TypeScript in `src/` into `dist/` and rebuilds when files change. To load it in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode**.
2. Click **Load unpacked** and choose the `dist` folder.
3. After a rebuild, click the reload button on the extension's card.

`npm run build` makes a one-off build, and `npm run zip` builds and packs `dist/` into `slack-emoji-uploader.zip` for the Chrome Web Store.

## How the code is laid out

| Path | What it is |
| --- | --- |
| `src/manifest.json` | The Manifest V3 extension manifest. |
| `src/background.ts` | Service worker: the right-click menu, the toolbar button, and opening the "add emoji" window. |
| `src/add.{html,css,ts}` | The "add emoji" window: preview, name, upload. |
| `src/options.{html,css,ts}` | The options page with the list of workspaces. |
| `src/slackmojis.ts` | Content script for slackmojis.com. |
| `src/lib/prepare.ts` | Turns any image into one Slack accepts. Decoding and scaling use browser APIs. |
| `src/lib/gif-encode.ts` | Writes animated GIFs (palette, frame differences, timing). |
| `src/lib/slack.ts` | Talks to Slack using the browser's signed-in session. |
| `src/lib/storage.ts` | Saved workspaces and requests passed to the "add emoji" window. |

A service worker has no page, so anything that needs a canvas, an image decoder or user input happens in the "add emoji" window instead.

## Checks

```bash
npm run typecheck   # TypeScript
npm test            # unit tests (Vitest)
npm run test:e2e    # builds, then runs the extension in headless Chromium (Playwright)
```

The end-to-end tests load the real extension and replace the network with fakes: a pretend Slack that records uploads, and a pretend web server for images. Uploaded files are decoded with Chrome's own image decoder to check their size, frames and timing.

They need a Chromium to run in. Either install Playwright's with `npx playwright install chromium`, or point at one you already have:

```bash
CHROMIUM_PATH=/usr/lib/chromium/chromium npm run test:e2e
```

Use the browser binary itself for `CHROMIUM_PATH`. A launcher script that adds its own flags (as some Linux distributions ship at `/usr/bin/chromium`) can crash the headless browser.

## Submitting changes

1. Create a branch for your change.
2. Make sure the checks above pass.
3. Open a pull request describing what changed and why.

## Reporting issues

If you find a bug or have a suggestion, please open an issue on GitHub.
