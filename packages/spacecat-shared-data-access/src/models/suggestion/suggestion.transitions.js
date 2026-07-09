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
 * Suggestion status literals.
 *
 * Duplicated from `Suggestion.STATUSES` (suggestion.model.js) to avoid a circular
 * import — suggestion.model.js imports this module for its setStatus guard.
 * Keep in sync if the enum ever changes. (Same pattern as suggestion.data-schemas.js.)
 */
const S = {
  NEW: 'NEW',
  APPROVED: 'APPROVED',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIPPED: 'SKIPPED',
  FIXED: 'FIXED',
  ERROR: 'ERROR',
  OUTDATED: 'OUTDATED',
  PENDING_VALIDATION: 'PENDING_VALIDATION',
  REJECTED: 'REJECTED',
};

export const SUGGESTION_CREATE = Symbol('SUGGESTION_CREATE');

/**
 * Suggestion status transition table.
 *
 * Source of truth: ADR adobe/mysticat-architecture#174. Unlike FixEntity, the
 * Suggestion lifecycle is mostly *derived* (bubble-up from fix entities) plus a
 * few direct writes from audit-worker / ESE-review / UI / api-service. This map
 * is intentionally **permissive** in V1: it encodes the transitions we believe
 * are legitimate today so the warn-only guard surfaces genuine anomalies without
 * drowning real flows in false warnings. The warn logs from the rollout period
 * inform which entries to tighten before flipping to enforce.
 *
 * The one hard rule already enforced by api-service is preserved exactly:
 * REJECTED is only reachable from PENDING_VALIDATION (suggestions.js).
 */
export const SUGGESTION_TRANSITIONS = {
  // audit-worker creates as NEW (non-paid) or PENDING_VALIDATION (paid); OUTDATED at audit time.
  [SUGGESTION_CREATE]: [S.NEW, S.PENDING_VALIDATION, S.OUTDATED],
  // ESE/TBYB review (-> NEW), mystique (-> IN_PROGRESS), bubble-up, UI skip, re-audit.
  [S.NEW]: [S.APPROVED, S.IN_PROGRESS, S.FIXED, S.ERROR, S.SKIPPED, S.OUTDATED],
  // paid-review gate: approve -> NEW, decline -> REJECTED (the one hard rule), or skip/outdate.
  // IN_PROGRESS: api-service autofixSuggestions accepts PENDING_VALIDATION and sets IN_PROGRESS.
  [S.PENDING_VALIDATION]: [S.NEW, S.IN_PROGRESS, S.REJECTED, S.SKIPPED, S.OUTDATED],
  [S.APPROVED]: [S.IN_PROGRESS, S.FIXED, S.ERROR, S.SKIPPED, S.NEW, S.OUTDATED],
  // bubble-up after fix-entity transitions.
  [S.IN_PROGRESS]: [S.FIXED, S.ERROR, S.SKIPPED, S.NEW, S.OUTDATED],
  // re-detection can reopen a fixed suggestion (-> NEW), retry (-> IN_PROGRESS), or outdate it.
  [S.FIXED]: [S.NEW, S.IN_PROGRESS, S.ERROR, S.OUTDATED],
  // errors are recoverable: re-attempt or reopen.
  [S.ERROR]: [S.NEW, S.IN_PROGRESS, S.FIXED, S.SKIPPED, S.OUTDATED],
  // un-skip / re-detect.
  [S.SKIPPED]: [S.NEW, S.OUTDATED],
  // re-detection reopens an outdated suggestion.
  [S.OUTDATED]: [S.NEW],
  // near-terminal: allow reopen to NEW to correct an incorrect classification (sandsinh review).
  [S.REJECTED]: [S.NEW],
};

/**
 * Returns true if the Suggestion status transition `from` -> `to` is allowed.
 * A null/undefined `from` is treated as suggestion creation.
 *
 * @param {string|null|undefined} from - current status (null/undefined => create)
 * @param {string} to - target status
 * @returns {boolean}
 */
export const isAllowedSuggestionTransition = (from, to) => {
  const key = (from === null || from === undefined) ? SUGGESTION_CREATE : from;
  const allowed = SUGGESTION_TRANSITIONS[key];
  return Array.isArray(allowed) && allowed.includes(to);
};
