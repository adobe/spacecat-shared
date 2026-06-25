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

/* eslint-disable no-unused-vars -- Counterfact passes a single `$` context object to handlers. */

/**
 * Static handler for GET /v1/ai_models — the GLOBAL AI-model catalog (not workspace/project
 * scoped) the consumer (spacecat-api-service `listGlobalAiModels`) reads to populate the
 * "available models" list. Added to the spec by overlay CR1. Live shape:
 * `{ page, total, items: [{ id, name, key, icon }] }` (verified 2026-06-25). Distinct path from
 * the project-scoped `…/projects/{pid}/ai_models`. Excluded from coverage (materialized handler).
 */

const MODELS = [
  {
    id: 'eab23d14-df70-463f-8779-3f6a4ba770bc', name: 'ChatGPT', key: 'search-gpt', icon: 'openai',
  },
  {
    id: 'ee6a9130-3d57-4196-b1a2-43a6edd2d0d6', name: 'OpenEvidence', key: 'open-evidence', icon: 'openEvidence',
  },
];

/** GET — list the global AI model catalog. */
export function GET($) {
  return $.response[200].json({ page: 1, total: MODELS.length, items: MODELS });
}
