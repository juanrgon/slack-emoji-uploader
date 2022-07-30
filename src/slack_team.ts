import * as chrome_extension from "./chrome_extension"
import * as emoji from "./emoji";


export class SlackTeam {
    constructor(
        public name: string
    ) { }

    /**
     * Load slack team info from browser storage
     */
    static async loadFromBrowserStorage(): Promise<SlackTeam[]> {
        const teamNames = await chrome.storage.sync.get({ 'teamDomains': [] });
        return teamNames.map(name => new SlackTeam(name));
    }

    addEmoji(info: chrome.contextMenus.OnClickData, tab: chrome.tabs.Tab) {
        // Ask user for a name for the emoji
        let emoji_name = prompt("Give your emoji a name!")


        while (true) {
            // If the user hits cancel, then stop prompting and exit the function
            if (emoji_name === null) {
                return
            // If the didn't enter a name, go to the next loop
            } else if (emoji_name === '') {
                emoji_name = prompt("Emoji name can't be blank 😔! Try again.");
                continue
            }
        }

        emoji = Emoji.fromUrl({name: emoji_name, url: info.srcUrl});

        this.uploadEmoji(emoji);

        if (emoji_name !== null) {
            var valid_name = validate_emoji_name(emoji_name);
            if (!valid_name) {
                alert('"' + emoji_name +
                    '" is an invalid name 😔. Only use letters, numbers, dashes, spaces, and underscores. You must also include at least one non-space character.'
                );
            } else {
                emoji_name = remove_whitespace(emoji_name);
                emoji_name = emoji_name.toLowerCase();
                console.log('Emoji name:' + emoji_name);
                var image_url = info.srcUrl;
                let teamName = info.menuItemId;
            }
        }
    }

    /**
     *  Upload emoji to slack team
     *
     * @param emoji Emoji to add
     * @returns
     */
    private uploadEmoji(emoji: emoji.Emoji) {
        const url = `https://${this.name}.slack.com/api/emoji.add`;
        const data = {
            name: emoji.name,
            image: emoji.image,
        };
        return fetch(url, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

}
