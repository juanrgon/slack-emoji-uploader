const extensionName = chrome.runtime.getManifest().name;
const supportEmail = 'slack.emoji.uploader@gmail.com'

export const INPUT_EMOJI_NAME = 'Give your emoji a name!'
export const INPUT_EMOJI_NAME_AFTER_BLANK = 'Emoji name cannot be blank! Try again.'
export const CANNOT_CONVERT_IMAGE_TO_AN_EMOJI = `${extensionName} cannot convert this image to an emoji. To report this error, please email ${supportEmail}`
export const EXTENSION_UPDATED_MESSAGE_HEADER = `${extensionName} has been updated!`
