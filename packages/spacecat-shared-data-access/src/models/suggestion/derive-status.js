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
 * Suggestion status literals (return values).
 *
 * Duplicated from the model enum to keep this a dependency-light pure module.
 * Keep in sync if the enum changes. (Same pattern as suggestion.data-schemas.js.)
 */
const SUGGESTION = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIPPED: 'SKIPPED',
  FIXED: 'FIXED',
  ERROR: 'ERROR',
};

/**
 * Severity classes for the bubble-up (ADR adobe/mysticat-architecture#174).
 * Highest severity first-match-wins; NEUTRAL never contributes to severity
 * (a suggestion whose only signals are NEUTRAL resolves to NEW).
 */
const CLASS = {
  ERROR: 'ERROR',
  IN_PROGRESS: 'IN_PROGRESS',
  FIXED: 'FIXED',
  SKIPPED: 'SKIPPED',
  NEUTRAL: 'NEUTRAL',
};

/**
 * Maps a status token to its severity class. Covers BOTH vocabularies so a
 * caller can pass FixEntity statuses (DEPLOYED/FAILED/PENDING/ROLLED_BACK/...)
 * and/or explicit Suggestion-status outcomes (FIXED/ERROR/SKIPPED/NEW/...) for
 * cases with no fix entity (e.g. a consciously-skipped or not-actionable
 * suggestion). `REJECTED` collapses to SKIPPED in either vocabulary. Unknown
 * tokens are ignored (null).
 */
const CLASS_BY_STATUS = {
  // ERROR-class
  FAILED: CLASS.ERROR, // fix
  ERROR: CLASS.ERROR, // suggestion
  // IN_PROGRESS-class
  PENDING: CLASS.IN_PROGRESS, // fix
  IN_PROGRESS: CLASS.IN_PROGRESS, // suggestion
  // FIXED-class
  DEPLOYED: CLASS.FIXED, // fix
  PUBLISHED: CLASS.FIXED, // fix
  FIXED: CLASS.FIXED, // suggestion
  // SKIPPED-class
  ROLLED_BACK: CLASS.SKIPPED, // fix
  REJECTED: CLASS.SKIPPED, // fix / suggestion
  SKIPPED: CLASS.SKIPPED, // suggestion
  // NEUTRAL — present but non-severity; all-NEUTRAL resolves to NEW
  NEW: CLASS.NEUTRAL,
  OUTDATED: CLASS.NEUTRAL,
  APPROVED: CLASS.NEUTRAL,
  PENDING_VALIDATION: CLASS.NEUTRAL,
};

/**
 * Classifies a status token into its bubble-up severity class, or null if the
 * token is unknown.
 *
 * @param {string|null|undefined} token
 * @returns {'ERROR'|'IN_PROGRESS'|'FIXED'|'SKIPPED'|'NEUTRAL'|null}
 */
export const classifyStatus = (token) => (
  Object.prototype.hasOwnProperty.call(CLASS_BY_STATUS, token)
    ? CLASS_BY_STATUS[token]
    : null
);

/**
 * Normalizes an outcome entry to its status string. Accepts a FixEntity model
 * instance (`getStatus()`), a plain `{ status }` object, or a status string.
 */
const toStatus = (outcome) => {
  if (typeof outcome === 'string') {
    return outcome;
  }
  if (outcome && typeof outcome.getStatus === 'function') {
    return outcome.getStatus();
  }
  return outcome?.status;
};

/**
 * Derives a Suggestion's status from a per-suggestion list of outcome signals —
 * the bubble-up from ADR adobe/mysticat-architecture#174.
 *
 * Each `outcomes` entry is a FixEntity, a `{ status }` object, or a status
 * string, from EITHER vocabulary:
 *  - FixEntity statuses: DEPLOYED/PUBLISHED -> FIXED, FAILED -> ERROR,
 *    PENDING -> IN_PROGRESS, ROLLED_BACK/REJECTED -> SKIPPED.
 *  - explicit Suggestion-status outcomes for no-fix cases a handler asserts
 *    (e.g. a consciously skipped suggestion -> 'SKIPPED', a not-actionable one
 *    -> 'NEW').
 *
 * Signals are classified (`classifyStatus`) and collapsed **first-match-wins by
 * severity**: ERROR > IN_PROGRESS > FIXED > SKIPPED. If signals are present but
 * all NEUTRAL (e.g. only 'NEW') the result is NEW. If there are no recognized
 * signals (empty / all-null / all-unknown) the result is `currentStatus`
 * (default null), so a derive call never clobbers a status set elsewhere.
 *
 * The **CWV multi-issue** bubble-up is deliberately NOT implemented here: the
 * per-issue vocabulary (mystique's cwvIssueStatus = PATCH_GENERATED /
 * GUIDANCE_* / PATCH_FAILED_*) is not yet reconciled with the JS layer
 * (SITES-47285). Passing a non-empty `issues` argument throws to prevent a
 * caller from silently receiving an unimplemented CWV result.
 *
 * @param {Array<object|string>} outcomes - fix entities / `{status}` / status strings
 * @param {Array<object>} [issues] - CWV per-issue data; MUST be empty for now
 * @param {string|null} [currentStatus] - fallback when nothing is derivable
 * @returns {string|null} derived Suggestion status, or `currentStatus`
 * @throws {Error} if a non-empty `issues` array is supplied (CWV deferred)
 */
export const deriveSuggestionStatus = (outcomes, issues = [], currentStatus = null) => {
  if (Array.isArray(issues) && issues.length > 0) {
    throw new Error('deriveSuggestionStatus: CWV multi-issue bubble-up is not yet implemented (deferred to SITES-47285)');
  }

  if (!Array.isArray(outcomes)) {
    return currentStatus;
  }

  // Classify each signal; drop unknown/null so one malformed entry cannot
  // nullify an otherwise well-defined derivation.
  const classes = outcomes.map(toStatus).map(classifyStatus).filter((c) => c != null);
  if (classes.length === 0) {
    return currentStatus;
  }

  if (classes.includes(CLASS.ERROR)) {
    return SUGGESTION.ERROR;
  }
  if (classes.includes(CLASS.IN_PROGRESS)) {
    return SUGGESTION.IN_PROGRESS;
  }
  if (classes.includes(CLASS.FIXED)) {
    return SUGGESTION.FIXED;
  }
  if (classes.includes(CLASS.SKIPPED)) {
    return SUGGESTION.SKIPPED;
  }

  // signals present but all NEUTRAL (e.g. only NEW/OUTDATED)
  return SUGGESTION.NEW;
};
