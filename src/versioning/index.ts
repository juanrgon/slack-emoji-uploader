import onInstall from './onInstall';
import onUpdate from './onUpdate';
import Version from './Version';

const thisVersionString: string = chrome.runtime.getManifest().version;
export const thisVersion = Version.fromString(thisVersionString)

export { onInstall, onUpdate, Version }
