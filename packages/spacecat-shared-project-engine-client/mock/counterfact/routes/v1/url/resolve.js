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
 * Static handler for GET /v1/url/resolve — the URL-canonicalization endpoint the consumer
 * (spacecat-api-service brand-URL write path + the Serenity migration CLI) calls before writing a
 * brand URL, so the stored value matches the canonical benchmark Semrush already holds. Added to
 * the spec by overlay CR16. Live shape: `{ domain, primary_url, is_valid }` (verified 2026-07-03
 * against prod — serenity-docs#25 §0). The canonicalization lives in `mock/url-resolve.js` (exposed
 * as `$.context.resolveUrl`) so it is unit-tested on its own; the empty/invalid default lives in
 * the factory (`createUrlResolveMock`), so a garbage input returns `{ domain: '', primary_url: '',
 * is_valid: false }` with HTTP 200 — never an error. A MISSING `primary_url` 400s at request
 * validation (the required query param) before this handler runs; an EMPTY value falls through here
 * and returns 200 is_valid:false (Counterfact enforces presence but not the spec's minLength:1, so
 * this one edge diverges from live's empty-400 — benign, the consumer keys off is_valid).
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** GET — canonicalize `primary_url` to `{ domain, primary_url, is_valid }` via the factory. */
export function GET($) {
  const overrides = $.context.resolveUrl($.query.primary_url);
  return $.response[200].json($.context.factories.createUrlResolveMock(overrides));
}
