[![Chrome Web Store](https://img.shields.io/chrome-web-store/stars/jfacjbibcobdehekkieokkloinlfdomg.svg)]()

# Chrome Extension for Custom Slack Emojis

The best way to add custom slack emojis! :tada:

Click [here](https://chrome.google.com/webstore/detail/slack-emoji-uploader/jfacjbibcobdehekkieokkloinlfdomg) to download the extension.

## Using it

1. Open the extension's options and list your Slack workspaces (the part of the address before `.slack.com`).
2. Right-click any image on the web and choose **Add emoji to _your workspace_**.
3. A small window shows how the emoji will look. Give it a name and press Enter.

You need to be signed in to the workspace in the same browser. On [slackmojis.com](https://slackmojis.com), clicking an emoji opens the same window with the name already filled in.

Clicking the extension's toolbar button opens each workspace's emoji page.

## Images and GIFs

Slack wants emoji to be at most 128 × 128 pixels and 128 KB, and animated ones to have at most 50 frames. The extension gets any image there by itself:

- Still images (PNG, JPEG, WebP, AVIF, SVG, and anything else Chrome can show) are scaled down and uploaded as PNG.
- Animated GIFs are resized frame by frame. If the result is still too big, the extension tries fewer colours, then smaller dimensions, then fewer frames, and keeps the first version that fits. Timing, looping and transparency are kept.
- Animated WebP, AVIF and PNG files are converted to animated GIFs.
- Images that already fit Slack's limits are uploaded untouched.

All of this happens inside the browser. The image is never sent anywhere except to Slack.

## Permissions

- **Read and change your data on all websites**: needed to download the image you right-clicked, whichever site hosts it, and to upload it to your Slack workspace using your signed-in session.
- **Allow access to file URLs** (optional, off by default): turn this on in the extension's details page to add images opened from your computer.

## Development

See [CONTRIBUTING.md](CONTRIBUTING.md).
