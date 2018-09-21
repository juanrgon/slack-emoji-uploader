import translateSpacesToDashes from './translateSpacesToDashes';
/**
 * Takes in an unambiguous emoji name and returns an emoji name that is acceptable by slack
 *
 * Operations:
 *   Translates ' ' to '-'
 *   Converts capital letters to lowercase
 * @param  {string} validEmojiName  An unambiguous emoji name
 * @return {string}                 Cleaned emoji name
*/
export default (validEmojiName: string): string => {
    let cleanedName: string = validEmojiName;
    cleanedName = translateSpacesToDashes(cleanedName);
    cleanedName = cleanedName.toLowerCase();
    return cleanedName;
}
