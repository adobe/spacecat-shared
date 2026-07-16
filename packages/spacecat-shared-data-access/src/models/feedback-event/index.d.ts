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

export const REVIEW_SOURCES: Readonly<{
  BACKOFFICE: 'backoffice';
  ASO_UI: 'aso_ui';
  AEMY_PR: 'aemy_pr';
}>;

export const REVIEW_VERDICTS: Readonly<{ UP: 'up'; DOWN: 'down' }>;

export const REVIEW_SIGNALS: Readonly<{ POSITIVE: 'positive'; NEGATIVE: 'negative' }>;

export const REJECTION_CATEGORIES: Readonly<{
  PRODUCT_BUG: 'product_bug';
  BAD_RECOMMENDATION: 'bad_recommendation';
  OTHER: 'other';
}>;

export const FEEDBACK_TIERS: Readonly<{ PAID: 'paid'; FREE: 'free' }>;

export const EXPORT_EXCLUDED_REJECTION_CATEGORIES: ReadonlyArray<string>;

/** snake_case JSONL/DB field names stripped from the export for opted-out orgs. */
export const OPT_OUT_STRIPPED_FIELDS: ReadonlyArray<string>;

/** Current JSONL row schema version stamped on every exported line. */
export const SCHEMA_VERSION: number;

/** Translate the app-layer verdict (`up`/`down`) to the persisted signal. */
export function verdictToSignal(verdict: string): 'positive' | 'negative';

/** Translate a persisted signal (`positive`/`negative`) back to the verdict. */
export function signalToVerdict(signal: string): 'up' | 'down';

export interface ReviewView {
  eventId: string;
  eventTime: string;
  source: string;
  verdict: 'up' | 'down';
  signal: 'positive' | 'negative';
  reviewerId: string | null;
  detailMarkdown: string | null;
  rejectionCategory: string | null;
  stateTransition: string | null;
  tier: string;
  feedbackSubjectId: string | null;
  previousFix?: unknown;
  editedFix?: unknown;
  guidanceMarkdown?: string | null;
}

/**
 * Map a raw PostgREST `feedback_event` row to the API review view (HTTP
 * responses). Returns null when no row is given. NOT for JSONL export.
 */
export function toReviewView(
  row: Record<string, unknown>,
  options?: { includePatches?: boolean },
): ReviewView | null;

/** Whether a raw feedback_event row should be exported to the LA corpus. */
export function shouldExport(row: Record<string, unknown>): boolean;

/**
 * Map a raw PostgREST `feedback_event` row to one JSONL export line (snake_case,
 * schema_version-stamped). Customer-derived fields are nulled when optedIn=false.
 */
export function toJsonlRow(
  row: Record<string, unknown>,
  options?: { optedIn?: boolean },
): Record<string, unknown>;

/** Build the JSONL export body (filtered + mapped) from raw feedback_event rows. */
export function buildJsonl(
  rows: Array<Record<string, unknown>>,
  options?: { optedIn?: boolean },
): string;
