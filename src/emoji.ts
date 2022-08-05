class Emoji {
    constructor(
        public name: string,
        public blob
    ) {}

    static fromUrl(name: string, url: string): Emoji {
        // TODO: download the image and create a blob
        blob = new Blob();
        return new Emoji(name, url);
    }
}
