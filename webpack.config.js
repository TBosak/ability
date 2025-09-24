import path from 'path';
import { fileURLToPath } from 'url';

import CopyPlugin from 'copy-webpack-plugin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const mode = process.env.NODE_ENV ?? 'development';

const config = {
  mode,
  devtool: mode === 'development' ? 'inline-source-map' : false,
  entry: {
    background: './extension/src/background.js',
    content: './extension/src/content.js'
  },
  output: {
    path: path.resolve(__dirname, 'build'),
    filename: '[name].js'
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'extension/assets'),
          to: './assets'
        },
        {
          from: path.resolve(__dirname, 'extension/manifest.json'),
          to: './manifest.json'
        }
      ]
    })
  ]
};

export default config;
