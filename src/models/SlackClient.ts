import 'es6-promises';
import axios from 'axios';

import Emoji from './Emoji';
import SlackAuthTokens from '../interfaces/SlackAuthTokens';
import PingResult from '../interfaces/PingResult';

export default class SlackClient {
    teamName: string

    private addEmojiUrl: string
    private authTokens: SlackAuthTokens
    private baseUrl: string
    private emojiPage: EmojiPage
    private emojiPageUrl: string

    constructor(teamName: string) {
        this.addEmojiUrl =  null;
        this.authTokens = null;
        this.baseUrl = `https://${teamName}.slack.com`;
        this.emojiPage = null;
        this.emojiPageUrl = `${this.baseUrl}/customize/emoji`
        this.teamName = teamName;
    }

    ping = async () => {
        const result: PingResult = { isSignedIn: false, isReachable: false };

        let emojiPage;
        try {
            emojiPage = await this.getEmojiPage();
        } catch(e) {
            return result;
        }

        result.isReachable = true;
        result.isSignedIn = emojiPage.isSignedIn;
        return result;
    }

    addEmoji = async (emoji: Emoji) => {
        const authTokens = await this.getAuthTokens();

        // Construct url
        const url = new URL('/api/emoji.add', this.baseUrl);
        const epoch_now_seconds = (new Date).getTime() / 1000;
        url.searchParams.append('_x_id',  `${authTokens.shortVersion}-${epoch_now_seconds}`)

        const response = await axios.post(
            url.toString(),
            {
                mode: 'data',
                name: emoji.name,
                image: emoji.blob,
                token: authTokens.apiToken,
            }
        )

        return response.data;
    }

    private getAuthTokens = async () => {
        if (this.authTokens === null) {
            const emojiPage = await this.getEmojiPage();

            const apiToken = await emojiPage.getAPIToken();
            const apiVersion = await emojiPage.getVersion();
            const apiShortVersion = await emojiPage.getShortVersion();

            const tokens: SlackAuthTokens = {
                apiToken: apiToken,
                shortVersion: apiShortVersion,
                version: apiVersion,
            }
            this.authTokens = tokens
        }
        return this.authTokens
    }

    private getEmojiPage = async () => {
        if (this.emojiPage === null) {
            const response = await axios.get(this.emojiPageUrl);
            const html = response.data;
            this.emojiPage = new EmojiPage(html);
        }
        return this.emojiPage;
    }

}

class EmojiPage {
    private apiToken: string
    private version: string
    private _isSignedIn: boolean

    html: string
    emojiHtmlParser: EmojiHtmlParser

    constructor(html: string) {
        this.apiToken = null;
        this.version = null;
        this._isSignedIn = null;

        this.html = html;
        this.emojiHtmlParser = new EmojiHtmlParser(html);
    }

    getAPIToken = () => {
        if (this.apiToken === null) {
            this.apiToken = this.emojiHtmlParser.getAPIToken();
        }
        return this.apiToken;
    }

    getVersion = () => {
        if (this.version === null) {
            this.version = this.emojiHtmlParser.getVersion();
        }
        return this.version;
    }

    getShortVersion = () => {
        if (this.version === null) {
            this.version = this.emojiHtmlParser.getVersion();
        }
        return this.version.substr(0, 8);
    }

    get isSignedIn(): boolean {
        if (this._isSignedIn === null) {
            this._isSignedIn = this.emojiHtmlParser.isSignedIn();
        }
        return this._isSignedIn;
    }
}

class EmojiHtmlParser {
    html: string

    API_TOKEN_REGEX = /api_token: "(\S+)"/
    API_VERSION_REGEX = /version_uid: "(\S+)"/
    CUSTOMIZE_REGEX = /Customize your workspace/

    constructor(html: string) {
        this.html = html;
    }

    getAPIToken = () => this.html.match(this.API_TOKEN_REGEX)[1];
    getVersion = () => this.html.match(this.API_VERSION_REGEX)[1];
    isSignedIn = () => !!this.html.match(this.CUSTOMIZE_REGEX);

}
