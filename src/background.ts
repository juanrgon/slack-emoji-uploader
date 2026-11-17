// Service worker. It owns the right-click menu and the toolbar button, and
// opens the "add emoji" window where the image is resized and uploaded.

import { normalizeEmojiName, suggestEmojiName } from "./lib/emoji-name";
import { isAddSlackmojiMessage } from "./lib/messages";
import { emojiPageUrl } from "./lib/slack";
import { getTeams, migrateLegacyTeam, onTeamsChanged, savePending, type PendingEmoji } from "./lib/storage";

const SETUP_MENU_ID = "setup";
const TEAM_MENU_PREFIX = "team:";
const ADD_WINDOW = { width: 420, height: 560 };

function createMenuItem(properties: chrome.contextMenus.CreateProperties): Promise<void> {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(properties, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
}

/** Rebuilds the image right-click menu: one entry per saved workspace. */
async function rebuildMenus(): Promise<void> {
  const teams = await getTeams();
  await chrome.contextMenus.removeAll();
  if (teams.length === 0) {
    await createMenuItem({ id: SETUP_MENU_ID, title: "Add emoji to Slack", contexts: ["image"] });
  }
  for (const team of teams) {
    await createMenuItem({ id: TEAM_MENU_PREFIX + team, title: `Add emoji to ${team}`, contexts: ["image"] });
  }
}

// Rebuilds can be triggered by several events at once; run them one after
// another so two of them never interleave their remove and create calls.
let menusReady: Promise<void> = Promise.resolve();
function refreshMenus(): Promise<void> {
  menusReady = menusReady.then(rebuildMenus).catch((error) => console.error("Could not update menus", error));
  return menusReady;
}

async function openAddWindow(pending: PendingEmoji, openerWindowId?: number): Promise<void> {
  const id = await savePending(pending);
  const options: chrome.windows.CreateData = {
    url: chrome.runtime.getURL(`add.html?id=${id}`),
    type: "popup",
    focused: true,
    ...ADD_WINDOW,
  };
  try {
    await chrome.windows.create({ ...options, ...(await centeredOver(openerWindowId)) });
  } catch {
    // Chrome refuses positions that are mostly off screen; let it pick one instead.
    await chrome.windows.create(options);
  }
}

async function centeredOver(windowId?: number): Promise<{ left?: number; top?: number }> {
  if (windowId === undefined) return {};
  const { left, top, width, height } = await chrome.windows.get(windowId);
  if (left === undefined || top === undefined || width === undefined || height === undefined) return {};
  return {
    left: Math.round(left + (width - ADD_WINDOW.width) / 2),
    top: Math.round(top + (height - ADD_WINDOW.height) / 2),
  };
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  if (reason === "update") await migrateLegacyTeam();
  await refreshMenus();
  // A fresh install has no workspaces yet, so start on the options page. It
  // gets a tab of its own rather than taking over whichever tab is open.
  if (reason === "install") await chrome.tabs.create({ url: chrome.runtime.getURL("options.html") });
});

chrome.runtime.onStartup.addListener(refreshMenus);
onTeamsChanged(refreshMenus);

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const menuId = String(info.menuItemId);
  if (!menuId.startsWith(TEAM_MENU_PREFIX) || !info.srcUrl) {
    await chrome.runtime.openOptionsPage();
    return;
  }
  await openAddWindow(
    {
      imageUrl: info.srcUrl,
      teams: [menuId.slice(TEAM_MENU_PREFIX.length)],
      suggestedName: suggestEmojiName(info.srcUrl),
    },
    tab?.windowId,
  );
});

// Clicking the toolbar button opens each workspace's emoji page.
chrome.action.onClicked.addListener(async () => {
  const teams = await getTeams();
  if (teams.length === 0) {
    await chrome.runtime.openOptionsPage();
    return;
  }
  await Promise.all(teams.map((team) => chrome.tabs.create({ url: emojiPageUrl(team) })));
});

chrome.runtime.onMessage.addListener((message: unknown, sender) => {
  if (!isAddSlackmojiMessage(message) || !/^https?:/.test(message.imageUrl)) return;
  void (async () => {
    const teams = await getTeams();
    if (teams.length === 0) {
      await chrome.runtime.openOptionsPage();
      return;
    }
    await openAddWindow(
      { imageUrl: message.imageUrl, teams, suggestedName: normalizeEmojiName(message.name) },
      sender.tab?.windowId,
    );
  })();
});
