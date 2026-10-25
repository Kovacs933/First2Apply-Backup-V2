import path from 'path';
import type { AssetInfo, Configuration, PathData } from 'webpack';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const webpack = require('webpack');

import { plugins } from './webpack.plugins';
import { rules } from './webpack.rules';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    // pdf.js (reading uploaded CVs) only uses these to draw pages, which we don't need: it works without them
    new webpack.IgnorePlugin({ resourceRegExp: /^(canvas|path2d-polyfill)$/ }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};
