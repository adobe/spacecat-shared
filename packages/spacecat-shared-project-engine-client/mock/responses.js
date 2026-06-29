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
 * Shared raw-response shapes for the Project Engine mock.
 *
 * Counterfact runs a bare `{ status, body }` return through response content-negotiation: it
 * picks a representation for the request's `Accept` header. An empty-body 2xx (the live "action
 * ack" — publish / batch-delete / update-benchmark, all `content-length: 0` live) declares no
 * `application/json` representation, so when the caller sends `Accept: application/json` — which
 * the real serenity transport in `spacecat-api-service` does on EVERY call — Counterfact has
 * nothing to serve and answers **406 Not Acceptable** instead of the intended 2xx. The real
 * Semrush gateway never does this: a no-content response is returned regardless of `Accept`.
 *
 * The fix is the same raw-return bypass `auth.js` (the 401) and `quota.js` (the disguised 405)
 * already rely on: a `{ status, body, contentType }` literal carries an explicit content type, so
 * Counterfact skips negotiation/validation and serves the response verbatim. {@link emptyAck}
 * centralizes that shape so empty-body ack handlers can't reintroduce the negotiation 406.
 *
 * NOTE — this is for `2xx` acks that carry an EMPTY body but are NOT `204`. A bare
 * `{ status: 204 }` is already safe: Counterfact special-cases `204 No Content` and serves it
 * without negotiating (verified 2026-06-29 — `204` returns `204` under `Accept: application/json`,
 * while `202, body: ''` 406s), so the `204` delete handlers deliberately do NOT go through here —
 * a 204 carries no body and (per HTTP) no `Content-Type`, which the bare return preserves.
 */

/**
 * An empty-body 2xx ack shaped to bypass Counterfact's response content-negotiation, mirroring
 * the live gateway's `content-length: 0` action acks. The `contentType` is what makes Counterfact
 * skip negotiation; the body stays empty and the consumer keys off `response.ok`/status only, so
 * `application/json` (matching the caller's `Accept`) is the natural, negotiation-satisfying
 * choice. Use for empty-body `202`-class acks; `204 No Content` needs no helper (see module note).
 * @param {number} [status] the 2xx status to ack with (defaults to the publish/action-ack `202`)
 * @returns {{ status: number, body: string, contentType: string }}
 */
export function emptyAck(status = 202) {
  return { status, body: '', contentType: 'application/json' };
}
