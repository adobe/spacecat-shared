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

const MAX_RETRIES = 4;
const BASE_BACKOFF_MS = 2000; // 2s, 4s, 8s, 16s per Atlassian recommendation
// Hard ceiling on any single retry wait — prevents a rogue Retry-After value from
// blocking a Lambda for minutes.
const MAX_WAIT_MS = 30_000;

// Threshold below which remaining quota triggers a warning log.
// At ~10 k remaining, ops teams have time to react before exhaustion.
const LOW_QUOTA_THRESHOLD = 10_000;

// Quota-exhaustion reasons must fail fast — retrying wastes Lambda compute
// because quota windows last up to one hour.
const QUOTA_REASONS = new Set([
  'jira-quota-global-based',
  'jira-quota-tenant-based',
]);

/**
 * Decorator around a fetch-compatible HTTP client that handles Jira's three
 * independent rate-limit mechanisms per the architecture spec (PR #150).
 *
 * Strategy branched by `RateLimit-Reason` response header:
 *
 *   jira-burst-based / jira-per-issue-on-write
 *     → Retry with exponential backoff (2s, 4s, 8s, 16s) + jitter [0.7, 1.3].
 *       Up to MAX_RETRIES (4) retries. Uses `Retry-After` when present.
 *
 *   jira-quota-global-based / jira-quota-tenant-based
 *     → Fail fast. Quota windows can last hours — retrying inside a Lambda
 *       is wasted compute. Return the 429 immediately so the caller can surface
 *       a meaningful error to the user.
 *
 * Additionally reads `X-RateLimit-Remaining` on every response and logs a
 * warning when remaining capacity falls below LOW_QUOTA_THRESHOLD so operators
 * can request a Tier 2 (per-tenant) quota upgrade before exhaustion occurs.
 */
export default class RateLimitAwareHttpClient {
  constructor(httpClient, log) {
    this.httpClient = httpClient;
    this.log = log;
  }

  /**
   * Sends an HTTP request, applying rate-limit strategy based on `RateLimit-Reason`.
   *
   * @param {string} url
   * @param {object} options - fetch-compatible request options
   * @returns {Promise<Response>}
   */
  async fetch(url, options) {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      const response = await this.httpClient.fetch(url, options);

      this.#observeQuotaHeaders(response.headers);

      if (response.status !== 429) {
        return response;
      }

      const rateLimitReason = response.headers?.get?.('RateLimit-Reason') ?? 'unknown';

      // Quota exhaustion — fail fast, do not retry.
      if (QUOTA_REASONS.has(rateLimitReason?.toLowerCase())) {
        this.log.warn('Jira quota exhausted — failing fast', {
          url,
          rateLimitReason,
        });
        return response;
      }

      // Last attempt reached — return the 429 as-is.
      if (attempt === MAX_RETRIES) {
        return response;
      }

      const waitMs = this.#resolveWaitMs(response.headers, attempt);
      this.log.warn('Jira 429 -- backing off', {
        url,
        attempt: attempt + 1,
        maxRetries: MAX_RETRIES,
        waitMs,
        rateLimitReason,
      });

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, waitMs);
      });
    }

    /* c8 ignore next 2 */
    // unreachable — loop always returns inside the body on the last attempt
    return this.httpClient.fetch(url, options);
  }

  /**
   * Reads rate-limit observation headers from every response.
   *
   * - `X-RateLimit-Remaining`: warns when capacity is below threshold so operators
   *   can request a Tier 2 (per-tenant) quota upgrade before exhaustion.
   * - `X-RateLimit-Reset`: logged at debug level for diagnostics; shows when the
   *   current quota window resets (ISO 8601 timestamp per Atlassian docs).
   *
   * @param {Headers} headers
   */
  #observeQuotaHeaders(headers) {
    const remaining = parseInt(headers?.get?.('X-RateLimit-Remaining') ?? '', 10);
    if (Number.isFinite(remaining) && remaining < LOW_QUOTA_THRESHOLD) {
      this.log.warn('Jira quota running low', {
        remaining,
        threshold: LOW_QUOTA_THRESHOLD,
        resetAt: headers?.get?.('X-RateLimit-Reset') ?? undefined,
      });
    }

    // Log reset timestamp at debug level on every response (not just low-quota) so
    // operators can correlate quota windows in debug traces.
    const resetAt = headers?.get?.('X-RateLimit-Reset');
    if (resetAt) {
      this.log.debug('Jira rate-limit window', { resetAt });
    }
  }

  /**
   * Resolves wait time from `Retry-After` header, or falls back to exponential
   * backoff with Atlassian-recommended jitter range [0.7, 1.3].
   *
   * @param {Headers} headers
   * @param {number} attempt - zero-based attempt index
   * @returns {number} milliseconds to wait
   */
  // eslint-disable-next-line class-methods-use-this
  #resolveWaitMs(headers, attempt) {
    const retryAfter = headers?.get?.('Retry-After');
    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (Number.isFinite(seconds) && seconds > 0) {
        // Cap the server-supplied delay — a value of 86400 would block a Lambda for a day.
        return Math.min(seconds * 1000, MAX_WAIT_MS);
      }
    }
    // Jitter in [0.7, 1.3) per Atlassian best practice — spreads thundering herds
    // when many callers retry against the same rate limit simultaneously.
    const jitter = 0.7 + Math.random() * 0.6;
    return Math.round(BASE_BACKOFF_MS * (2 ** attempt) * jitter);
  }
}
