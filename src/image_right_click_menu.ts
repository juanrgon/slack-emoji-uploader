import * as chrome_extension from "./chrome_extension";
import * as slack_team from "./slack_team";

export const createAllButtons = async () =>  {
	chrome_extension.removeAllRightClickMenuButtons();

    // First remove all right click menu created by this extension
    const slack_teams = await slack_team.SlackTeam.loadFromBrowserStorage();

    slack_teams.forEach(team => {
        chrome_extension.addRightClickMenuButton(
            `add-emoji-to-${team.name}`,
            `Add emoji to ${team.name}`,
            ['image'],
            team.addEmoji
        )
    });
}
