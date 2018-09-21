import Version from './Version';
import alertNewFeatures from '../ui/alertNewFeatures';

export default (prevVersion: Version, thisVersion: Version) => {
    const handlersToCall = (
        versionChangeHandlers
        .filter(vch => (
            vch.version.newerThan(prevVersion) && vch.version.lessThanOrEqualTo(thisVersion)
        ))
    )
    handlersToCall.forEach(vch => vch.handler(handlersToCall))

    let notableFeatures: string[];
    handlersToCall
    .forEach(vch => notableFeatures.concat(vch.notableFeatures))

    if (notableFeatures !== []) {
        alertNewFeatures(notableFeatures);
    }
    chrome.runtime.openOptionsPage();
}

/**
 * Move from multiple teams
 *
 * Prior to 1.3.0, only one team was stored in chrome.storage.sync under the key "team_domain".
 * With 1.3.0, multiple teams were supported. This was handled by storing team names under the key "teamDomains".
 * This functions copies and removes the value under "tram_domain" to "teamDomains"
 */
const moveToMultipleTeams = () => {
    chrome.storage.sync.get({ 'team_domain': null }, function (items) {
        if (items.team_domain !== null) {
            chrome.storage.sync.set({ 'teamDomains': [items.team_domain] });
        }
        chrome.storage.sync.remove('team_domain');
    });
    chrome.runtime.openOptionsPage();
}

/**
 * Move from multiple teams
 *
 * This functions copies and removes the value under "tram_domain" to "teamDomains"
 */
const renameTeamsStorageKey = () => {
    chrome.storage.sync.get({ 'team_domain': null }, function (items) {
        if (items.team_domain !== null) {
            chrome.storage.sync.set({ 'teamDomains': [items.team_domain] });
        }
        chrome.storage.sync.remove('team_domain');
    });
    chrome.runtime.openOptionsPage();
}


/**
 * Handles update to 1.3.0
 */
const to_1_3_0 = (otherHandlers: VersionChangeHandler[]) => {
    moveToMultipleTeams()
    alert('Slack Emoji Uploader now supports multiple teams!');
}

/**
 * Handles update to 1.4.0
 *
 * "teamDomains" key in chrome.storage.sync is moved to 
*/
const to_1_4_0 = () => {
    chrome.storage.sync.get({ 'team_domain': null }, function (items) {
        if (items.team_domain !== null) {
            chrome.storage.sync.set({ 'teamDomains': [items.team_domain] });
        }
        chrome.storage.sync.remove('team_domain');
    });
}

class VersionChangeHandler {
    version: Version
    handler: Function
    notableFeatures: string[]

    constructor(versionString: string, handler: Function, notableFeatures: string[] = []) {
        this.version = Version.fromString(versionString);
        this.handler = handler;
        this.notableFeatures = notableFeatures;
    }
}

/**
 * Mapping of versions to functions that handle breaking versions
 */
const versionChangeHandlers = [
    new VersionChangeHandler('1.3.0', to_1_3_0, ['Support for multiple teams has been added!']),
    new VersionChangeHandler('1.4.0', to_1_4_0),
]
