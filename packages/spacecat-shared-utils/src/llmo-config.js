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

/**
 * @typedef {Object} LLMOConfig
 */

/**
 * @param {string} siteId The ID of the site to get the config directory for.
 * @returns {string} The configuration directory path for the given site ID.
 */
export function lmmoConfigDir(siteId) {
  return `config/llmo/${siteId}`;
}

/**
 * @param {string} siteId The ID of the site to get the latest config file path for.
 * @returns {string} The latest configuration file path for the given site ID.
 */
export function llmoConfigPath(siteId) {
  // TODO
}

/**
 * Writes the LLMO configuration for a given site.
 * @param {string} siteId The ID of the site.
 * @param {LLMOConfig} config The configuration object to write.
 * @returns {Promise<string>} The version of the configuration written.
 */
export async function writeConfig(siteId, config) {
  // TODO
}
