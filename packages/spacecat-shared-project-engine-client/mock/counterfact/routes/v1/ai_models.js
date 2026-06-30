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
 * Static handler for GET /v1/ai_models — the GLOBAL AI-model catalog (not workspace/project
 * scoped) the consumer (spacecat-api-service `listGlobalAiModels`) reads to populate the
 * "available models" list. Added to the spec by overlay CR1. Live shape:
 * `{ page, total, items: [{ id, name, key, icon }] }`. The taxonomy lives in
 * mock/ai-model-catalog.js (exposed as `$.context.aiModelCatalog`) so the project-scoped add
 * handler can resolve a posted `model_id` to the same model's name/icon — never an import, the
 * `$.context` lib-data convention. Materialized into `.counterfact/routes/` by the mock runner;
 * excluded from coverage.
 */

/** GET — list the global AI model catalog (each row shaped via the factory). */
export function GET($) {
  const items = $.context.aiModelCatalog.map((m) => $.context.factories.createAiModelMock(m));
  return $.response[200].json({ page: 1, total: items.length, items });
}
