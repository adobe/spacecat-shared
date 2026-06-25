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

// @ts-check

/**
 * Bearer-auth guard injection for the Project Engine mock's materialized handlers.
 *
 * Lives in its own module (not inline in run.js) so it is a pure, side-effect-free string
 * transform that can be unit-tested directly — run.js itself launches the server at import time
 * and is coverage-excluded, so the auth-bypass safety net below would otherwise have no gate.
 *
 * Prepends a `context.authError($.headers)` gate to every materialized handler so each real route
 * rejects a request lacking `Authorization: Bearer <token>` with the live gateway's
 * `401 { detail: 'Not authenticated' }` before running (see mock/auth.js, wired as
 * `context.authError`). It is applied at the single materialization seam rather than hand-written
 * into every handler: bearer auth is cross-cutting (it gates ALL routes, unlike the per-op quota
 * check), so a central injection means no current or future handler can forget it, and the
 * committed handler source stays focused on its behaviour. The `__*` control routes
 * (reset/seed/dump/quota) are test-harness plumbing, not part of the emulated API, so they are
 * exempt. The guard returns a raw `{ status, body, contentType }`, which bypasses Counterfact
 * response validation (401 is not declared per-operation) — the same mechanism the quota 405 uses.
 *
 * The guard match is asserted, not best-effort: `declaredMethods` counts every exported HTTP
 * method in ANY shape (function or `const` arrow, all of GET/POST/PUT/PATCH/DELETE/OPTIONS/HEAD),
 * while the guard is only injected into the canonical `export function VERB($) { … }` shape. So a
 * handler authored in a shape the guard regex does not match — an arrow `export const GET = ($) =>
 * …`, a destructured/renamed param, or an `OPTIONS`/`HEAD` verb — is counted but not guarded,
 * making `guarded !== declaredMethods` and throwing. Without this an unmatched handler would
 * silently materialize UNGUARDED and serve unauthenticated — an auth bypass that would pass every
 * gate. The throw turns that latent drift into a loud materialization failure.
 */

/** Exported HTTP methods in any declaration shape — the count the guard must match. */
const DECLARED_METHOD = /export\s+(?:(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*\(|const\s+(?:GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\s*=)/g;

/** The canonical guardable shape: `export [async] function VERB($) {`. */
const GUARDABLE_METHOD = /(export\s+(?:async\s+)?function\s+(?:GET|POST|PUT|PATCH|DELETE)\s*\(\$\)\s*\{)/g;

/**
 * Prepends the bearer-auth guard to every exported method of a route handler.
 * @param {string} source the handler's committed `.js` source
 * @param {string} fileName the handler's base file name
 * @returns {string} source with a guard prepended to each guardable method body
 */
export function injectAuthGuard(source, fileName) {
  if (fileName.startsWith('__')) {
    return source;
  }
  const guard = '\n  const __authDenied = $.context.authError($.headers);'
    + '\n  if (__authDenied) { return __authDenied; }';
  const declaredMethods = (source.match(DECLARED_METHOD) ?? []).length;
  let guarded = 0;
  const out = source.replace(GUARDABLE_METHOD, (match) => {
    guarded += 1;
    return `${match}${guard}`;
  });
  if (guarded !== declaredMethods) {
    throw new Error(
      `injectAuthGuard: ${fileName} declares ${declaredMethods} HTTP method export(s) but only `
      + `${guarded} matched the guard pattern — a handler signature is unguarded and would serve `
      + 'unauthenticated. Author real-route handlers as `export function VERB($) { … }`.',
    );
  }
  return out;
}
