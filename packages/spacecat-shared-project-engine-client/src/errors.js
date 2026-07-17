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
 * The single typed error the transport facade throws from its `unwrap` seam. It carries the
 * failing HTTP `method`, the response `status` (or `undefined` when there was no HTTP response —
 * i.e. an exhausted-network / per-attempt-timeout failure), and the normalized parsed error
 * `body`. On the network/timeout path the original thrown error is preserved as `cause`.
 *
 * This class does NOT translate the failure into an HTTP status for the consumer, redact the
 * body, or map it onto a domain error — those are consumer-owned per ADR-0001. It exists only to
 * give consumers a single `instanceof`-checkable type with the raw `{ status, method, body }`.
 */
export class ProjectEngineApiError extends Error {
  /**
   * @param {number | undefined} status the HTTP response status, or `undefined` when there was no
   *   HTTP response (network / timeout failure)
   * @param {string} method the HTTP method of the failing request
   * @param {unknown | null} body the normalized parsed error body (`null` when empty/absent)
   * @param {{ cause?: unknown }} [options] optional `{ cause }` forwarded to `super`, so a wrapped
   *   network/timeout error keeps its original as `.cause`
   */
  constructor(status, method, body, options) {
    const message = status === undefined
      ? `Project Engine ${method} request failed`
      : `Project Engine ${method} request failed with status ${status}`;
    super(message, options);
    /** @type {string} */
    this.name = 'ProjectEngineApiError';
    /** @type {number | undefined} */
    this.status = status;
    /** @type {string} */
    this.method = method;
    /** @type {unknown | null} */
    this.body = body;
  }
}
