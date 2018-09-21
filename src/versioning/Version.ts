export default class Version {
    major: number
    minor: number
    patch: number

    constructor(major: number, minor: number, patch: number) {
        this.major = major;
        this.minor = minor;
        this.patch = patch;
    }

    static fromString = (versionString: string): Version => {
        const [major, minor, patch]: number[] = (
            versionString
                .split('.')
                .map(s => parseInt(s))
        )
        return new Version(major, minor, patch)
    }

    /**
     * Return whether or not this version is newer some other version
    */
    newerThan = (that: Version): boolean => {
        return [this.major, this.minor, this.patch] > [that.major, that.minor, that.patch];
    }

    /**
     * Return whether or not this version is less some other version
    */
    lessThanOrEqualTo = (that: Version): boolean => {
        return [this.major, this.minor, this.patch] <= [that.major, that.minor, that.patch];
    }

}
