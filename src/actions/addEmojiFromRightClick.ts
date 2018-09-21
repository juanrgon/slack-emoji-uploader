import * as errorTypes from '../errors/types'
import Emoji from '../models/Emoji';
import askForEmojiName from '../ui/askForEmojiName';
import alertCantConvertToEmoji from '../ui/alertCantConvertToEmoji';
import SlackTeam from '../models/SlackTeam';
import RightClickMenuInfo from '../interfaces/RightClickMenuInfo'
import UploadingEmojiNotification from '../chrome/UploadingEmojiNotification';

export default async (info: RightClickMenuInfo, tab: chrome.tabs.Tab) => {
    const name = askForEmojiName();
    const teamName = info.menuItemId;
    const team = new SlackTeam(teamName);
    const url = info.srcUrl;

    let uploadedEmoji: Emoji;
    const notification = UploadingEmojiNotification.create(name, team);
    try {
        uploadedEmoji = await team.addEmoji(name, url)
    } catch (e) {
        switch (e.name) {
            case errorTypes.INVALID_EMOJI_URL_PROTOCOL: {
                alertCantConvertToEmoji();
            }
            default: {
                notification.updateToFailure();
            }
        }
        console.error(e.reason);
        return false;
    }

    notification.updateToSuccess(uploadedEmoji)
    return true;
}
