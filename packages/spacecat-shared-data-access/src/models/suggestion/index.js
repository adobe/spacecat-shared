/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import Suggestion from './suggestion.model.js';
import SuggestionCollection from './suggestion.collection.js';

export {
  Suggestion,
  SuggestionCollection,
};

// Export DATA_SCHEMAS for api-service to reference
export const { DATA_SCHEMAS } = Suggestion;

// Re-export per-issue lifecycle constants so consumers (audit-worker, autofix-worker,
// api-service, Mystique) can validate per-issue values without duplicating enum lists.
export {
  CWV_METRIC_TYPES,
  ISSUE_STATUSES,
  ISSUE_SKIP_REASONS,
} from './suggestion.data-schemas.js';

// Suggestion status transition table + predicate, and the 1:1 bubble-up
// (SITES-47091). CWV multi-issue bubble-up deferred (see derive-status.js).
export {
  SUGGESTION_TRANSITIONS,
  SUGGESTION_CREATE,
  isAllowedSuggestionTransition,
} from './suggestion.transitions.js';
export { deriveSuggestionStatus } from './derive-status.js';
