/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import babelParser from '@babel/eslint-parser';
import {recommended, source, test} from '@adobe/eslint-config-helix';
import { defineConfig, globalIgnores } from '@eslint/config-helpers'

export default defineConfig([
  globalIgnores([
    '.vscode/*',
    '.idea/*',
    'coverage/*',
    'docs/*',
    '**/.releaserc.cjs',
    '**/test/fixtures/**',
  ]),
  {
    languageOptions: {
      ecmaVersion: 2024,
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,  // Prevents needing a separate Babel config file
        babelOptions: {
          plugins: ['@babel/plugin-syntax-import-assertions'],  // Ensure the plugin is enabled
        },
      },
      sourceType: 'module',
    }
  },
  {
    extends: [ recommended ],
    plugins: {
      import: recommended.plugins.import,
    },
    rules: {
      'no-unused-expressions': 'off',
    },
  },
  {
    ...source,
    files: [...source.files],
  },
  {
    ...test,
    files: [...test.files, 'packages/**/test/**/*.js'],
    rules: {
      'no-console': 'off',
      'func-names': 'off',
    }
  },
  {
    ...source,
    files: ['packages/spacecat-shared-schemas/src/**/*.js'],
    rules: {
      'no-restricted-exports': [ 'error', {
        // no default exports, for python compatibility
        restrictDefaultExports: {
          direct: true,
          named: true,
          defaultFrom: true,
          namedFrom: true,
          namespaceFrom: true,
        },
      }],
      'sort-keys': ['error', 'asc', { 'natural': true }],
    },
  }
]);
