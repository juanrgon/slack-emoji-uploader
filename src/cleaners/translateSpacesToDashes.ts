/**
 * Given a string, replace each sequence of whitespace to a dash
 * @param  {string} text    Text with spaces
 * @return {string}         Text with spaces replaces with dashes
 *
 * Examples:
 *   '  a  b  c  ' => 'a-b-c'
*/
export default (text: string): string => {
    let translated: string;
    translated = (
        text
        .split(/\s/)  // split text on space
        .filter(s => s.match(/\S+/))  // keep non-space substrings
        .join('-')  // join with "-"
    );
    return translated;
}
