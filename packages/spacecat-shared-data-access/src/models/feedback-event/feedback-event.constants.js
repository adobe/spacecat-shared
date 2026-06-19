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
 * @fileoverview Shared constants + helpers for the human-review feedback loop
 * (SITES-43974). The `feedback_event` table has a client-supplied `event_id`
 * primary key and is append-only, so it is NOT modelled as a data-access entity
 * (the entity framework forces an auto-generated `id` PK). Producers and
 * consumers — `spacecat-api-service` (capture + ?include=reviews composition)
 * and `spacecat-jobs-dispatcher` (the daily JSONL exporter) — talk to the table
 * via the raw `postgrestClient`. These constants + the verdict<->signal
 * translation live here so the enum values and the JSONL contract never drift
 * across those repos.
 */

/**
 * Capture surface. Derived server-side from the API route (never trusted from
 * the request body — FR-10). Only `backoffice` is wired up for v1; `aso_ui` and
 * `aemy_pr` are reserved.
 */
export const REVIEW_SOURCES = Object.freeze({
  BACKOFFICE: 'backoffice',
  ASO_UI: 'aso_ui',
  AEMY_PR: 'aemy_pr',
});

/**
 * App-layer verdict — what the reviewer expresses in the UI / request body.
 */
export const REVIEW_VERDICTS = Object.freeze({
  UP: 'up',
  DOWN: 'down',
});

/**
 * Persisted training label on `feedback_event.signal`. Translated once from the
 * verdict at capture time (see {@link verdictToSignal}).
 */
export const REVIEW_SIGNALS = Object.freeze({
  POSITIVE: 'positive',
  NEGATIVE: 'negative',
});

/**
 * Optional ESE category on a reject. `product_bug` rows are filtered OUT of the
 * Learning Agent export (routed to Jira); `bad_recommendation` / `other` / NULL
 * are exported.
 */
export const REJECTION_CATEGORIES = Object.freeze({
  PRODUCT_BUG: 'product_bug',
  BAD_RECOMMENDATION: 'bad_recommendation',
  OTHER: 'other',
});

/**
 * Commerce tier of the reviewed site at review time.
 */
export const FEEDBACK_TIERS = Object.freeze({
  PAID: 'paid',
  FREE: 'free',
});

/**
 * Rejection categories whose rows must NOT be exported to the Learning Agent
 * training corpus (they describe product/detection bugs the LA cannot learn
 * from). The exporter filters these out; NULL-category rows are still exported.
 */
export const EXPORT_EXCLUDED_REJECTION_CATEGORIES = Object.freeze([
  REJECTION_CATEGORIES.PRODUCT_BUG,
]);

/**
 * Customer-derived fields stripped from the JSONL export for organizations with
 * `training_opt_in = false`. Verdict / signal / category / identity metadata
 * still ship.
 */
export const OPT_OUT_STRIPPED_FIELDS = Object.freeze([
  'previousFix',
  'editedFix',
  'detailMarkdown',
]);

/**
 * Translate the app-layer verdict to the persisted training signal. Single
 * source of truth shared by the capture handler and any consumer.
 *
 * @param {string} verdict - one of {@link REVIEW_VERDICTS}.
 * @returns {string} the corresponding {@link REVIEW_SIGNALS} value.
 * @throws {Error} if the verdict is not a recognised value.
 */
export function verdictToSignal(verdict) {
  if (verdict === REVIEW_VERDICTS.UP) {
    return REVIEW_SIGNALS.POSITIVE;
  }
  if (verdict === REVIEW_VERDICTS.DOWN) {
    return REVIEW_SIGNALS.NEGATIVE;
  }
  throw new Error(`Invalid review verdict: ${verdict}`);
}

/**
 * Inverse of {@link verdictToSignal} — translate a persisted signal back to the
 * app-layer verdict (used when composing reviews into an API response).
 *
 * @param {string} signal - one of {@link REVIEW_SIGNALS}.
 * @returns {string} the corresponding {@link REVIEW_VERDICTS} value.
 * @throws {Error} if the signal is not a recognised value.
 */
export function signalToVerdict(signal) {
  if (signal === REVIEW_SIGNALS.POSITIVE) {
    return REVIEW_VERDICTS.UP;
  }
  if (signal === REVIEW_SIGNALS.NEGATIVE) {
    return REVIEW_VERDICTS.DOWN;
  }
  throw new Error(`Invalid review signal: ${signal}`);
}

/**
 * Map a raw `feedback_event` row (snake_case, as returned by PostgREST) to the
 * API review view (camelCase, verdict-flavoured). The heavy patch fields
 * (`previous_fix` / `edited_fix`) are omitted unless `includePatches` is set —
 * they exist for training export, not for the default read response.
 *
 * @param {object} row - a raw feedback_event row from PostgREST.
 * @param {object} [options]
 * @param {boolean} [options.includePatches=false] - include previous/edited fix.
 * @returns {object} the review view object.
 */
export function toReviewView(row, { includePatches = false } = {}) {
  const view = {
    eventId: row.event_id,
    eventTime: row.event_time,
    source: row.source,
    verdict: signalToVerdict(row.signal),
    signal: row.signal,
    reviewerId: row.reviewer_id ?? null,
    detailMarkdown: row.detail_markdown ?? null,
    rejectionCategory: row.rejection_category ?? null,
    stateTransition: row.state_transition ?? null,
    tier: row.tier,
  };

  if (includePatches) {
    view.previousFix = row.previous_fix ?? null;
    view.editedFix = row.edited_fix ?? null;
  }

  return view;
}
