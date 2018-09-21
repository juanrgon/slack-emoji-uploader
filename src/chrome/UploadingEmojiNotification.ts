import * as generatedPrompts from '../prompts/generated';
import SlackTeam from '../models/SlackTeam';
import Emoji from '../models/Emoji';

export default class UploadEmojiNotification {
    notificationId: string;
    emojiName: string;
    team: SlackTeam;

    constructor(notificationId: string, team: SlackTeam, emojiName: string) {
        this.notificationId = notificationId
    }

    static create = (emojiName: string, team: SlackTeam): UploadEmojiNotification => {
        const prompt = generatedPrompts.uploadingEmoji(emojiName, team.name)
        const randomId = Math.random().toString(36).substring(2)
        const notificationOptions = {
            type: 'basic',
            title: 'Uploading Emoji',
            message: prompt,
        }
        chrome.notifications.create(randomId, notificationOptions);
        return new UploadEmojiNotification(randomId, team, emojiName);
    }

    updateToSuccess = (emoji: Emoji) => {
        const prompt = generatedPrompts.emojiSuccessfullyUploaded(emoji.name, this.team.name);
        const notificationOptions = {
            type: 'image',
            title: 'Emoji Upload Succeeded',
            message: prompt,
            iconUrl: URL.createObjectURL(emoji.blob),
        }
        chrome.notifications.update(this.notificationId, notificationOptions);
    }

    updateToFailure = () => {
        const prompt = generatedPrompts.failedToUploadEmoji(this.emojiName, this.team.name);
        const notificationOptions = {
            type: 'image',
            title: 'Emoji Upload Failed',
            message: prompt,
            iconUrl: 'failure.png',
        }
        chrome.notifications.update(this.notificationId, notificationOptions);
    }
}
