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

import createClient from 'openapi-fetch';
import { createRetryingFetch, toTokenGetter } from './internal.js';

/**
 * @typedef {import('./internal.js').AuthTokenSource} AuthTokenSource
 */

/**
 * A fully-typed Project Engine client (all operations from the generated `paths`).
 * @typedef {import('openapi-fetch').Client<import('./generated/types.js').paths>}
 *   SerenityProjectEngineApiClient
 */

/**
 * @typedef {object} SerenityProjectEngineApiClientOptions
 * @property {string} baseUrl Base URL of the Project Engine API. Point at the Counterfact
 *   mock for E2E / local dev.
 * @property {AuthTokenSource} authToken The caller's IMS JWT, or a (sync/async) getter
 *   resolved per request. Sent verbatim as the `Auth-Data-Jwt` header. The client performs
 *   NO token exchange or minting — Semrush validates the raw IMS token, and the `/serenity/*`
 *   routes opt out of the IMS→spacecat exchange, so the caller's token is forwarded as-is.
 * @property {number} [maxRetries=2] Retry attempts on 429 / retryable 5xx / network error.
 *   Default 2 (3 tries total).
 * @property {number} [retryBaseDelayMs=200] Base backoff in ms; grows exponentially per
 *   attempt. Default 200.
 * @property {typeof globalThis.fetch} [fetch] Injectable fetch (tests, custom agents).
 *   Defaults to the global fetch.
 */

/**
 * Builds the openapi-fetch middleware that forwards the caller's IMS token verbatim as the
 * `Auth-Data-Jwt` header.
 * @param {() => string | Promise<string>} getToken
 * @returns {import('openapi-fetch').Middleware}
 */
function authMiddleware(getToken) {
  return {
    async onRequest({ request }) {
      const token = await getToken();
      // Fail fast on a missing token rather than sending the literal string "undefined"
      // (or an empty header), which the server would reject with an opaque 401/403.
      if (!token) {
        throw new Error('Project Engine client: authToken resolved to an empty value');
      }
      request.headers.set('Auth-Data-Jwt', token);
      return request;
    },
  };
}

/**
 * Creates a thin, typed client over the generated Project Engine `paths`. It owns the base
 * URL, retries, and forwarding the caller's IMS JWT into the `Auth-Data-Jwt` header — and
 * nothing else; request/response shapes come straight from the generated types.
 * @param {SerenityProjectEngineApiClientOptions} options
 * @returns {SerenityProjectEngineApiClient}
 */
export function createSerenityProjectEngineApiClient(options) {
  const {
    baseUrl,
    authToken,
    maxRetries = 2,
    retryBaseDelayMs = 200,
    fetch: injectedFetch = globalThis.fetch,
  } = options;

  const client = createClient({
    baseUrl,
    fetch: createRetryingFetch(injectedFetch, maxRetries, retryBaseDelayMs),
  });
  client.use(authMiddleware(toTokenGetter(authToken)));
  return client;
}
