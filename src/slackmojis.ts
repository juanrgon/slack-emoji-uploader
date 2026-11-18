// Content script for slackmojis.com: clicking an emoji there offers to add
// it to Slack instead of downloading the file.

import type { AddSlackmojiMessage } from "./lib/messages";

document.addEventListener(
  "click",
  (event) => {
    // Leave modified clicks alone so the site's normal download is still reachable.
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (!(event.target instanceof Element)) return;

    // Listening on the document covers emoji the site loads in later, such as search results.
    const link = event.target.closest("a.downloader");
    const imageUrl = link?.querySelector("img")?.src;
    if (!link || !imageUrl) return;

    event.preventDefault();
    const name = link.querySelector(".name")?.textContent?.trim().replace(/^:|:$/g, "") ?? "";
    const message: AddSlackmojiMessage = { type: "add-slackmoji", name, imageUrl };
    // Sending fails if the extension was reloaded after this page opened; a refresh fixes that.
    chrome.runtime.sendMessage(message).catch(() => {});
  },
  true,
);
