// Promisify chrome.storage.sync.get
function getStorageSync(keys: Record<string, any>) {
  console.debug("Calling getStorageSync with keys:", keys);
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(keys, (items) => {
      if (chrome.runtime.lastError) {
        console.error("Error in getStorageSync:", chrome.runtime.lastError);
        return reject(chrome.runtime.lastError);
      }
      console.debug("getStorageSync resolved with items:", items);
      resolve(items);
    });
  });
}

// Promisify chrome.storage.sync.set
function setStorageSync(items: Record<string, any>) {
  console.debug("Calling setStorageSync with items:", items);
  return new Promise<void>((resolve, reject) => {
    chrome.storage.sync.set(items, () => {
      if (chrome.runtime.lastError) {
        console.error("Error in setStorageSync:", chrome.runtime.lastError);
        return reject(chrome.runtime.lastError);
      }
      console.debug("setStorageSync resolved successfully");
      resolve();
    });
  });
}

// Promisify chrome.storage.sync.remove
function removeStorageSync(keys: string | string[]) {
  console.debug("Calling removeStorageSync with keys:", keys);
  return new Promise<void>((resolve, reject) => {
    chrome.storage.sync.remove(keys, () => {
      if (chrome.runtime.lastError) {
        console.error("Error in removeStorageSync:", chrome.runtime.lastError);
        return reject(chrome.runtime.lastError);
      }
      console.debug("removeStorageSync resolved successfully");
      resolve();
    });
  });
}

// Promisify chrome.extension.isAllowedFileSchemeAccess
function isAllowedFileSchemeAccess() {
  console.debug("Calling isAllowedFileSchemeAccess");
  return new Promise((resolve) => {
    chrome.extension.isAllowedFileSchemeAccess((isAllowed) => {
      console.debug("isAllowedFileSchemeAccess resolved with:", isAllowed);
      resolve(isAllowed);
    });
  });
}

// Promisify chrome.contextMenus.removeAll
function removeAllContextMenus() {
  console.debug("Calling removeAllContextMenus");
  return new Promise<void>((resolve, reject) => {
    chrome.contextMenus.removeAll(() => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error in removeAllContextMenus:",
          chrome.runtime.lastError
        );
        return reject(chrome.runtime.lastError);
      }
      console.debug("removeAllContextMenus resolved successfully");
      resolve();
    });
  });
}

type ValidationResult<T> = {
  success: boolean;
  data?: T;
  errors?: string[];
};

function validate<T>(
  schema: Record<keyof T, (value: unknown) => string | undefined>,
  data: unknown
): ValidationResult<T> {
  if (typeof data !== "object" || data === null) {
    return { success: false, errors: ["Invalid input: expected an object"] };
  }

  const errors: string[] = [];
  const validatedData: Partial<T> = {};
  for (const [key, validator] of Object.entries(schema) as [
    keyof T,
    (value: unknown) => string | undefined
  ][]) {
    const error = validator((data as any)[key]);
    if (error) {
      errors.push(error);
    } else {
      validatedData[key] = (data as any)[key];
    }
  }

  if (errors.length > 0) {
    return { success: false, errors };
  }

  return { success: true, data: validatedData as T };
}

const oldStorageSchema = {
  team_domain: (value: unknown) =>
    typeof value === "string" || value === null
      ? undefined
      : "team_domain must be a string or null",
};

const storageSchema = {
  teamDomains: (value: unknown) =>
    (Array.isArray(value) && value.every((item) => typeof item === "string")) ||
    value === null
      ? undefined
      : "teamDomains must be an array of strings or null",
};

type OldStorage = {
  team_domain: string | null;
};

// Main initialization function
(async function () {
  console.debug("Starting main initialization function");
  try {
    const items = await getStorageSync({ teamDomains: null });
    const validationResult = validate<Storage>(storageSchema, items);
    if (!validationResult.success) {
      throw new Error(
        `Invalid storage data: ${validationResult.errors?.join(", ")}`
      );
    }
    const teams = validationResult.data?.teamDomains;
    console.log("Slack Teams", teams);
    if (teams === null) {
      console.debug("No teams found, creating default context menu");
      chrome.contextMenus.create({
        title: "Add emoji to slack",
        contexts: ["image"],
        onclick: alertNoTeamEntered,
      });
    } else {
      console.debug("Teams found, updating right-click menu");
      await updateRightClickMenu(teams);
    }
  } catch (error) {
    console.error("Error initializing extension:", error);
  }
})();

/**
 * Redirects to the extension options page to enter a team
 */
function alertNoTeamEntered() {
  console.debug("Alerting user about no team entered");
  alert("Oops. No Slack team was entered.");
  chrome.runtime.openOptionsPage();
}

async function updateRightClickMenu(teams: string[]) {
  console.debug("Updating right-click menu with teams:", teams);
  try {
    await removeAllContextMenus();
    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      console.log("adding menu", team);
      chrome.contextMenus.create({
        title: "Add emoji to " + team,
        contexts: ["image"],
        id: team,
        onclick: slack_add_emoji,
      });
    }
    console.debug("Right-click menu updated successfully");
  } catch (error) {
    console.error("Error updating context menu:", error);
  }
}

chrome.runtime.onInstalled.addListener(async function (details) {
  console.debug("onInstalled event triggered with details:", details);
  try {
    if (details.reason == "install") {
      console.debug("New installation detected, opening options page");
      chrome.runtime.openOptionsPage();
    } else if (details.reason == "update") {
      const prevVersionString = details.previousVersion;
      const versionString = chrome.runtime.getManifest().version;

      const [major, minor, patch] = versionString.split(".").map(Number);
      const [pMajor, pMinor, pPatch] =
        prevVersionString?.split(".").map(Number) ?? [];

      const previousVersion = [pMajor, pMinor, pPatch];

      console.debug(
        "Update detected. Previous version:",
        previousVersion,
        "Current version:",
        [major, minor, patch]
      );

      // structure of slack team name storage changed in 1.3.0
      if (
        previousVersion[0] < 1 ||
        (previousVersion[0] === 1 && previousVersion[1] < 3)
      ) {
        console.debug(
          "Updating from pre-1.3.0 version, migrating team storage"
        );
        const items = await getStorageSync({ team_domain: null });
        const validationResult = validate<OldStorage>(oldStorageSchema, items);
        if (!validationResult.success) {
          throw new Error(
            `Invalid old storage data: ${validationResult.errors?.join(", ")}`
          );
        }
        if (validationResult.data?.team_domain !== null) {
          await setStorageSync({
            teamDomains: [validationResult.data?.team_domain],
          });
        }
        await removeStorageSync("team_domain");

        alert("Slack Emoji Uploader now supports multiple teams!");
        chrome.runtime.openOptionsPage();
      }

      // Compatibility changes to slack api in 1.3.3
      if (
        previousVersion[0] < 1 ||
        (previousVersion[0] === 1 && previousVersion[1] < 3) ||
        (previousVersion[0] === 1 &&
          previousVersion[1] === 3 &&
          previousVersion[2] < 3)
      ) {
        console.debug(
          "Updating from pre-1.3.3 version, showing critical bug fix alert"
        );
        alert("Critical bug in Slack Emoji Uploader now fixed!");
      }
    }
  } catch (error) {
    console.error("Error during onInstalled:", error);
  }
});

chrome.runtime.onMessage.addListener(async function (request, sender) {
  console.debug("Message received:", request, "from sender:", sender);
  if (sender.tab) {
    const tab_url = sender.tab.url;
    const re = /^http(s)?:\/\/(www\.)?slackmojis\.com\/?.*$/;
    if (tab_url && re.test(tab_url)) {
      console.log("Retrieved request to add emoji from " + tab_url);
      console.log("Request " + JSON.stringify(request));
      try {
        const response = await fetch(request.emojiUrl);
        if (!response.ok) {
          console.error(
            "Failed to fetch emoji:",
            response.status,
            response.statusText
          );
          alert_internet_disconnect();
          return;
        }
        console.log("Downloading slackmoji image.");
        const emoji_blob = await response.blob();
        const items = await getStorageSync({ teamDomains: null });
        const validationResult = validate<Storage>(storageSchema, items);
        if (!validationResult.success) {
          throw new Error(
            `Invalid storage data: ${validationResult.errors?.join(", ")}`
          );
        }
        const teams = validationResult.data?.teamDomains;
        if (teams !== null) {
          for (let i = 0; i < teams.length; i++) {
            const teamName = teams[i];
            console.debug("Uploading emoji to team:", teamName);
            await uploadEmoji(teamName, request.emojiName, emoji_blob);
          }
        }
      } catch (err) {
        console.error("Error fetching emoji:", err);
        alert_internet_disconnect();
      }
    }
  } else {
    console.debug("Updating right-click menu with new teams");
    updateRightClickMenu(request);
  }
});

async function slack_add_emoji(
  info: chrome.contextMenus.OnClickData,
  tab: chrome.tabs.Tab
) {
  console.debug("slack_add_emoji called with info:", info, "and tab:", tab);
  let emoji_name = null;
  let prompt_message = "Give your emoji a name.";
  do {
    emoji_name = prompt(prompt_message);
    console.debug("User entered emoji name:", emoji_name);
    if (emoji_name === "") {
      prompt_message = "Emoji name can't be blank! Try again.";
    }
  } while (emoji_name === "");
  if (emoji_name !== null) {
    const valid_name = validate_emoji_name(emoji_name);
    if (!valid_name) {
      console.debug("Invalid emoji name entered:", emoji_name);
      alert(
        '"' +
          emoji_name +
          '" is an invalid name. Only use letters, numbers, dashes, spaces, and underscores. You must also include at least one non-space character.'
      );
    } else {
      emoji_name = remove_whitespace(emoji_name);
      emoji_name = emoji_name.toLowerCase();
      console.log("Emoji name:" + emoji_name);
      const image_url = info.srcUrl;
      const teamName = info.menuItemId;
      console.debug(
        "Uploading image for team:",
        teamName,
        "with emoji name:",
        emoji_name
      );

      if (typeof image_url !== "string") {
        console.error("Invalid image URL:", image_url);
        return;
      }

      if (typeof teamName !== "string") {
        console.error("Invalid team name:", teamName);
        return;
      }

      await upload_image(teamName, image_url, emoji_name);
    }
  }
}

function remove_whitespace(emoji_name: string) {
  console.debug("Removing whitespace from emoji name:", emoji_name);
  const parts = emoji_name.split(" ");
  const new_parts = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== "" && parts[i] !== " ") {
      new_parts.push(parts[i]);
    }
  }
  const result = new_parts.join("-");
  console.debug("Emoji name after whitespace removal:", result);
  return result;
}

function validate_emoji_name(emoji_name: string) {
  console.debug("Validating emoji name:", emoji_name);
  const japanese =
    "\u3041-\u3096\u30A0-\u30FF\u3400-\u4DB5\u4E00-\u9FCB\uF900-\uFA6A";
  const allowed_chars = `a-zA-Z0-9-_${japanese}`;
  const re = new RegExp(
    `^[${allowed_chars} ]*[${allowed_chars}]+[${allowed_chars} ]*$`,
    "u"
  );
  const isValid = emoji_name.match(re) !== null;
  console.debug("Emoji name validation result:", isValid);
  return isValid;
}

async function upload_image(
  teamName: string,
  image_url: string,
  emoji_name: string
) {
  console.debug(
    "Uploading image for team:",
    teamName,
    "with URL:",
    image_url,
    "and emoji name:",
    emoji_name
  );
  try {
    const url_parser = document.createElement("a");
    url_parser.href = image_url;
    let img_el: HTMLImageElement;
    if (url_parser.protocol === "data:" || url_parser.protocol === "file:") {
      if (url_parser.protocol === "file:") {
        const isAllowedAccess = await isAllowedFileSchemeAccess();
        console.debug("File scheme access allowed:", isAllowedAccess);
        if (!isAllowedAccess) {
          alert(
            'You must check "Allow access to file URLs" to upload local images opened in chrome.'
          );
          chrome.runtime.openOptionsPage();
          return;
        }
      }
      console.log("Interpreting data url.");
      img_el = await loadImage(image_url);
    } else {
      const response = await fetch(image_url);
      const blob = await response.blob();
      console.debug("Fetched image blob type:", blob.type);
      if (blob.type === "image/gif") {
        alert("GIFs are not supported.");
        return;
      } else {
        img_el = await loadImage(URL.createObjectURL(blob));
      }
    }
    const canvas = img_to_canvas(img_el);
    const emoji_sized_canvas = emoji_sized(canvas);
    const emoji_blob = await new Promise<Blob | null>((resolve) => {
      emoji_sized_canvas.toBlob(resolve);
    });
    console.log("canvas is now a blob");

    if (emoji_blob === null) {
      console.error("Failed to convert canvas to blob");
      return;
    }

    await uploadEmoji(teamName, emoji_name, emoji_blob);
  } catch (error) {
    console.error("Error uploading image:", error);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  console.debug("Loading image from source:", src);
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      console.debug("Image loaded successfully");
      resolve(img);
    };
    img.onerror = (error) => {
      console.error("Error loading image:", error);
      reject(error);
    };
    img.src = src;
  });
}

function alert_internet_disconnect() {
  console.debug("Alerting user about internet disconnection");
  alert(
    "Woah. I got disconnected from the internet. Are you sure you're connected?"
  );
}

function emoji_dimensions(width: number, height: number) {
  console.debug(
    "Calculating emoji dimensions for width:",
    width,
    "and height:",
    height
  );
  const MAX_SIDE_LENGTH = 128;
  // Get the larger side
  const long_side = Math.max(height, width);
  let scale;
  // If the image is between 95% to 100% of the target
  // emoji size, don't adjust its size.
  if (long_side >= 0.95 * MAX_SIDE_LENGTH && long_side <= MAX_SIDE_LENGTH) {
    scale = 1;
  } else {
    scale = MAX_SIDE_LENGTH / long_side;
  }
  const result = {
    height: height * scale,
    width: width * scale,
  };
  console.debug("Calculated emoji dimensions:", result);
  return result;
}

function img_to_canvas(img: HTMLImageElement) {
  console.debug(
    "Converting image to canvas. Image dimensions:",
    img.width,
    "x",
    img.height
  );
  const canvas = document.createElement("canvas");
  canvas.width = img.width;
  canvas.height = img.height;
  const canvas_ctx = canvas.getContext("2d");

  if (canvas_ctx === null) {
    throw new Error("Failed to get canvas context");
  }

  canvas_ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function emoji_sized(canvas: HTMLCanvasElement) {
  console.debug(
    "Resizing canvas to emoji size. Current dimensions:",
    canvas.width,
    "x",
    canvas.height
  );
  const target_dim = emoji_dimensions(canvas.width, canvas.height);
  const factor = 2;
  const canvas_long_side = Math.max(canvas.width, canvas.height);
  const target_long_side = Math.max(target_dim.width, target_dim.height);
  const new_canvas = document.createElement("canvas");
  const new_canvas_ctx = new_canvas.getContext("2d");
  if (target_long_side === canvas_long_side) {
    console.debug("Canvas already at target size");
    // Return the image.
    return canvas;
  } else if (target_long_side > canvas_long_side * factor) {
    console.debug("Increasing canvas size");
    // Increase the size of the image and then resize the result.
    new_canvas.width = canvas.width * factor;
    new_canvas.height = canvas.height * factor;
    if (new_canvas_ctx === null) {
      throw new Error("Failed to get canvas context");
    }
    new_canvas_ctx.drawImage(canvas, 0, 0, new_canvas.width, new_canvas.height);
    return emoji_sized(new_canvas);
  } else if (canvas_long_side > target_long_side * factor) {
    console.debug("Decreasing canvas size");
    // Half the size of the image and then resize the result.
    new_canvas.width = canvas.width / factor;
    new_canvas.height = canvas.height / factor;
    if (new_canvas_ctx === null) {
      throw new Error("Failed to get canvas context");
    }
    new_canvas_ctx.drawImage(canvas, 0, 0, new_canvas.width, new_canvas.height);
    return emoji_sized(new_canvas);
  } else {
    // Resize the image in one shot
    new_canvas.width = target_dim.width;
    new_canvas.height = target_dim.height;
    if (new_canvas_ctx === null) {
      throw new Error("Failed to get canvas context");
    }
    new_canvas_ctx.drawImage(canvas, 0, 0, new_canvas.width, new_canvas.height);
    return new_canvas;
  }
}

async function uploadEmoji(
  teamName: string,
  emojiName: string,
  emojiBlob: Blob
) {
  const teamUrl = `https://${teamName}.slack.com`;
  const iconUrl = URL.createObjectURL(emojiBlob);
  if (teamName === null) {
    alert("Oops. No Slack team was entered.");
    chrome.runtime.openOptionsPage();
    return;
  }
  chrome.notifications.create({
    type: "basic",
    title: `Uploading`,
    message: `Adding :${emojiName}:...`,
    iconUrl: iconUrl,
  });
  try {
    const response = await fetch(`${teamUrl}/customize/emoji`);
    const html = await response.text();
    let apiToken;
    try {
      apiToken = /("|')?api_token("|')?:"([\w|-]+)"/.exec(html)?.[3];
    } catch (err) {
      if (err instanceof Error && err.message.includes("Cannot read property")) {
        // Assume the user isn't logged in
        throw {
          message: `Please log in to ${teamName}`,
          type: "not-logged-in",
        };
      } else {
        throw err;
      }
    }

    if (!apiToken) {
      throw new Error("Failed to find API token");
    }

    const formData = new FormData();
    formData.set("name", emojiName);
    formData.set("image", emojiBlob);
    formData.set("mode", "data");
    formData.set("token", apiToken);

    const addResponse = await fetch(`${teamUrl}/api/emoji.add`, {
      method: "POST",
      body: formData,
    });
    const json = await addResponse.json();
    if (!json["ok"]) {
      const errorReasons = {
        error_name_taken: "An emoji with that name already exists",
      } as const;
      const reason = errorReasons[json["error"] as keyof typeof errorReasons] || json["error"];
      throw new Error(reason);
    }
    chrome.notifications.create({
      type: "basic",
      title: "Success!",
      message: `:${emojiName}: added to ${teamName}!`,
      iconUrl: iconUrl,
    });
  } catch (err: any) {
    if (err instanceof Error && err.message === "Failed to fetch") {
      err.message = "Got disconnected from the internet";
    }

    const msg = `Failed to add :${emojiName}: \n${err.message}`;
    if (err.type === "not-logged-in") {
      chrome.tabs.create({ url: teamUrl });
    }
    console.log("updating notification");
    chrome.notifications.create({
      type: "basic",
      title: "Failure",
      message: msg,
      iconUrl: "failure.png",
    });
  }
}
