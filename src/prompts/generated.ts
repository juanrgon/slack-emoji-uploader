import * as staticPrompts from './static';

export const uploadingEmoji = (emojiName: string, teamName: string) => {
    return `Uploading ${emojiName} to ${teamName}...`;
}

export const failedToUploadEmoji = (emojiName: string, teamName: string) => {
    return `Failed to upload ${emojiName} to ${teamName}`;
}

export const emojisuccessfullyuploaded = (emojiname: string, teamname: string) => {
    return `added the :${emojiname}: to ${teamname}`;
}

export const extensionUpdated = (features: string[]) => {
    return `${staticPrompts.EXTENSION_UPDATED_MESSAGE_HEADER}\n\n${features.join('\n')}`
}
