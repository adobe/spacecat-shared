/*
 * Copyright 2026 Adobe. All rights reserved.
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
 * Removes a single pattern from the metaconfig's prerender allowList in-place.
 * Deletes the prerender key entirely when the resulting list would be empty.
 * @param {Object} metaconfig - Metaconfig object (mutated in place)
 * @param {string} pattern - Pattern to remove
 * @returns {boolean} True if the allowList was changed
 */
export function removePatternFromMetaconfig(metaconfig, pattern) {
  const existing = metaconfig.prerender?.allowList ?? [];
  const updated = existing.filter((p) => p !== pattern);
  if (updated.length === existing.length) {
    return false;
  }
  if (updated.length === 0) {
    // eslint-disable-next-line no-param-reassign
    delete metaconfig.prerender;
  } else {
    // eslint-disable-next-line no-param-reassign
    metaconfig.prerender = { allowList: updated };
  }
  return true;
}

/**
 * Appends patterns to the metaconfig's prerender allowList (deduplicated).
 * Mutates the metaconfig in place.
 * @param {Object} metaconfig - Metaconfig object (mutated in place)
 * @param {Array<string>} patterns - Patterns to add
 * @returns {boolean} True if the allowList was changed
 */
export function addPatternsToMetaconfig(metaconfig, patterns) {
  const existing = metaconfig.prerender?.allowList ?? [];
  const merged = [...new Set([...existing, ...patterns])];
  if (merged.length === existing.length) {
    return false;
  }
  // eslint-disable-next-line no-param-reassign
  metaconfig.prerender = { allowList: merged };
  return true;
}
