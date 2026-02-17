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
 * Token grant configuration: tokens per cycle and grant cycle per token type.
 * Keys match Token.TOKEN_TYPES (e.g. BROKEN_BACKLINK, CWV, ALT_TEXT).
 * Use getTokenGrantConfig(tokenType) for a single entry or TOKEN_GRANT_CONFIG for the full map.
 */
import config from './token-grant-config.json' with { type: 'json' };

export const TOKEN_GRANT_CONFIG = config;

/**
 * Returns the grant config for a token type (tokensPerCycle, cycle, cycleFormat).
 * @param {string} tokenType - One of BROKEN_BACKLINK, CWV, ALT_TEXT.
 * @returns {{ tokensPerCycle: number, cycle: string, cycleFormat: string }|undefined}
 */
export function getTokenGrantConfig(tokenType) {
  return config[tokenType];
}
