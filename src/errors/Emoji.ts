import newError from './index';
import * as ErrorNames from './types';

export const invalidEmojiUrlProtocol = (protocol: string) => {
    return newError(ErrorNames.INVALID_EMOJI_URL_PROTOCOL, `Invalid emoji url protocol: ${protocol}`)
}

export const invalidEmojiName = (name: string, reason: string) => {
    return newError(
        ErrorNames.INVALID_EMOJI_NAME,
        `Invalid emoji name, "${name}": ${reason}`,
    )
}
