import * as Errors from '../errors/Emoji';

export default class Emoji {
    name: string
    blob: Blob

    constructor(name: string, blob: Blob) {
        this.name = name;
        this.blob = blob;
    }

    static fromUrl = async (name: string, url: URL): Promise<Emoji> => {
        const urlString = url.toString();

        let blob: Blob = null;
        if (url.protocol === 'data:') {
            blob = await Emoji.dataUrlToBlob(urlString);
        }
        else if (url.protocol === 'file:') {
            blob = await Emoji.fileUrlToBlob(urlString);
        }
        else if (url.protocol.match(/https?:/)) {
            blob = await Emoji.httpUrlToBlob(urlString);
        }
        else throw Errors.invalidEmojiUrlProtocol(url.protocol);

        return new Emoji(name, blob);
    }

    private static httpUrlToBlob = async (httpUrl: string) => {
        const response = await fetch(httpUrl);
        const blob = await response.blob();
        return blob;
    }

    private static dataUrlToBlob = async (dataUrl: string) => {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        return blob;
    }

    private static fileUrlToBlob = async (fileUrl: string) => {
        const response = await fetch(fileUrl);
        const blob = await response.blob();
        return blob;
    }

}
