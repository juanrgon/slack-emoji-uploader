import SlackTeam from '../models/SlackTeam';

declare const Promise: any;  // Promise types seem to be broken


export const getTeams = async (defaultValue?: SlackTeam[]) => {
    const items: string[] = await new Promise(
        (resolve: Function) => {
            chrome.storage.sync.get(
                { 'teamNames': defaultValue || [] },
                items => resolve(items.teamNames)
            )
        }
    );
    const teams = items.map(name => new SlackTeam(name));
    return teams;
}

export const updateTeams = async (teams: SlackTeam[]) => {
    const teamNames = teams.map(team => team.name);
    return await new Promise(
        (resolve: Function) => {
            chrome.storage.sync.set(
                { 'teamNames': teamNames },
                resolve()
            )
        }
    );
}
