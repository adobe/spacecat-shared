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
// Idempotent HTTP methods safe to retry on 5xx — non-idempotent methods (POST, PUT, PATCH)
// must NOT be retried because the server may have processed the request before returning the
// error (split-brain), and retrying would create duplicate resources (e.g. duplicate Jira tickets).
// 429 rate-limit retries are always safe regardless of method — Jira rejected the request outright.
const SAFE_RETRY_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'DELETE']);
// Hard ceiling on any single retry wait — prevents a rogue Retry-After value from
// blocking a Lambda for minutes.
const MAX_WAIT_MS = 30_000;
// Per-attempt fetch timeout — prevents a hung Jira connection from blocking the Lambda
// until the 15-minute function timeout. AbortSignal.timeout() is available in Node 18+.
const FETCH_TIMEOUT_MS = 30_000;

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
 * 5xx / network errors are only retried for idempotent methods (GET, HEAD,
 * OPTIONS, DELETE). Non-idempotent methods (POST, PUT, PATCH) return the error
 * immediately — the server may have processed the request before failing, and
 * retrying would risk creating duplicate resources (e.g. duplicate Jira tickets).
 * 429 rate-limit retries apply to ALL methods since Jira rejected the request
 * outright and nothing was created.
 *
 * Additionally reads Atlassian's `X-RateLimit-NearLimit` signal (documented as
 * `true` when <20% of quota capacity remains) and logs a warning so operators
 * can request a Tier 2 (per-tenant) quota upgrade before exhaustion occurs.
 * NearLimit is used instead of a fixed numeric threshold on `X-RateLimit-Remaining`
 * because, per the Atlassian docs, Remaining is per-second for burst/request-rate
 * scopes (a fixed threshold would false-positive there) whereas NearLimit is only
 * emitted for the pool/quota scopes we actually want to warn on.
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
      // Per-attempt timeout — prevents hung connections from blocking the Lambda.
      // AbortSignal.timeout() is available in Node 18+ (Lambda runtime).
      // Only inject a signal when the caller hasn't provided one already.
      /* c8 ignore next 3 */
      const fetchOptions = options?.signal
        ? options
        : { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) };

      let response;
      try {
        // eslint-disable-next-line no-await-in-loop
        response = await this.httpClient.fetch(url, fetchOptions);
      } catch (err) {
        // Non-idempotent methods (POST, PUT, PATCH): do not retry on network errors.
        // The server may have processed the request before the connection dropped —
        // retrying would risk creating duplicate resources (e.g. duplicate Jira tickets).
        const method = (options?.method || 'GET').toUpperCase();
        if (attempt === MAX_RETRIES || !SAFE_RETRY_METHODS.has(method)) {
          throw err;
        }
        const waitMs = this.#resolveWaitMs(null, attempt);
        this.log.warn('Jira request failed (network/timeout) -- backing off', {
          url,
          attempt: attempt + 1,
          maxRetries: MAX_RETRIES,
          waitMs,
          error: err.message,
        });
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, waitMs);
        });
        // eslint-disable-next-line no-continue
        continue;
      }

      this.#observeQuotaHeaders(response.headers);

      const is429 = response.status === 429;
      const isRetriable5xx = response.status >= 500 && response.status !== 501;

      // Return immediately for anything that is neither a rate-limit (429)
      // nor a retriable server error (5xx except 501 Not Implemented).
      if (!is429 && !isRetriable5xx) {
        return response;
      }

      // 5xx on non-idempotent methods (POST, PUT, PATCH): return as-is, do not retry.
      // The server may have processed the request before returning the error — retrying
      // would risk creating duplicate resources (e.g. duplicate Jira tickets).
      // 429 is always safe to retry: Jira rejected the request outright, nothing was created.
      const method = (options?.method || 'GET').toUpperCase();
      if (isRetriable5xx && !SAFE_RETRY_METHODS.has(method)) {
        this.log.warn('Jira 5xx on non-idempotent method — not retrying', {
          url,
          method,
          status: response.status,
        });
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

      // Last attempt reached — log exhaustion and return as-is.
      if (attempt === MAX_RETRIES) {
        this.log.warn('Jira retry limit exhausted', {
          url,
          maxRetries: MAX_RETRIES,
          status: response.status,
          rateLimitReason,
        });
        return response;
      }

      const waitMs = this.#resolveWaitMs(response.headers, attempt);
      this.log.warn(`Jira ${response.status} -- backing off`, {
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
   * - `X-RateLimit-NearLimit`: Atlassian's documented near-capacity signal —
   *   `true` when <20% of quota capacity remains. Triggers a warning so operators
   *   can request a Tier 2 (per-tenant) quota upgrade before exhaustion. Preferred
   *   over a fixed numeric threshold on `X-RateLimit-Remaining`, whose value is
   *   per-second for burst scopes and would otherwise false-positive constantly.
   * - `X-RateLimit-Remaining` / `X-RateLimit-Limit`: included in the warning for
   *   context when available.
   * - `X-RateLimit-Reset`: per Atlassian docs, only returned on 429 responses.
   *   Logged at debug level when present so operators can correlate quota windows.
   *
   * @param {Headers} headers
   */
  #observeQuotaHeaders(headers) {
    // X-RateLimit-Reset is only returned on 429 responses per Atlassian docs, so
    // this is typically undefined on success paths.
    const resetAt = headers?.get?.('X-RateLimit-Reset') ?? undefined;

    if (headers?.get?.('X-RateLimit-NearLimit') === 'true') {
      const remaining = parseInt(headers?.get?.('X-RateLimit-Remaining') ?? '', 10);
      this.log.warn('Jira quota running low', {
        remaining: Number.isFinite(remaining) ? remaining : undefined,
        limit: headers?.get?.('X-RateLimit-Limit') ?? undefined,
        resetAt,
      });
    }

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
