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
import { readFileSync } from 'fs';

// Read package.json version
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Simple plugin to inject package version
const injectVersion = () => ({
  name: 'inject-version',
  transform(code, id) {
    if (id.endsWith('browser-entry.js')) {
      return code.replace('__PACKAGE_VERSION__', pkg.version);
    }
    return null;
  },
});

// Plugin to remove Node.js dynamic imports in renderChunk phase (after bundling)
const removeNodeImports = () => ({
  name: 'remove-node-imports',
  renderChunk(code) {
    // Remove the entire block containing the turndown import
    let cleanedCode = code.replace(
      /const module = await import\(['"]turndown['"]\);[\s\n]*TurndownServiceClass = module\.default;/g,
      '// Turndown import removed for browser build',
    );

    // Remove the entire block containing the marked import
    cleanedCode = cleanedCode.replace(
      /const module = await import\(['"]marked['"]\);[\s\n]*markedParser = module\.marked;/g,
      '// Marked import removed for browser build',
    );

    return {
      code: cleanedCode,
      map: null,
    };
  },
});

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
    injectVersion(), // Inject package version
    nodeResolve({
      browser: true, // Use browser field in package.json
      preferBuiltins: false, // Don't include Node.js built-ins
    }),
    removeNodeImports(), // Remove Node.js dynamic imports after bundling
  ],
  external: [
    // Exclude Node.js-only dependencies from bundle - they won't work in browser anyway
    'cheerio',
    'turndown',
    'marked',
  ],
  onwarn(warning, warn) {
    // Suppress warnings about dynamic imports that we'll handle
    if (warning.code === 'UNRESOLVED_IMPORT') return;
    warn(warning);
  },
};
