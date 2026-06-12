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
 * Framework-agnostic building blocks for the Project Engine client.
 * Deliberately free of `openapi-fetch` and generated-type imports so they can be
 * unit-tested without the generated spec output being present.
 */

/**
 * Supplies the caller's IMS JWT — forwarded verbatim, never minted or exchanged.
 * @typedef {string | (() => string | Promise<string>)} AuthTokenSource
 */

const IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'PUT', 'DELETE', 'OPTIONS']);

/**
 * Resolves the HTTP method for a fetch call the same way the platform does.
 * @param {RequestInfo | URL} input
 * @param {RequestInit} [init]
 * @returns {string} the upper-cased method
 */
export function methodOf(input, init) {
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  return method.toUpperCase();
}

/**
 * @param {string} method
 * @returns {boolean} whether the method is safe to replay
 */
export function isIdempotent(method) {
  return IDEMPOTENT_METHODS.has(method);
}

/**
 * 429 is always retryable (the request wasn't processed). A 5xx is retried only for
 * idempotent methods, so a POST that may have already created a resource is never replayed.
 * @param {string} method
 * @param {number} status
 * @returns {boolean}
 */
export function isRetryableStatus(method, status) {
  if (status === 429) {
    return true;
  }
  if (status >= 500 && status <= 599) {
    return isIdempotent(method);
  }
  return false;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

/**
 * Wraps a fetch with bounded exponential-backoff retries. Retryable statuses follow
 * {@link isRetryableStatus}; thrown network errors are retried only for idempotent methods.
 * After exhausting retries it returns the last retryable response (so the caller still
 * sees e.g. the final 503) or rethrows the last network error.
 * @param {typeof globalThis.fetch} baseFetch
 * @param {number} maxRetries
 * @param {number} baseDelayMs
 * @returns {typeof globalThis.fetch}
 */
export function createRetryingFetch(baseFetch, maxRetries, baseDelayMs) {
  return async function retryingFetch(input, init) {
    const method = methodOf(input, init);
    // openapi-fetch calls us with a Request object; fetch() consumes its body on use, so a
    // bare replay throws "Request ... already used". Clone per attempt and never touch the
    // original, so every retry (incl. a 429 on a bodied POST) sends a fresh, unconsumed body.
    const forAttempt = () => (input instanceof Request ? input.clone() : input);
    let lastResponse;
    let lastError;

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      if (attempt > 0) {
        // eslint-disable-next-line no-await-in-loop
        await sleep(baseDelayMs * 2 ** (attempt - 1));
      }
      try {
        // eslint-disable-next-line no-await-in-loop
        const response = await baseFetch(forAttempt(), init);
        if (!isRetryableStatus(method, response.status)) {
          return response;
        }
        lastResponse = response;
      } catch (error) {
        if (!isIdempotent(method)) {
          throw error;
        }
        lastError = error;
      }
    }

    if (lastResponse) {
      return lastResponse;
    }
    throw lastError;
  };
}

/**
 * Normalises an {@link AuthTokenSource} into a getter, so callers can pass either a static
 * token or a (sync/async) function resolved per request.
 * @param {AuthTokenSource} source
 * @returns {() => string | Promise<string>}
 */
export function toTokenGetter(source) {
  return typeof source === 'function' ? source : () => source;
}
