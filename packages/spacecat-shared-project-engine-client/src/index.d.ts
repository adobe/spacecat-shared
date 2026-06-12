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

import type { Client } from 'openapi-fetch';
import type { paths, components } from './generated/types.js';

/** Supplies the caller's IMS JWT — forwarded verbatim, never minted or exchanged. */
export type AuthTokenSource = string | (() => string | Promise<string>);

/**
 * The client authenticates each request with `Authorization: Bearer <IMS token>` via middleware
 * — a header that is NOT part of the generated `paths`, so it never appears on the typed surface
 * and needs no narrowing. The generated `paths`, however, still mark the Semrush-native
 * `Auth-Data-Jwt` header as a required per-operation param. Against the Adobe-hosted gateway that
 * header is injected server-side (the gateway exchanges the bearer for Semrush's credential), so
 * a consumer must neither be forced to pass it nor be able to. The client therefore exposes a
 * NARROWED view of `paths` that drops `Auth-Data-Jwt` from each operation's header params.
 *
 * This is a type-only transform over the client's PUBLIC surface. The generated `paths` (and
 * the vendored spec / Pydantic models) are intentionally left untouched — they remain the
 * honest API contract; only the client surface hides the gateway-injected header.
 */
type HttpMethod = 'get' | 'put' | 'post' | 'delete' | 'options' | 'head' | 'patch' | 'trace';

/**
 * The header params of an operation with `Auth-Data-Jwt` removed. If that leaves no headers
 * (the case for every current operation — it's the only header in the contract), this is
 * `never`, so passing a header at all is a compile error: in the gateway flow `Auth-Data-Jwt`
 * is injected server-side, so a consumer must not pass it. If the contract ever gains a genuine
 * consumer header, the remaining bag is preserved instead.
 */
type NarrowedHeader<Params> = Params extends { header?: infer Header }
  ? Omit<NonNullable<Header>, 'Auth-Data-Jwt'> extends infer Rest
    ? [keyof Rest] extends [never] ? never : Rest
    : never
  : never;

/**
 * Drops the gateway-injected `Auth-Data-Jwt` from a single operation's header params and makes
 * the header bag optional. Non-operation values (e.g. `never` for unused methods) pass through
 * unchanged.
 */
type WithoutAuthHeader<Operation> = Operation extends { parameters: infer Params }
  ? Omit<Operation, 'parameters'> & {
    parameters: Omit<Params, 'header'> & { header?: NarrowedHeader<Params> };
  }
  : Operation;

/** Applies the header narrowing to every HTTP method on one path item. */
type WithoutAuthHeaderPath<PathItem> = {
  [Method in keyof PathItem]: Method extends HttpMethod
    ? WithoutAuthHeader<PathItem[Method]>
    : PathItem[Method];
};

/**
 * `paths` as exposed by the client: identical to the generated contract except the
 * gateway-injected `Auth-Data-Jwt` header is removed from every operation.
 */
export type ClientPaths = {
  [Path in keyof paths]: WithoutAuthHeaderPath<paths[Path]>;
};

/** A fully-typed Project Engine client over every operation in the (narrowed) `paths`. */
export type SerenityProjectEngineApiClient = Client<ClientPaths>;

export interface SerenityProjectEngineApiClientOptions {
  /**
   * Base URL of the Project Engine gateway — the origin of `SEMRUSH_PROJECTS_BASE_URL`, or the
   * Counterfact mock's origin for E2E / local dev. Only `protocol//host` is used; the client
   * appends the fixed `/enterprise/projects/api` prefix itself.
   */
  baseUrl: string;
  /**
   * The caller's IMS JWT, or a (sync/async) getter resolved per request. Sent as the
   * `Authorization: Bearer <token>` header. The client performs NO token exchange or minting —
   * the Adobe-hosted gateway authenticates the raw IMS bearer and exchanges it for Semrush's
   * native credential server-side, so the caller's token is forwarded as-is.
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
 * URL (origin + `/enterprise/projects/api`), retries, and authenticating each request with the
 * caller's IMS JWT as `Authorization: Bearer` — and nothing else; request/response shapes come
 * straight from the generated types.
 */
export declare function createSerenityProjectEngineApiClient(
  options: SerenityProjectEngineApiClientOptions,
): SerenityProjectEngineApiClient;

// Re-export the generated contract types for consumers that want them directly.
export type { paths, components };
