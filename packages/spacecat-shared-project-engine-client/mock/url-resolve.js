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
 * The URL-canonicalization the live Semrush Project Engine `GET /v1/url/resolve` performs — the
 * single source of truth behind the `mock/counterfact/routes/v1/url/resolve.js` handler, exposed on
 * the per-request context as `context.resolveUrl` (every route reads its lib helpers through
 * `$.context`, never an import — see {@link Context}). Kept a pure function so it is unit-tested on
 * its own (the route handler is coverage-excluded), the same convention as {@link tagId} /
 * `parentIdField`.
 *
 * Live contract (verified 2026-07-03 against prod `adobe-hackathon.semrush.com` — serenity-docs#25
 * §0): `primary_url` strips the scheme and a leading `www.` but PRESERVES any other subdomain and
 * the path (`http://www.lovesac.com/products` → `lovesac.com/products`; `https://blog.hubspot.com`
 * → `blog.hubspot.com`); `domain` is the registrable apex, stripping the subdomain too
 * (`blog.hubspot.com` → `hubspot.com`). For unresolvable/garbage input the live API returns
 * `{ domain: '', primary_url: '', is_valid: false }` with HTTP **200** (not an error) — the factory
 * default {@link createUrlResolveMock} IS that empty/invalid shape, so this returns only the
 * OVERRIDES for a valid input and an empty object (→ defaults) for an invalid one.
 *
 * MOCK SIMPLIFICATION: the apex is the last two dot-labels, so a multi-part public suffix
 * (`example.co.uk`) collapses to `co.uk` rather than `example.co.uk`. The live API uses the real
 * Public Suffix List. Faithful for the single-suffix domains the consumer resolves in practice
 * (`lovesac.com`, `hubspot.com`); documented here rather than pulling a PSL dependency into it.
 *
 * @param {unknown} primaryUrl the raw `primary_url` query value
 * @returns {{ domain: string, primary_url: string, is_valid: boolean } | {}} the resolve overrides
 *   for a valid URL, or `{}` (→ the empty/invalid factory default) for unresolvable input
 */
export const resolveUrl = (primaryUrl) => {
  const raw = typeof primaryUrl === 'string' ? primaryUrl.trim() : '';
  if (!raw) {
    return {};
  }

  let parsed;
  try {
    // A scheme-less input (`www.lovesac.com`) is not a valid URL on its own, so prepend `https://`
    // for parsing; an input that already carries a scheme is parsed as-is (its scheme is dropped
    // from the output regardless).
    const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw);
    parsed = new URL(hasScheme ? raw : `https://${raw}`);
  } catch {
    return {};
  }

  let host = parsed.hostname.toLowerCase();
  if (host.startsWith('www.')) {
    host = host.slice(4);
  }

  const labels = host.split('.');
  const tld = labels[labels.length - 1];
  // Require a dotted hostname whose last label is an alphabetic TLD (>=2 letters). This rejects a
  // bare single-label host, an empty label (`foo..com`), and an IP literal (`192.168.0.1`, whose
  // last label is numeric) — all of which the live API returns `is_valid: false` for.
  if (labels.length < 2 || labels.some((label) => label === '') || !/^[a-z]{2,}$/.test(tld)) {
    return {};
  }

  // Live preserves the path but drops a bare `/`; query/hash are not part of a brand URL.
  const path = parsed.pathname === '/' ? '' : parsed.pathname;
  return {
    domain: labels.slice(-2).join('.'),
    primary_url: `${host}${path}`,
    is_valid: true,
  };
};
