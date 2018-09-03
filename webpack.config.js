const path = require('path');

module.exports = {
    entry: {
        index: './src/scripts/index.ts',
        options: './src/scripts/options.ts',
        popup: './src/scripts/popup.ts',
        slackmojis: './src/scripts/slackmojis.ts',
    },
    devtool: 'inline-source-map',
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/
            }
        ]
    },
    resolve: {
        extensions: ['.ts', '.js']
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'dist')
    }
};
