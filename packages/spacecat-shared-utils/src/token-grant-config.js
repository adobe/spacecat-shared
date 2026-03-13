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

const TOKEN_TYPE_PREFIX = 'grant_';

/**
 * Converts an opportunity name to its corresponding token type key.
 * Replaces hyphens with underscores and prepends the grant prefix.
 * @param {string} opportunityName - e.g. "broken-backlinks".
 * @returns {string} e.g. "grant_broken_backlinks".
 */
export function getTokenTypeForOpportunity(opportunityName) {
  return `${TOKEN_TYPE_PREFIX}${opportunityName.replace(/-/g, '_')}`;
}

/**
 * Per-opportunity grant configuration. Keys are opportunity names
 * (matching OPPORTUNITY_TYPES values). Token type keys are derived
 * automatically via getTokenTypeForOpportunity().
 */
const OPPORTUNITY_GRANT_CONFIG = Object.freeze({
  cwv: Object.freeze({
    tokensPerCycle: 3,
    cycle: 'monthly',
    cycleFormat: 'YYYY-MM',
  }),
  'broken-backlinks': Object.freeze({
    tokensPerCycle: 3,
    cycle: 'monthly',
    cycleFormat: 'YYYY-MM',
  }),
  'alt-text': Object.freeze({
    tokensPerCycle: 3,
    cycle: 'monthly',
    cycleFormat: 'YYYY-MM',
  }),
});

export { OPPORTUNITY_GRANT_CONFIG };

/**
 * Cumulative token grant configuration keyed by token type.
 * Includes entries generated from OPPORTUNITY_GRANT_CONFIG plus
 * any standalone (non-opportunity) token types added below.
 *
 * NOTE: For limited use cases this config lives here in code.
 * When the number of token types grows or needs to be managed
 * dynamically, consider migrating to a dedicated database table
 * (e.g. token_grant_configs) in mysticat-data-service.
 */
const TOKEN_GRANT_CONFIG = Object.freeze({
  // Auto-generated from OPPORTUNITY_GRANT_CONFIG
  ...Object.fromEntries(
    Object.entries(OPPORTUNITY_GRANT_CONFIG).map(
      ([name, cfg]) => [getTokenTypeForOpportunity(name), cfg],
    ),
  ),
  // Add standalone (non-opportunity) token types here, e.g.:
  // some_standalone_type: Object.freeze({ ... }),
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
 * Returns the grant config for a token type, including the
 * computed current cycle.
 * @param {string} tokenType - e.g. "grant_cwv".
 * @returns {{ tokensPerCycle: number, cycle: string,
 *   cycleFormat: string, currentCycle: string }|undefined}
 */
export function getTokenGrantConfig(tokenType) {
  const entry = TOKEN_GRANT_CONFIG[tokenType];
  if (!entry) return undefined;
  return { ...entry, currentCycle: getCurrentCycle(entry.cycleFormat) };
}

/**
 * Returns the grant config for an opportunity name, including
 * the computed current cycle and the derived token type.
 * @param {string} opportunityName - e.g. "broken-backlinks".
 * @returns {{ tokensPerCycle: number, cycle: string,
 *   cycleFormat: string, currentCycle: string,
 *   tokenType: string }|undefined}
 */
export function getTokenGrantConfigByOpportunity(opportunityName) {
  const entry = OPPORTUNITY_GRANT_CONFIG[opportunityName];
  if (!entry) return undefined;
  return {
    ...entry,
    currentCycle: getCurrentCycle(entry.cycleFormat),
    tokenType: getTokenTypeForOpportunity(opportunityName),
  };
}
