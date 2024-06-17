
import path from 'path';
import { fileURLToPath } from 'url';

import HtmlWebpackPlugin from 'html-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const config = {
    mode: 'development',
    devtool: 'inline-source-map',
    entry: {
        background: './src/background.js',
        popup: './src/pop-up.js',
        content: './src/content.js',
    },
    output: {
        path: path.resolve(__dirname, 'build'),
        filename: '[name].js',
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/pop-up.html',
            filename: 'pop-up.html',
        }),
        new CopyPlugin({
            patterns: [
                {
                    from: "assets",
                    to: "./assets" // Copies to build folder
                },
                {
                    from: "manifest.json",
                    to: "./manifest.json"
                }
            ],
        })
    ],
};

export default config;