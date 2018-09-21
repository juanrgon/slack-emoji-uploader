import * as names from './types';


interface helpMap {
    [key: string]: string,
}

const help: helpMap = {}
help[names.INVALID_EMOJI_NAME] = 'Name can only contain letters, numbers, dashes, spaces, and underscores. You must also include at least one non-space character.'
export default help;
