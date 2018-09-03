import SlackClient from "./SlackClient";
import Emoji from './Emoji';
import PingResult from '../interfaces/PingResult';


export default class SlackTeam {
    name: string;
    baseUrl: string;
    client: SlackClient

    constructor(name: string) {
        this.name = name;
        this.client = new SlackClient(this.name);
    }

    ping = async () :Promise<PingResult> => {
        return await this.client.ping();
    }

    addEmoji = async (name: string, url: string) => {
        const emoji = await Emoji.fromUrl(name, new URL(url));
        this.client.addEmoji(emoji);
    }
}
