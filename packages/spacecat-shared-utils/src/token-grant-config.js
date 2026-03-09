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
 * Keys match Token.TOKEN_TYPES (e.g. monthly_suggestion_cwv,
 * monthly_suggestion_broken_backlinks). Use getTokenGrantConfig(tokenType)
 * for a single entry or TOKEN_GRANT_CONFIG for the full map.
 */
const TOKEN_GRANT_CONFIG = Object.freeze({
  monthly_suggestion_cwv: Object.freeze({
    tokensPerCycle: 3,
    cycle: 'monthly',
    cycleFormat: 'YYYY-MM',
  }),
  monthly_suggestion_broken_backlinks: Object.freeze({
    tokensPerCycle: 3,
    cycle: 'monthly',
    cycleFormat: 'YYYY-MM',
  }),
  monthly_suggestion_alt_text: Object.freeze({
    tokensPerCycle: 3,
    cycle: 'monthly',
    cycleFormat: 'YYYY-MM',
  }),
});

export { TOKEN_GRANT_CONFIG };

/**
 * Computes the current cycle string for a given cycleFormat using UTC time.
 * Supported placeholders: YYYY (4-digit year), MM (zero-padded month).
 * @param {string} cycleFormat - e.g. "YYYY-MM".
 * @returns {string} e.g. "2026-03".
 */
export function getCurrentCycle(cycleFormat) {
  const now = new Date();
  return cycleFormat
    .replace('YYYY', String(now.getUTCFullYear()))
    .replace('MM', String(now.getUTCMonth() + 1).padStart(2, '0'));
}

/**
 * Returns the grant config for a token type, including the computed current cycle.
 * @param {string} tokenType - One of Token.TOKEN_TYPES (e.g. monthly_suggestion_cwv,
 *   monthly_suggestion_broken_backlinks, monthly_suggestion_alt_text).
 * @returns {{ tokensPerCycle: number, cycle: string, cycleFormat: string,
 *   currentCycle: string }|undefined}
 */
export function getTokenGrantConfig(tokenType) {
  const entry = TOKEN_GRANT_CONFIG[tokenType];
  if (!entry) return undefined;
  return { ...entry, currentCycle: getCurrentCycle(entry.cycleFormat) };
}
