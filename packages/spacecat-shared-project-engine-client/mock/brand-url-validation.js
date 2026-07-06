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

// @ts-check

/**
 * The `url` validation the live Semrush Project Engine `POST .../brand_urls` enforces on every
 * entry — the single source of truth behind the `brand_urls.js` route's 400, exposed on the
 * per-request context as `context.brandUrlHttpsTag` (every route reads its lib helpers through
 * `$.context`, never an import — see {@link Context}). Kept a pure function so it is unit-tested on
 * its own (the route handler is coverage-excluded), the same convention as {@link resolveUrl} /
 * {@link tagId}.
 *
 * Live contract (write-probed 2026-07-06 against prod `adobe-hackathon.semrush.com` — a throwaway
 * benchmark in a test workspace, serenity-docs#25): a brand URL MUST be a literal `https://` URL.
 * The go-validator on `BrandURLRequest.URL` runs two tags in order:
 *   - `url`: the value must be a parseable absolute URL (scheme + host). A scheme-less value
 *     (`instagram.com/lovesac`, `lovesac.com`, `www.x.com`) fails HERE → 400 `'url' tag`.
 *   - `startswith=https://`: a valid but non-https URL (`http://x`, `ftp://x`) passes `url` but
 *     fails HERE → 400 `'startswith' tag`.
 * A conforming `https://…` value returns null (accepted, stored verbatim — the API does NOT
 * normalize scheme/`www.`). Enforcing this in the mock keeps an IT from going green over a write
 * the live gateway would 400 (the fidelity gap that let the url/resolve mis-design ship).
 *
 * @param {unknown} url the raw `url` field of a brand-URL entry
 * @returns {'url' | 'startswith' | null} the failed go-validator tag, or null when accepted
 */
export const brandUrlHttpsTag = (url) => {
  const value = typeof url === 'string' ? url : '';
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    // Not a parseable absolute URL (scheme-less / garbage) — fails the `url` tag.
    return 'url';
  }
  // A URL with no host (e.g. `mailto:hi@x.com`) is not a brand URL either → `url` tag.
  if (!parsed.host) {
    return 'url';
  }
  // Valid URL, but the value must literally begin with `https://` (case-insensitive scheme).
  if (!value.toLowerCase().startsWith('https://')) {
    return 'startswith';
  }
  return null;
};
