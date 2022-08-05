import * as chrome_extension from "./chrome_extension";
import * as slack_team from "./slack_team";

export const createAllButtons = async () => {
  // First remove all right click menu buttons created by this extension
  chrome_extension.removeAllRightClickMenuButtons();

  const slack_teams = await slack_team.SlackTeam.loadFromBrowserStorage();

  slack_teams.forEach((team) => {
    chrome_extension.addRightClickMenuButton({
      id: `add-emoji-to-${team.name}`,
      title: `Add emoji to ${team.name}`,
      contexts: ["image"],
      onClick: team.addEmoji,
    });
  });
};
