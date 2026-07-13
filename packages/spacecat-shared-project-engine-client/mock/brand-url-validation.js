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
 * The `url` tag as the DEPLOYED gateway actually behaves — derived from the 2026-07-13 write-probe,
 * NOT from reading go-validator's source (the two disagree; see the `file:` note below).
 *
 * It lower-cases the value, runs go's `net/url.Parse`, and demands a non-empty scheme plus a
 * non-empty **host, fragment, or opaque** part. Reproduced by hand rather than through JS's `URL`,
 * whose WHATWG parsing differs from go's in exactly the cases that matter: it silently trims
 * surrounding whitespace (go rejects it), and it reports no `host` for the opaque forms go accepts.
 *
 * The `file:` scheme is exempt from the host/fragment/opaque rule entirely: every `file:` form
 * probed — `file:etc/passwd`, `file:/etc/passwd`, `file:///etc/passwd`, and even the empty
 * `file://` and `file:///` — cleared this tag and went on to fail `startswith`. (go-validator's
 * CURRENT source would instead reject `file://` and `file:///` here, on a path check the deployed
 * version evidently predates. The probe wins over the source.)
 *
 * @param {string} raw the non-empty `url` value
 * @returns {boolean} whether the live `url` tag would pass
 */
function isGoParseableUrl(raw) {
  const value = raw.toLowerCase();
  // go's parser rejects ASCII control bytes outright, and its host parser rejects a space; a
  // leading space also stops a scheme from being recognised. So any whitespace or control
  // character anywhere in the value means "did not parse".
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001F\u007F]/.test(value)) {
    return false;
  }
  const match = value.match(/^([a-z][a-z0-9+\-.]*):([\s\S]*)$/);
  if (!match) {
    return false; // no scheme → url.Scheme == "" → fail
  }
  const [, scheme, rest] = match;
  if (scheme === 'file') {
    return true; // exempt from the host/fragment/opaque rule — see above
  }

  // Split off the fragment, then classify the remainder: an authority (`//host/…`), a rooted path
  // (`/…`, which leaves go's Host AND Opaque empty), or opaque (`mailto:hi@x`, `https:x.com`).
  const hash = rest.indexOf('#');
  const fragment = hash === -1 ? '' : rest.slice(hash + 1);
  const beforeFragment = hash === -1 ? rest : rest.slice(0, hash);

  let host = '';
  let opaque = '';
  if (beforeFragment.startsWith('//')) {
    [host] = beforeFragment.slice(2).split(/[/?]/, 1);
  } else if (!beforeFragment.startsWith('/')) {
    opaque = beforeFragment;
  }
  return host !== '' || fragment !== '' || opaque !== '';
}

/**
 * The validation the live Semrush Project Engine `POST .../brand_urls` enforces on every entry —
 * the single source of truth behind the `brand_urls.js` route's 400, exposed on the per-request
 * context as `context.brandUrlHttpsTag` (every route reads its lib helpers through `$.context`,
 * never an import — see {@link Context}). Kept a pure function so it is unit-tested on its own (the
 * route handler is coverage-excluded), the same convention as {@link resolveUrl} / {@link tagId}.
 *
 * Live contract (write-probed 2026-07-13 against prod `adobe-hackathon.semrush.com`, throwaway
 * benchmarks in the LLMO-Dev-2 dev sub-workspace, serenity-docs#25): a brand URL MUST be a literal,
 * lower-case `https://` URL. `BrandURLRequest.URL` carries the go-validator tags
 * `required,url,startswith=https://`, evaluated in that order — and each tag's semantics are go's,
 * not JS's, which is what this helper reproduces:
 *
 * - `required` — the zero value fails. A missing field, `null` and `""` are all the empty string in
 *   go, so all three report `required` (NOT `url`).
 * - `url` — see {@link isGoParseableUrl}. A scheme-less value (`lovesac.com`, `www.x.com`,
 *   `//x.com`), a scheme with only a rooted path (`https:/x.com`), a bare `https://` or `https://#`
 *   (empty fragment), and anything containing whitespace all fail HERE. Note `https://#frag` PASSES
 *   — a non-empty fragment satisfies the tag even with no host.
 * - `startswith=https://` — `strings.HasPrefix` against the RAW value, so it is CASE-SENSITIVE, and
 *   it is reached by anything that parsed. `http://x`, `ftp://x`, an upper/mixed-case scheme
 *   (`HTTPS://X`, `Https://x`), every `file:` form, and the hostless-but-opaque forms
 *   (`mailto:hi@x`, `tel:+1`, `https:x.com`) all fail HERE, on `startswith` — not on `url`.
 *
 * A non-string `url` (e.g. `123`) never reaches the validator: go fails to unmarshal the body and
 * the gateway answers `400 {"message":"invalid request body"}` with no tag at all, which is what
 * `'invalid_body'` models. The `brand_urls` ROUTE never sees that case (nor a missing `url`) — the
 * spec marks `BrandURLRequest.url` required and typed, so Counterfact's request validation 400s
 * both before the handler runs. It is modelled here anyway so this function stays a total, truthful
 * record of the live contract rather than one narrowed to whatever the mock's schema layer lets
 * through. An empty string, by contrast, DOES satisfy the schema and reach the route → `required`.
 *
 * A conforming value returns null (accepted, stored verbatim — the API does NOT normalize the
 * scheme or `www.`, and it accepts an upper-case HOST, an IDN host, an IP and a port/path/query).
 * Enforcing all of this in the mock keeps an IT from going green over a write the live gateway
 * would 400 (the fidelity gap that let the url/resolve mis-design ship).
 *
 * @param {unknown} url the raw `url` field of a brand-URL entry
 * @returns {'invalid_body' | 'required' | 'url' | 'startswith' | null} the failed go-validator tag,
 *   `'invalid_body'` for a non-string value (unmarshal error, no tag), or null when accepted
 */
export const brandUrlHttpsTag = (url) => {
  // A present-but-non-string `url` fails go's JSON unmarshal before any tag runs.
  if (url !== undefined && url !== null && typeof url !== 'string') {
    return 'invalid_body';
  }
  // `required`: a missing field, `null` and `""` are all go's empty string.
  const value = typeof url === 'string' ? url : '';
  if (value === '') {
    return 'required';
  }
  // `url`: lower-case, parse, then scheme + (host | fragment | opaque).
  if (!isGoParseableUrl(value)) {
    return 'url';
  }
  // `startswith=https://`: strings.HasPrefix on the RAW value — case-sensitive.
  if (!value.startsWith('https://')) {
    return 'startswith';
  }
  return null;
};
