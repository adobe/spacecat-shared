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

import type { Client, FetchResponse, MaybeOptionalInit, MediaType } from 'openapi-fetch';
import type { RequiredKeysOf } from 'openapi-typescript-helpers';
import type { paths, components } from './generated/types.js';

/** Supplies the caller's IMS JWT — forwarded verbatim, never minted or exchanged. */
export type AuthTokenSource = string | (() => string | Promise<string>);

/**
 * A fully-typed Project Engine client over every operation in the generated `paths`.
 * The generated `paths` are already free of the legacy `Auth-Data-Jwt` header (the live API
 * authenticates on `Authorization: Bearer`), so no runtime header narrowing is required here.
 */
export type SerenityProjectEngineApiClient = Client<paths>;

export interface SerenityProjectEngineApiClientOptions {
  /**
   * Base URL of the Project Engine API — the origin of `SEMRUSH_PROJECTS_BASE_URL`, or the
   * Counterfact mock's origin for E2E / local dev. Only `protocol//host` is used; the client
   * appends the fixed `/enterprise/projects/api` prefix itself.
   */
  baseUrl: string;
  /**
   * The caller's IMS JWT, or a (sync/async) getter resolved per request. Sent as the
   * `Authorization: Bearer <token>` header. The client performs NO token exchange or minting —
   * Semrush accepts the IMS bearer token directly, so the caller's token is forwarded as-is.
   */
  authToken: AuthTokenSource;
  /** Retry attempts on 429 / retryable 5xx / network error. Default 2 (3 tries total). */
  maxRetries?: number;
  /** Base backoff in ms; grows exponentially per attempt. Default 200. */
  retryBaseDelayMs?: number;
  /**
   * Best-effort hook invoked before each retry sleep, for logging/metrics. A retry loop is
   * otherwise silent. A throwing or rejecting hook is swallowed and never affects the request.
   * May be async; it is fire-and-forget (never awaited) so it cannot delay a retry.
   */
  onRetry?: (info: {
    attempt: number;
    delayMs: number;
    method: string;
    status?: number;
    error?: Error;
  }) => void | Promise<void>;
  /**
   * Per-attempt request deadline in ms. When set (> 0), each fetch attempt is aborted via
   * `AbortSignal.timeout` after this many ms (and retried for idempotent methods under the retry
   * budget); any caller-supplied `signal` is combined with it, never replaced. Unset ⇒ no
   * client-imposed deadline.
   */
  requestTimeoutMs?: number;
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

// ───────────────────────────────────────────────────────────────────────────
// Intent-named facade (transport) over the raw client.
//
// The three helpers below derive every facade method's parameter and return type
// straight from the generated `paths` contract, so the surface stays strictly
// in-spec and never degrades to `any`. They are internal to this declaration.
// ───────────────────────────────────────────────────────────────────────────

/**
 * The openapi-fetch `init` argument (params.path/query, body) accepted for a given
 * path `P` + HTTP method `M`, derived from the generated contract.
 */
type TransportInit<P extends keyof paths, M extends keyof paths[P]> = MaybeOptionalInit<
  paths[P],
  M
>;

/**
 * Mirror of openapi-fetch's own (unexported) `InitParam`: the `init` argument is
 * OPTIONAL when nothing in it is required (no path/query params, no required body),
 * and REQUIRED otherwise — so `listLanguages()` needs no argument while
 * `createProject({ params, body })` enforces its params + body at the call site.
 */
type TransportInitParam<Init> = RequiredKeysOf<Init> extends never
  ? [init?: Init]
  : [init: Init];

/**
 * The value a facade method resolves with: the parsed 2xx body for path `P` +
 * method `M`, or `null` for an empty body (e.g. a 204 / empty-body ack). Non-2xx
 * responses never resolve — they throw at the single `unwrap` error seam.
 */
type TransportData<P extends keyof paths, M extends keyof paths[P]> =
  | NonNullable<FetchResponse<paths[P][M], TransportInit<P, M>, MediaType>['data']>
  | null;

/**
 * Intent-named facade over {@link SerenityProjectEngineApiClient}. Wraps the 28 in-spec
 * Project Engine operations spacecat-api-service consumes behind verb+resource methods, so
 * consumers depend on this seam rather than the raw client's literal path strings. Each method
 * is THIN: it forwards the caller's openapi-fetch `init` to the underlying client and resolves
 * with the unwrapped 2xx body (or throws on a non-2xx / network error at a single seam). No
 * caching, redaction, error→HTTP translation, or composite methods — all consumer-owned per
 * ADR-0001. The remaining generated operations stay reachable via the raw client.
 */
export interface SerenityProjectEngineTransport {
  /** GET /v1/languages — projects-admin-list-languages */
  listLanguages(
    ...init: TransportInitParam<TransportInit<'/v1/languages', 'get'>>
  ): Promise<TransportData<'/v1/languages', 'get'>>;
  /** GET /v1/ai_models — ai-list-global-models */
  listGlobalAiModels(
    ...init: TransportInitParam<TransportInit<'/v1/ai_models', 'get'>>
  ): Promise<TransportData<'/v1/ai_models', 'get'>>;

  /** GET /v1/workspaces/{id}/projects — projects-list-projects */
  listProjects(
    ...init: TransportInitParam<TransportInit<'/v1/workspaces/{id}/projects', 'get'>>
  ): Promise<TransportData<'/v1/workspaces/{id}/projects', 'get'>>;
  /** POST /v1/workspaces/{id}/projects — projects-post-project */
  createProject(
    ...init: TransportInitParam<TransportInit<'/v1/workspaces/{id}/projects', 'post'>>
  ): Promise<TransportData<'/v1/workspaces/{id}/projects', 'post'>>;
  /** GET /v1/workspaces/{id}/projects/{project_id} — projects-get-project */
  getProject(
    ...init: TransportInitParam<TransportInit<'/v1/workspaces/{id}/projects/{project_id}', 'get'>>
  ): Promise<TransportData<'/v1/workspaces/{id}/projects/{project_id}', 'get'>>;
  /** PATCH /v1/workspaces/{id}/projects/{project_id} — projects-patch-project */
  updateProject(
    ...init: TransportInitParam<TransportInit<'/v1/workspaces/{id}/projects/{project_id}', 'patch'>>
  ): Promise<TransportData<'/v1/workspaces/{id}/projects/{project_id}', 'patch'>>;
  /** DELETE /v1/workspaces/{id}/projects/{project_id} — projects-delete-project */
  deleteProject(
    ...init: TransportInitParam<
      TransportInit<'/v1/workspaces/{id}/projects/{project_id}', 'delete'>
    >
  ): Promise<TransportData<'/v1/workspaces/{id}/projects/{project_id}', 'delete'>>;
  /** POST /v1/workspaces/{id}/projects/{project_id}/publish — projects-publish-project */
  publishProject(
    ...init: TransportInitParam<
      TransportInit<'/v1/workspaces/{id}/projects/{project_id}/publish', 'post'>
    >
  ): Promise<TransportData<'/v1/workspaces/{id}/projects/{project_id}/publish', 'post'>>;

  /** GET /v1/workspaces/{id}/projects/{project_id}/ai_models — ai-list-models */
  listAiModels(
    ...init: TransportInitParam<
      TransportInit<'/v1/workspaces/{id}/projects/{project_id}/ai_models', 'get'>
    >
  ): Promise<TransportData<'/v1/workspaces/{id}/projects/{project_id}/ai_models', 'get'>>;
  /** DELETE /v1/workspaces/{id}/projects/{project_id}/ai_models — ai-delete-models */
  deleteAiModels(
    ...init: TransportInitParam<
      TransportInit<'/v1/workspaces/{id}/projects/{project_id}/ai_models', 'delete'>
    >
  ): Promise<TransportData<'/v1/workspaces/{id}/projects/{project_id}/ai_models', 'delete'>>;
  /** GET /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks — ai-list-benchmarks */
  listBenchmarks(
    ...init: TransportInitParam<
      TransportInit<'/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', 'get'>
    >
  ): Promise<
    TransportData<'/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', 'get'>
  >;
  /** DELETE /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks — ai-delete-benchmarks */
  deleteBenchmarks(
    ...init: TransportInitParam<
      TransportInit<'/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', 'delete'>
    >
  ): Promise<
    TransportData<'/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', 'delete'>
  >;
  /**
   * PUT /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks/{benchmark_id}
   * — ai-update-benchmark
   */
  updateBenchmark(
    ...init: TransportInitParam<
      TransportInit<
        '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks/{benchmark_id}',
        'put'
      >
    >
  ): Promise<
    TransportData<
      '/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks/{benchmark_id}',
      'put'
    >
  >;
  /** PUT /v1/workspaces/{id}/projects/{project_id}/ci/competitors — ci-update-competitors */
  updateCompetitors(
    ...init: TransportInitParam<
      TransportInit<'/v1/workspaces/{id}/projects/{project_id}/ci/competitors', 'put'>
    >
  ): Promise<TransportData<'/v1/workspaces/{id}/projects/{project_id}/ci/competitors', 'put'>>;

  /** POST /v2/workspaces/{id}/projects/{project_id}/ai_models — aio-project-create-model */
  createAioModel(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/ai_models', 'post'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/ai_models', 'post'>>;
  /** POST /v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks — ai-create-benchmarks-v2 */
  createBenchmarks(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', 'post'>
    >
  ): Promise<
    TransportData<'/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', 'post'>
  >;

  /**
   * GET /v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls
   * — aio-list-brand-urls
   */
  listBrandUrls(
    ...init: TransportInitParam<
      TransportInit<
        '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls',
        'get'
      >
    >
  ): Promise<
    TransportData<
      '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls',
      'get'
    >
  >;
  /**
   * POST /v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls
   * — aio-create-brand-urls
   */
  createBrandUrls(
    ...init: TransportInitParam<
      TransportInit<
        '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls',
        'post'
      >
    >
  ): Promise<
    TransportData<
      '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls',
      'post'
    >
  >;
  /**
   * DELETE /v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls
   * — aio-delete-brand-urls
   */
  deleteBrandUrls(
    ...init: TransportInitParam<
      TransportInit<
        '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls',
        'delete'
      >
    >
  ): Promise<
    TransportData<
      '/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls',
      'delete'
    >
  >;

  /**
   * GET /v2/workspaces/{id}/projects/{project_id}/aio/init_status
   * — aio-get-project-init-status-v2
   */
  getProjectInitStatus(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/init_status', 'get'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/init_status', 'get'>>;
  /** POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts — aio-create-prompt-v2 */
  createPrompts(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts', 'post'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts', 'post'>>;
  /** DELETE /v2/workspaces/{id}/projects/{project_id}/aio/prompts — aio-delete-prompt-by-ids-v2 */
  deletePromptsByIds(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts', 'delete'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts', 'delete'>>;
  /**
   * POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags
   * — aio-list-prompts-by-tag-ids
   */
  listPromptsByTagIds(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags', 'post'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags', 'post'>>;
  /** PUT /v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags — aio-update-prompts-batch */
  updatePromptTags(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags', 'put'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags', 'put'>>;
  /**
   * POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename
   * — aio-rename-prompt
   */
  renamePrompt(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename', 'post'>
    >
  ): Promise<
    TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename', 'post'>
  >;
  /** GET /v2/workspaces/{id}/projects/{project_id}/aio/tags — aio-get-project-tags */
  listProjectTags(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/tags', 'get'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/tags', 'get'>>;
  /** POST /v2/workspaces/{id}/projects/{project_id}/aio/tags — aio-create-project-tags */
  createProjectTags(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/tags', 'post'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/tags', 'post'>>;
  /** PATCH /v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id} — aio-update-tag */
  updateProjectTag(
    ...init: TransportInitParam<
      TransportInit<'/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}', 'patch'>
    >
  ): Promise<TransportData<'/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}', 'patch'>>;
}

/**
 * Builds the {@link SerenityProjectEngineTransport} facade. Takes the SAME options as
 * {@link createSerenityProjectEngineApiClient} (it builds that client internally and adds no
 * options of its own).
 */
export declare function createSerenityProjectEngineTransport(
  options: SerenityProjectEngineApiClientOptions,
): SerenityProjectEngineTransport;

// Re-export the generated contract types for consumers that want them directly.
export type { paths, components };
