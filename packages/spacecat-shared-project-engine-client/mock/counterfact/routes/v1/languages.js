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
 * Static handler for GET /v1/languages — the language catalog the consumer
 * (spacecat-api-service `listLanguages`) reads to resolve an ISO 639-1 code to a Semrush
 * language UUID. The live shape is `{ page, total, items: [{ id, name }] }` (verified
 * 2026-06-25, see docs/mock-vs-live-parity.md) — items carry NO key/icon (that is the
 * ai_models shape). A small, stable, spec-shaped slice is enough for the contract test.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

const LANGUAGES = [
  { id: '5a0a33ed-7f5c-4901-befd-a042c0350da1', name: 'English' },
  { id: '728bef4c-94cf-4e14-bc06-56534751c71a', name: 'Bulgarian' },
  { id: '7d3efff9-f6b6-4818-ac6b-0d1d2c047803', name: 'Arabic' },
];

/** GET — list the language catalog. */
export function GET($) {
  return $.response[200].json({ page: 1, total: LANGUAGES.length, items: LANGUAGES });
}
