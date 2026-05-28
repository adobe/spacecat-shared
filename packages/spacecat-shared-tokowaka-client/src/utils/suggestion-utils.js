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

import { buildUrlMatcher } from './pattern-utils.js';

/** Returns a shallow copy of obj with the specified keys removed. */
export function omitKeys(obj, keys) {
  const keySet = new Set(keys);
  return Object.fromEntries(Object.entries(obj).filter(([k]) => !keySet.has(k)));
}

/** Matches SpaceCat API eligibility for edge deploy (non-domain-wide). */
export function isEdgeDeployableSuggestionStatus(status) {
  return status === 'NEW' || status === 'PENDING_VALIDATION';
}

/**
 * Returns true if this suggestion uses pattern-based allow-list deploy (domain-wide or path-level).
 * Detected by the presence of a non-empty allowedRegexPatterns array, or by isDomainWide: true
 * (which may have an empty array when malformed — handled gracefully in the deploy loop).
 */
export function isPatternSuggestion(suggestion) {
  const data = suggestion.getData();
  return data?.isDomainWide === true
    || (Array.isArray(data?.allowedRegexPatterns) && data.allowedRegexPatterns.length > 0);
}

/**
 * Groups suggestions by URL pathname
 * @param {Array} suggestions - Array of suggestion entities
 * @param {string} baseURL - Base URL for pathname extraction
 * @param {Object} log - Logger instance
 * @returns {Object} - Object with URL paths as keys and arrays of suggestions as values
 */
export function groupSuggestionsByUrlPath(suggestions, baseURL, log) {
  return suggestions.reduce((acc, suggestion) => {
    const data = suggestion.getData();
    const url = data?.url;

    if (!url) {
      log.warn(`Suggestion ${suggestion.getId()} does not have a URL, skipping`);
      return acc;
    }

    let urlPath;
    try {
      urlPath = new URL(url, baseURL).pathname;
    } catch (e) {
      log.warn(`Failed to extract pathname from URL for suggestion ${suggestion.getId()}: ${url}`);
      return acc;
    }

    if (!acc[urlPath]) {
      acc[urlPath] = [];
    }
    acc[urlPath].push(suggestion);
    return acc;
  }, {});
}

/**
 * Filters suggestions into eligible and ineligible based on mapper's canDeploy method
 * @param {Array} suggestions - Array of suggestion entities
 * @param {Object} mapper - Mapper instance with canDeploy method
 * @returns {Object} - { eligible: Array, ineligible: Array<{suggestion, reason}> }
 */
export function filterEligibleSuggestions(suggestions, mapper) {
  const eligible = [];
  const ineligible = [];

  suggestions.forEach((suggestion) => {
    const eligibility = mapper.canDeploy(suggestion);
    if (eligibility.eligible) {
      eligible.push(suggestion);
    } else {
      ineligible.push({
        suggestion,
        reason: eligibility.reason || 'Suggestion cannot be deployed',
      });
    }
  });

  return { eligible, ineligible };
}

/**
 * Batch-saves suggestions via dataAccess.Suggestion.saveMany when available,
 * falling back to individual save() calls otherwise.
 * @param {Object} dataAccess - Data access layer
 * @param {Array} suggestions - Suggestion entities to save
 * @returns {Promise<void>}
 */
export async function saveSuggestions(dataAccess, suggestions) {
  if (suggestions.length === 0) {
    return;
  }
  if (dataAccess?.Suggestion) {
    await dataAccess.Suggestion.saveMany(suggestions);
  } else {
    await Promise.all(suggestions.map((s) => s.save()));
  }
}

/**
 * Strips deployment markers from a suggestion's data and sets updatedBy.
 * Does not save — caller is responsible for batching saves via saveSuggestions.
 * @param {Object} suggestion - Suggestion entity
 * @param {string} actorFallback - Fallback string when updatedBy is undefined
 * @param {string|undefined} updatedBy - Explicit actor (overrides fallback when defined)
 * @returns {Object} The mutated suggestion (not yet persisted)
 */
export function stripSuggestion(suggestion, actorFallback, updatedBy) {
  suggestion.setData(omitKeys(suggestion.getData(), ['edgeDeployed', 'tokowakaDeployed']));
  suggestion.setUpdatedBy(updatedBy ?? actorFallback);
  return suggestion;
}

/**
 * Clears coverage and deployment markers from suggestions that were covered by a pattern.
 * Only strips the fields relevant to the rollback type so independent coverage layers
 * are preserved. For example, rolling back domain-wide should only clear
 * coveredByDomainWide — not coveredByPattern (which belongs to a separate path deploy).
 * @param {Object} dataAccess - Data access layer
 * @param {Array} covered - Covered suggestion entities
 * @param {string} actorFallback - Fallback updatedBy string
 * @param {string|undefined} updatedBy - Explicit actor
 * @param {string[]} fieldsToStrip - Specific fields to remove
 * @param {Object} log - Logger instance
 * @returns {Promise<void>}
 */
export async function cleanupCoveredSuggestions(
  dataAccess, covered, actorFallback, updatedBy, fieldsToStrip, log,
) {
  if (covered.length === 0) {
    return;
  }
  covered.forEach((cs) => {
    cs.setData(omitKeys(cs.getData(), fieldsToStrip));
    cs.setUpdatedBy(updatedBy ?? actorFallback);
  });
  try {
    await saveSuggestions(dataAccess, covered);
  } catch (error) {
    log.error(`[edge-rollback-failed] Failed to clean ${covered.length} covered suggestion(s): ${error.message}`);
  }
}

/**
 * Classifies a batch of target suggestions into pattern-based and per-URL buckets.
 * Pattern suggestions (domain-wide or path-level) are returned as
 * `{ suggestion, allowedRegexPatterns }` objects; per-URL suggestions are filtered
 * to only those with a deployable status.
 * @param {Array} targetSuggestions
 * @param {Object} log - Logger instance
 * @returns {{ patternSuggestions: Array, validSuggestions: Array }}
 */
export function classifySuggestions(targetSuggestions, log) {
  const patternSuggestions = [];
  const validSuggestions = [];

  targetSuggestions.forEach((suggestion) => {
    const data = suggestion.getData();
    if (isPatternSuggestion(suggestion)) {
      log.info(
        `[edge-deploy] Classified as PATTERN: ${suggestion.getId()} `
        + `patterns=${JSON.stringify(data.allowedRegexPatterns)} isDomainWide=${data?.isDomainWide}`,
      );
      patternSuggestions.push({ suggestion, allowedRegexPatterns: data.allowedRegexPatterns });
    } else if (isEdgeDeployableSuggestionStatus(suggestion.getStatus())) {
      validSuggestions.push(suggestion);
    }
  });

  return { patternSuggestions, validSuggestions };
}

/**
 * Splits validSuggestions into those covered by an in-batch pattern and those that are not.
 * Returns the two arrays; validSuggestions itself is not mutated.
 * @param {Array} validSuggestions - Per-URL suggestions
 * @param {Array} patternSuggestions - Pattern suggestions in the same batch
 * @param {Object} log - Logger instance
 * @returns {{ remaining: Array, skippedInBatch: Array }}
 */
export function filterBatchCoveredSuggestions(validSuggestions, patternSuggestions, log) {
  if (patternSuggestions.length === 0 || validSuggestions.length === 0) {
    return { remaining: validSuggestions, skippedInBatch: [] };
  }

  // Build matchers per pattern suggestion so we can track which type covered each URL.
  const matcherEntries = patternSuggestions.flatMap(({ suggestion, allowedRegexPatterns }) => {
    const isDomainWide = suggestion.getData()?.isDomainWide === true;
    return allowedRegexPatterns
      .map(buildUrlMatcher)
      .filter(Boolean)
      .map((matcher) => ({ matcher, isDomainWide }));
  });

  if (matcherEntries.length === 0) {
    return { remaining: validSuggestions, skippedInBatch: [] };
  }

  const remaining = [];
  const skippedInBatch = [];
  validSuggestions.forEach((s) => {
    const url = s.getData()?.url;
    const match = url && matcherEntries.find(({ matcher }) => matcher(url));
    if (match) {
      skippedInBatch.push({ suggestion: s, isDomainWide: match.isDomainWide });
      log.info(`[edge-deploy] Skipping suggestion ${s.getId()} - covered by pattern`);
    } else {
      remaining.push(s);
    }
  });

  return { remaining, skippedInBatch };
}
