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
 * Suggestion + FixEntity status literals.
 *
 * Duplicated from the model enums to keep this a dependency-light pure module.
 * Keep in sync if either enum changes. (Same pattern as suggestion.data-schemas.js.)
 */
const SUGGESTION = {
  NEW: 'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  SKIPPED: 'SKIPPED',
  FIXED: 'FIXED',
  ERROR: 'ERROR',
};

const FIX = {
  PENDING: 'PENDING',
  DEPLOYED: 'DEPLOYED',
  PUBLISHED: 'PUBLISHED',
  FAILED: 'FAILED',
  ROLLED_BACK: 'ROLLED_BACK',
};

/**
 * Normalizes a fix entry to its status string. Accepts a FixEntity model
 * instance (`getStatus()`), a plain `{ status }` object, or a status string.
 */
const toStatus = (fix) => {
  if (typeof fix === 'string') {
    return fix;
  }
  if (fix && typeof fix.getStatus === 'function') {
    return fix.getStatus();
  }
  return fix?.status;
};

/**
 * Derives a Suggestion's status from its fix entities — the **non-CWV (1:1)**
 * bubble-up from ADR adobe/mysticat-architecture#174 §"Bubble-up rule (non-CWV
 * opportunities)":
 *
 *   FAILED      -> ERROR
 *   PENDING     -> IN_PROGRESS
 *   DEPLOYED    -> FIXED
 *   PUBLISHED   -> FIXED
 *   ROLLED_BACK -> SKIPPED
 *
 * For a single fix this is exactly the ADR map. For multiple fixes it collapses
 * by severity (ERROR > IN_PROGRESS > FIXED > SKIPPED) so partial failure wins —
 * consistent with the CWV severity ordering. `Fix.REJECTED` is intentionally
 * absent: it is not in `FixEntity.STATUSES` (see SITES-47076).
 *
 * The **CWV multi-issue** bubble-up is deliberately NOT implemented here: the
 * ADR's per-issue vocabulary (`cwvIssueStatus` = PATCH_GENERATED / GUIDANCE_*
 * / PATCH_FAILED_*) does not match the data layer (mystique writes those into
 * the overloaded per-issue `status` field; the JS `ISSUE_STATUSES` enum lists
 * only Suggestion statuses). Reconciling that is a follow-up sub-task,
 * SITES-47285. Passing a non-empty `issues` argument throws to prevent a caller
 * from silently receiving an unimplemented CWV result.
 *
 * @param {Array<object|string>} fixes - fix entities / `{status}` / status strings
 * @param {Array<object>} [issues] - CWV per-issue data; MUST be empty for now
 * @returns {string|null} derived Suggestion status, or null if there are no fixes
 * @throws {Error} if a non-empty `issues` array is supplied (CWV deferred)
 */
export const deriveSuggestionStatus = (fixes, issues = []) => {
  if (Array.isArray(issues) && issues.length > 0) {
    throw new Error('deriveSuggestionStatus: CWV multi-issue bubble-up is not yet implemented (deferred to SITES-47285)');
  }

  if (!Array.isArray(fixes) || fixes.length === 0) {
    return null;
  }

  // Drop null/undefined entries (e.g. a sparse junction result) so one malformed
  // entry cannot nullify an otherwise well-defined derivation; degrades to the
  // same "no fixes" behavior as an empty array.
  const statuses = fixes.map(toStatus).filter((s) => s != null);
  if (statuses.length === 0) {
    return null;
  }

  if (statuses.includes(FIX.FAILED)) {
    return SUGGESTION.ERROR;
  }
  if (statuses.includes(FIX.PENDING)) {
    return SUGGESTION.IN_PROGRESS;
  }
  if (statuses.includes(FIX.DEPLOYED) || statuses.includes(FIX.PUBLISHED)) {
    return SUGGESTION.FIXED;
  }
  if (statuses.every((s) => s === FIX.ROLLED_BACK)) {
    return SUGGESTION.SKIPPED;
  }

  return null;
};
