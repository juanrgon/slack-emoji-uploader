import * as chrome_extension from "./chrome_extension";
import * as slack_team from "./slack_team";

export const createAllButtons = async () => {
  // First remove all right click menu buttons created by this extension
  chrome_extension.removeAllRightClickMenuButtons();

  // load slack teams from browser storage
  const slack_teams = await slack_team.SlackTeam.loadFromBrowserStorage();

  // if no slack teams exist, create a button that will send the user to the
  // options page to enter a slack team...
  if (slack_teams.length === 0) {
    chrome_extension.addRightClickMenuButton({
      id: "send-to-options-page-to-add-a-slack-team",
      title: "Add emoji to slack",
      contexts: ["image"],
      onClick: () => {
        alert('Oops. No Slack team was entered.');
        chrome_extension.openOptionsPage();
      },
    });
  }

  // ...else create a right click menu button for each slack team
  slack_teams.forEach((team) => {
    chrome_extension.addRightClickMenuButton({
      id: `add-emoji-to-${team.name}`,
      title: `Add emoji to ${team.name}`,
      contexts: ["image"],
      onClick: team.addEmoji,
    });
  });
};
