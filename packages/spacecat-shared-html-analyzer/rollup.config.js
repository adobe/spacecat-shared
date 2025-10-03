/*
 * Copyright 2025 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { nodeResolve } from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';

export default {
  input: 'src/browser-entry.js', // Special browser entry point
  output: [
    {
      file: 'dist/html-analyzer.js',
      format: 'iife', // Immediately Invoked Function Expression for browsers
      name: 'HTMLAnalyzer',
      globals: {
        // No external dependencies in browser bundle
      },
    },
    {
      file: 'dist/html-analyzer.min.js',
      format: 'iife',
      name: 'HTMLAnalyzer',
      plugins: [terser()], // Minified version
      globals: {
        // No external dependencies in browser bundle
      },
    },
  ],
  plugins: [
    nodeResolve({
      browser: true, // Use browser field in package.json
      preferBuiltins: false, // Don't include Node.js built-ins
    }),
  ],
  external: [
    // Exclude cheerio from bundle - it won't work in browser anyway
    'cheerio',
  ],
  onwarn(warning, warn) {
    // Suppress warnings about dynamic imports that we'll handle
    if (warning.code === 'UNRESOLVED_IMPORT') return;
    warn(warning);
  },
};
