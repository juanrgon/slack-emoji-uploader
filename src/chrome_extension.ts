/**
 * Module for controlling the chrome extension with the chrome API
 */

/**
 * Subscribe a function to run when the Chrome Extension is first installed
 */
export const onFirstInstall = (fn: () => void) => {
  chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "install") {
      fn();
    }
  });
};

/**
 * Subscribe a function to be called when the extension is updated
 */
export const onUpdate = (
  fn: (previousVersion: Version, currentVersion: Version) => void
) => {
  chrome.runtime.onInstalled.addListener(function (details) {
    if (details.reason == "update") {
      fn(
        Version.fromDottedString(details.previousVersion),
        Version.fromDottedString(chrome.runtime.getManifest().version)
      );
    }
  });
};

/**
 * Open the extension's options page
 */
export const openOptionsPage = chrome.runtime.openOptionsPage;

/**
 * Add a right click menu
 */
export const addRightClickMenuButton = ({
  id,
  title,
  contexts,
  onClick,
}: {
  id: string;
  title: string;
  contexts: Array<
    | "all"
    | "page"
    | "frame"
    | "selection"
    | "link"
    | "editable"
    | "image"
    | "video"
    | "audio"
    | "launcher"
    | "browser_action"
    | "page_action"
    | "action"
  >;
  onClick: (info, tab) => void;
}) => {
  chrome.contextMenus.create({
    title: title,
    contexts: contexts,
    id: id,
    onclick: onClick,
  });
};

/**
 * Remove all right click menus added by this extension
 */
export const removeAllRightClickMenuButtons = () => {
  chrome.contextMenus.removeAll();
};

/**
 * Represents a version of the chrome extension
 */
export class Version {
  constructor(
    public major: number,
    public minor: number,
    public patch: number
  ) {}

  static fromDottedString(dottedString: string) {
    let [major, minor, patch] = dottedString.split(".");
    return new Version(parseInt(major), parseInt(minor), parseInt(patch));
  }

  lessThan(other: Version) {
    return (
      [this.major, this.minor, this.patch] <
      [other.major, other.minor, other.patch]
    );
  }
}

export const storage = chrome.storage;
