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

import type { Client } from 'openapi-fetch';
import type { paths, components } from './generated/types.js';

/** Supplies the caller's IMS JWT — forwarded verbatim, never minted or exchanged. */
export type AuthTokenSource = string | (() => string | Promise<string>);

/** A fully-typed Project Engine client (all operations from the generated `paths`). */
export type SerenityProjectEngineApiClient = Client<paths>;

export interface SerenityProjectEngineApiClientOptions {
  /** Base URL of the Project Engine API. Point at the Counterfact mock for E2E / local dev. */
  baseUrl: string;
  /**
   * The caller's IMS JWT, or a (sync/async) getter resolved per request. Sent verbatim as
   * the `Auth-Data-Jwt` header. The client performs NO token exchange or minting — Semrush
   * validates the raw IMS token, and the `/serenity/*` routes opt out of the IMS→spacecat
   * exchange, so the caller's token is forwarded as-is.
   */
  authToken: AuthTokenSource;
  /** Retry attempts on 429 / retryable 5xx / network error. Default 2 (3 tries total). */
  maxRetries?: number;
  /** Base backoff in ms; grows exponentially per attempt. Default 200. */
  retryBaseDelayMs?: number;
  /** Injectable fetch (tests, custom agents). Defaults to the global fetch. */
  fetch?: typeof globalThis.fetch;
}

/**
 * Creates a thin, typed client over the generated Project Engine `paths`. It owns the base
 * URL, retries, and forwarding the caller's IMS JWT into the `Auth-Data-Jwt` header — and
 * nothing else; request/response shapes come straight from the generated types.
 */
export declare function createSerenityProjectEngineApiClient(
  options: SerenityProjectEngineApiClientOptions,
): SerenityProjectEngineApiClient;

// Re-export the generated contract types for consumers that want them directly.
export type { paths, components };
