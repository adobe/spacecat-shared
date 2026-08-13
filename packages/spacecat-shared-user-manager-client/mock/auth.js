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
 * Bearer-auth modelling for the User Manager mock.
 *
 * The live Semrush gateway rejects any request without a usable IMS bearer credential with
 * `401 { "detail": "Not authenticated" }` — the same Adobe gateway front that guards the Project
 * Engine surface (where a missing Authorization header AND a malformed `Bearer <garbage>` both 401;
 * only a valid IMS token is let through). The User Manager 401 body is the same, pinned by the live
 * replay (overlay CR1 expresses `Authorization: Bearer` as the scheme and drops the spec's
 * `Auth-Data-Jwt` header). The mock mirrors that at the gate: it requires `Authorization: Bearer
 * <token>` to be PRESENT but — being a test double, not an IMS verifier — does NOT validate the
 * token's contents. Every real API route guards on this via `context.authError($.headers)` (wired
 * onto the {@link Context}); the test-harness control routes (`/__reset`, `/__seed`, `/__dump`,
 * `/__quota`, `/__status`) are deliberately exempt, since they are plumbing, not part of the
 * emulated API surface.
 *
 * The 401 is returned as a plain `{ status, body, contentType }` so it bypasses Counterfact's
 * response-schema validation (the per-operation 401 schema is the Semrush error envelope, which
 * this `{ detail }` gateway body does not match) — the same raw-return mechanism the control routes
 * and the quota 422 use.
 */

/** Requires a non-empty token after the (case-insensitive) `Bearer ` scheme. */
const BEARER_RE = /^Bearer\s+\S/i;

/** The exact body the live gateway returns for a missing/invalid credential. */
export const UNAUTHENTICATED_BODY = Object.freeze({ detail: 'Not authenticated' });

/**
 * Reads the `Authorization` header case-insensitively. Node lowercases inbound header names, but a
 * raw caller (or a future transport) could send any case, so the lookup never assumes a casing.
 * @param {Record<string, unknown>} [headers] the request headers (`$.headers`)
 * @returns {string} the header value, or '' when absent
 */
function authorizationHeader(headers = {}) {
  const entry = Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization');
  return entry ? String(entry[1] ?? '') : '';
}

/**
 * True when the request carries a usable bearer credential (`Authorization: Bearer <token>`).
 * Presence-only, matching the level at which the mock emulates the gateway — it does not verify
 * the token itself.
 * @param {Record<string, unknown>} [headers] the request headers (`$.headers`)
 * @returns {boolean}
 */
export function isAuthorized(headers) {
  // `.trim()` is load-bearing: it strips a trailing-whitespace-only token (e.g. `'Bearer   '`)
  // down to `'Bearer'`, which then fails the `\s+\S` requirement. Without the trim the regex
  // would accept such a value, so keep them together if this is ever refactored.
  return BEARER_RE.test(authorizationHeader(headers).trim());
}

/**
 * The raw `401 { detail: 'Not authenticated' }` response, shaped to bypass Counterfact response
 * validation (see the module header).
 * @returns {{ status: number, body: { detail: string }, contentType: string }}
 */
export function unauthorizedResponse() {
  return { status: 401, body: { ...UNAUTHENTICATED_BODY }, contentType: 'application/json' };
}

/**
 * Route-handler guard: the 401 raw response when the request lacks a bearer credential, else
 * `null` (request is authorized → the handler proceeds). Wired onto the {@link Context} as
 * `authError`, so a handler short-circuits with
 * `const denied = $.context.authError($.headers); if (denied) { return denied; }`.
 * @param {Record<string, unknown>} [headers] the request headers (`$.headers`)
 * @returns {{ status: number, body: { detail: string }, contentType: string } | null}
 */
export function authError(headers) {
  return isAuthorized(headers) ? null : unauthorizedResponse();
}
