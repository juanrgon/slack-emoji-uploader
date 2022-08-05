import * as chrome_extension from "./chrome_extension";

export const onUpdate = (
    previousVersion: chrome_extension.Version,
    currentVersion: chrome_extension.Version
) => {

    const V_1_3_0 = new chrome_extension.Version(1, 3, 0);
    if (previousVersion.lessThan(V_1_3_0)) {
        V_1_3_0__support_multiple_teams();
    }
};

/**
 * Structure of slack team name storage changed in 1.3.0 to support multiple teams.
 */
const V_1_3_0__support_multiple_teams = () => {
    chrome.storage.sync.get({ 'team_domain': null }, function (items) {
        if (items.team_domain !== null) {
            chrome.storage.sync.set({ 'teamDomains': [items.team_domain] });
        }
        chrome.storage.sync.remove('team_domain');
    });

    alert('Slack Emoji Uploader now supports multiple teams!');
    chrome.runtime.openOptionsPage();
}
