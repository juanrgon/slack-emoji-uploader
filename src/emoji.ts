class Emoji {
    constructor(
        public name: string,
        public blob
    ) {}

    static fromUrl(name: string, url: string): Emoji {}
}
