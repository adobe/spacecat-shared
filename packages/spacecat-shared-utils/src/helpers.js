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

import { isString } from './functions.js';

/**
 * Resolves the name of the secret based on the function version.
 * @param {Object} opts - The options object, not used in this implementation.
 * @param {Object} ctx - The context object containing the function version.
 * @param {string} defaultPath - The default path for the secret.
 * @returns {string} - The resolved secret name.
 */
const resolveSecretsName = (opts, ctx, defaultPath) => {
  const funcVersion = ctx?.func?.version;

  if (!isString(funcVersion)) {
    throw new Error('Invalid context: func.version is required and must be a string');
  }
  if (!isString(defaultPath)) {
    throw new Error('Invalid defaultPath: must be a string');
  }

  return `${defaultPath}/${funcVersion}`;
};

export {
  resolveSecretsName,
};
