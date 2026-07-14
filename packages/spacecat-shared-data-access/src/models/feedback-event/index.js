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

// feedback_event has a client-supplied PK and is append-only, so it is NOT a
// data-access entity (no model/collection/schema/registry). This barrel only
// re-exports the shared constants + helpers consumed by spacecat-api-service
// (capture + ?include=reviews) and spacecat-jobs-dispatcher (the JSONL exporter):
// the enum vocabulary, the verdict<->signal translation, the API review view,
// and the single-sourced JSONL row contract.
export {
  REVIEW_SOURCES,
  REVIEW_VERDICTS,
  REVIEW_SIGNALS,
  REJECTION_CATEGORIES,
  FEEDBACK_TIERS,
  EXPORT_EXCLUDED_REJECTION_CATEGORIES,
  OPT_OUT_STRIPPED_FIELDS,
  SCHEMA_VERSION,
  verdictToSignal,
  signalToVerdict,
  toReviewView,
  shouldExport,
  toJsonlRow,
  buildJsonl,
} from './feedback-event.constants.js';
