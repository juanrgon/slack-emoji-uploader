import validateEmojiName from '../validators/emojiName';
import * as errorTypes from '../errors/types';
import * as prompts from '../prompts/static';


const askForEmojiName = (retry: boolean = false): string => {
    const message = retry ? prompts.INPUT_EMOJI_NAME : prompts.INPUT_EMOJI_NAME_AFTER_BLANK
    let name = prompt(message)
    if (name === '') {
        name = askForEmojiName(retry = true)
    }

    try {
        validateEmojiName(name)
    } catch (e) {
        if (e.name === errorTypes.INVALID_EMOJI_NAME) {
            console.error(e.reason);
            alert(e.help);
        }
    }

    return name
}
export default askForEmojiName;
