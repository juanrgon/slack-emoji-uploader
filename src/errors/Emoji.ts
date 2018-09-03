import newError from './index';
import * as ErrorNames from './names';

export const invalidEmojiUrlProtocol = (protocol: string) => {
    return newError(ErrorNames.INVALID_EMOJI_URL_PROTOCOL, `Invalid emoji url protocol: ${protocol}`)
}
