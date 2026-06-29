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
 * Static handler for GET /v1/languages — the language catalog the consumer
 * (spacecat-api-service `listLanguages`) reads to resolve an ISO 639-1 code to a Semrush language
 * UUID. The live shape is `{ page, total, items: [{ id, name }] }` — items carry NO key/icon (that
 * is the ai_models shape) and NO `iso` (that field is mock-only, for the read-view resolver). The
 * catalog (38 languages, real UUIDs + names, captured verbatim 2026-06-25) lives in
 * `mock/language-catalog.js` so it is shared with the project read-view factory rather than
 * duplicated here; it is exposed on the per-request context as `$.context.languageCatalog`.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** GET — list the language catalog `{ id, name }` (each row shaped via the factory). */
export function GET($) {
  const items = $.context.languageCatalog
    .map(({ id, name }) => $.context.factories.createLanguageMock({ id, name }));
  return $.response[200].json({ page: 1, total: items.length, items });
}
