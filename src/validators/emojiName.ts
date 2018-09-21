import * as regexes from '../regexes';
import * as errors from '../errors/Emoji'

const validateEmojiName = (name: string) => {
    if (!name.match(regexes.validInputEmojiName)) {
        const reason = `doesn't match ${regexes.validInputEmojiName}`
        throw errors.invalidEmojiName(name, reason)
    }
}
export default validateEmojiName;
