import * as UI from '../scripts/UI';
import SlackTeam from '../models/SlackTeam';
import * as StoredTeams from './StoredTeams';

declare const Promise: any;  // Promises types seem to be broken

export const build = async () => {
    const teams: SlackTeam[] = await StoredTeams.getTeams();
    if (teams === []) {
        chrome.contextMenus.create({
            'title': 'Add emoji to slack',
            'contexts': ['image'],
            'onclick': UI.alertNoTeamEntered,
        });
    } else {
        teams.forEach(addTeam)
    }
}

const addTeam = async (team: SlackTeam) => {
    return await new Promise(
        chrome.contextMenus.create({
            id: team.name,
            title: `Add emoji to ${team}`,
            contexts: ['image'],
            onclick: UI.addEmoji,
        })
    );
}

const clear = (team: SlackTeam) => {
    chrome.contextMenus.removeAll();
}
