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
 * Generates a unique key for a patch based on its structure
 * Two types of patches:
 * 1. Single patch per URL (FAQ): All suggestions for same URL merge into one patch
 *    → Key: opportunityId
 * 2. Individual patches (Headings, Content): One patch per suggestion
 *    → Key: opportunityId:suggestionId
 */
function getPatchKey(patch, hasSinglePatchPerUrl = false) {
  if (!Array.isArray(patch.suggestionIds) || patch.suggestionIds.length === 0) {
    throw new Error('Patch must have suggestionIds array with at least one element');
  }

  // Single patch per URL: use only opportunityId as key
  if (hasSinglePatchPerUrl) {
    return patch.opportunityId;
  }

  // Individual patches include suggestionId in key
  // This ensures each suggestion gets its own separate patch
  return `${patch.opportunityId}:${patch.suggestionIds[0]}`;
}

/**
 * Merges new patches into existing patches based on patch keys
 * - If a patch with the same key exists, it's updated
 * - If a patch with a new key is found, it's added
 * @param {Array} existingPatches - Array of existing patches
 * @param {Array} newPatches - Array of new patches to merge
 * @param {boolean} hasSinglePatchPerUrl - Whether mapper combines suggestions
 *   into single patch per URL
 * @returns {Object} - { patches: Array, updateCount: number, addCount: number }
 */
export function mergePatches(existingPatches, newPatches, hasSinglePatchPerUrl = false) {
  // Create a map of existing patches by their key
  const patchMap = new Map();
  existingPatches.forEach((patch, index) => {
    const key = getPatchKey(patch, hasSinglePatchPerUrl);
    patchMap.set(key, { patch, index });
  });

  // Process new patches
  const mergedPatches = [...existingPatches];
  let updateCount = 0;
  let addCount = 0;

  newPatches.forEach((newPatch) => {
    const key = getPatchKey(newPatch, hasSinglePatchPerUrl);
    const existing = patchMap.get(key);

    if (existing) {
      mergedPatches[existing.index] = newPatch;
      updateCount += 1;
    } else {
      mergedPatches.push(newPatch);
      addCount += 1;
    }
  });

  return { patches: mergedPatches, updateCount, addCount };
}
