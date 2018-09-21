import { onInstall, onUpdate, Version, thisVersion }  from '../versioning';
export default () => {
    chrome.runtime.onInstalled.addListener((details) => {
        if (details.reason == 'install') {
            onInstall();
        }
        else if (details.reason == 'update') {
            const prevVersion: Version = Version.fromString(details.previousVersion);
            onUpdate(prevVersion, thisVersion);
        }
    });
}
