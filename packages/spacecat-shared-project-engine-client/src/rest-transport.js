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

import { createSerenityProjectEngineApiClient } from './client.js';

/**
 * @typedef {import('./client.js').SerenityProjectEngineApiClientOptions}
 *   SerenityProjectEngineApiClientOptions
 */

/**
 * Intent-named facade over the raw {@link createSerenityProjectEngineApiClient} openapi-fetch
 * client. It wraps ONLY the 28 in-spec Project Engine operations that spacecat-api-service
 * consumes, behind verb+resource method names, so consumers depend on this seam rather than the
 * raw client and its literal path strings. Each method is THIN: it forwards the caller's
 * openapi-fetch `init` (params.path/query, body) to `client.<METHOD>('<literal path>', init)` and
 * routes the result through the single {@link unwrap} error seam. There is deliberately NO caching,
 * redaction, error→HTTP translation, or composite/convenience method here — all consumer-owned per
 * ADR-0001. The remaining generated operations stay reachable via the raw client; add a facade
 * method only when a real second consumer needs one.
 *
 * @param {SerenityProjectEngineApiClientOptions} options The SAME options as the raw client — the
 *   facade adds none of its own. Builds the underlying client via
 *   {@link createSerenityProjectEngineApiClient}.
 * @returns {import('./index.js').SerenityProjectEngineTransport}
 */
export function createSerenityProjectEngineTransport(options) {
  const client = createSerenityProjectEngineApiClient(options);

  /**
   * The SINGLE seam where a failed call becomes a throw. It awaits the openapi-fetch result
   * promise here (so a network/timeout rejection also flows through this one point), and on a
   * non-2xx response throws. The typed client never throws on an HTTP error — it resolves to
   * `{ data, error, response }` with the parsed error body in `error` — so a non-2xx is turned
   * into a throw here; a 2xx returns the parsed body (or null for an empty body).
   *
   * `status`, `method`, and the normalized `body` are computed locally at this site FIRST so the
   * follow-up ticket LLMO-5978 can swap ONLY the `new Error(...)` line below for
   * `new ProjectEngineApiError(status, method, body)` without reshaping anything else here.
   *
   * @template T
   * @param {string} method the HTTP method, for the error message
   * @param {Promise<{ data?: T, error?: unknown, response: Response }>} resultPromise the pending
   *   openapi-fetch result
   * @returns {Promise<NonNullable<T> | null>} the parsed success body, or null for an empty body
   *   (an empty-body operation resolves with null, never undefined)
   */
  async function unwrap(method, resultPromise) {
    const { data, error, response } = await resultPromise;
    if (!response.ok) {
      const { status } = response;
      // openapi-fetch surfaces an empty error body as '' (not undefined); normalise it to null.
      const rawBody = error ?? data ?? null;
      // `body` is computed here but not consumed by the plain Error below. LLMO-5978 swaps ONLY
      // the `new Error(...)` line for `new ProjectEngineApiError(status, method, body)` — status,
      // method, and this normalized body are all already in scope, so nothing else here changes.
      // eslint-disable-next-line no-unused-vars
      const body = rawBody === '' ? null : rawBody;
      // Message deliberately omits the request URL: it embeds path-param ids (workspace/
      // project/etc.) that error-reporter and log consumers should not receive by default.
      throw new Error(`Project Engine ${method} failed: ${status}`);
    }
    return data ?? null;
  }

  return {
    // ─── /v1 catalog ────────────────────────────────────────────────────────
    /** GET /v1/languages — projects-admin-list-languages */
    listLanguages(init) {
      return unwrap('GET', client.GET('/v1/languages', init));
    },
    /** GET /v1/ai_models — ai-list-global-models */
    listGlobalAiModels(init) {
      return unwrap('GET', client.GET('/v1/ai_models', init));
    },

    // ─── /v1 projects ───────────────────────────────────────────────────────
    /** GET /v1/workspaces/{id}/projects — projects-list-projects */
    listProjects(init) {
      return unwrap('GET', client.GET('/v1/workspaces/{id}/projects', init));
    },
    /** POST /v1/workspaces/{id}/projects — projects-post-project */
    createProject(init) {
      return unwrap('POST', client.POST('/v1/workspaces/{id}/projects', init));
    },
    /** GET /v1/workspaces/{id}/projects/{project_id} — projects-get-project */
    getProject(init) {
      return unwrap('GET', client.GET('/v1/workspaces/{id}/projects/{project_id}', init));
    },
    /** PATCH /v1/workspaces/{id}/projects/{project_id} — projects-patch-project */
    updateProject(init) {
      return unwrap('PATCH', client.PATCH('/v1/workspaces/{id}/projects/{project_id}', init));
    },
    /** DELETE /v1/workspaces/{id}/projects/{project_id} — projects-delete-project */
    deleteProject(init) {
      return unwrap('DELETE', client.DELETE('/v1/workspaces/{id}/projects/{project_id}', init));
    },
    /** POST /v1/workspaces/{id}/projects/{project_id}/publish — projects-publish-project */
    publishProject(init) {
      return unwrap('POST', client.POST('/v1/workspaces/{id}/projects/{project_id}/publish', init));
    },

    // ─── /v1 AI models + benchmarks ───────────────────────────────────────────
    /** GET /v1/workspaces/{id}/projects/{project_id}/ai_models — ai-list-models */
    listAiModels(init) {
      return unwrap('GET', client.GET('/v1/workspaces/{id}/projects/{project_id}/ai_models', init));
    },
    /** DELETE /v1/workspaces/{id}/projects/{project_id}/ai_models — ai-delete-models */
    deleteAiModels(init) {
      return unwrap('DELETE', client.DELETE('/v1/workspaces/{id}/projects/{project_id}/ai_models', init));
    },
    /** GET /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks — ai-list-benchmarks */
    listBenchmarks(init) {
      return unwrap('GET', client.GET('/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', init));
    },
    /**
     * DELETE /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks — ai-delete-benchmarks
     */
    deleteBenchmarks(init) {
      return unwrap('DELETE', client.DELETE('/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', init));
    },
    /**
     * PUT /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks/{benchmark_id}
     * — ai-update-benchmark
     */
    updateBenchmark(init) {
      return unwrap('PUT', client.PUT('/v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks/{benchmark_id}', init));
    },
    /** PUT /v1/workspaces/{id}/projects/{project_id}/ci/competitors — ci-update-competitors */
    updateCompetitors(init) {
      return unwrap('PUT', client.PUT('/v1/workspaces/{id}/projects/{project_id}/ci/competitors', init));
    },

    // ─── /v2 AI models + benchmarks ───────────────────────────────────────────
    /** POST /v2/workspaces/{id}/projects/{project_id}/ai_models — aio-project-create-model */
    createAioModel(init) {
      return unwrap('POST', client.POST('/v2/workspaces/{id}/projects/{project_id}/ai_models', init));
    },
    /**
     * POST /v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks — ai-create-benchmarks-v2
     */
    createBenchmarks(init) {
      return unwrap('POST', client.POST('/v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks', init));
    },

    // ─── /v2 brand URLs ───────────────────────────────────────────────────────
    /**
     * GET /v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls
     * — aio-list-brand-urls
     */
    listBrandUrls(init) {
      return unwrap('GET', client.GET('/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls', init));
    },
    /**
     * POST /v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls
     * — aio-create-brand-urls
     */
    createBrandUrls(init) {
      return unwrap('POST', client.POST('/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls', init));
    },
    /**
     * DELETE /v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls
     * — aio-delete-brand-urls
     */
    deleteBrandUrls(init) {
      return unwrap('DELETE', client.DELETE('/v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls', init));
    },

    // ─── /v2 AIO project state, prompts, tags ─────────────────────────────────
    /**
     * GET /v2/workspaces/{id}/projects/{project_id}/aio/init_status
     * — aio-get-project-init-status-v2
     */
    getProjectInitStatus(init) {
      return unwrap('GET', client.GET('/v2/workspaces/{id}/projects/{project_id}/aio/init_status', init));
    },
    /** POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts — aio-create-prompt-v2 */
    createPrompts(init) {
      return unwrap('POST', client.POST('/v2/workspaces/{id}/projects/{project_id}/aio/prompts', init));
    },
    /**
     * DELETE /v2/workspaces/{id}/projects/{project_id}/aio/prompts — aio-delete-prompt-by-ids-v2
     */
    deletePromptsByIds(init) {
      return unwrap('DELETE', client.DELETE('/v2/workspaces/{id}/projects/{project_id}/aio/prompts', init));
    },
    /**
     * POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags
     * — aio-list-prompts-by-tag-ids
     */
    listPromptsByTagIds(init) {
      return unwrap('POST', client.POST('/v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags', init));
    },
    /** PUT /v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags — aio-update-prompts-batch */
    updatePromptTags(init) {
      return unwrap('PUT', client.PUT('/v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags', init));
    },
    /**
     * POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename
     * — aio-rename-prompt
     */
    renamePrompt(init) {
      return unwrap('POST', client.POST('/v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename', init));
    },
    /** GET /v2/workspaces/{id}/projects/{project_id}/aio/tags — aio-get-project-tags */
    listProjectTags(init) {
      return unwrap('GET', client.GET('/v2/workspaces/{id}/projects/{project_id}/aio/tags', init));
    },
    /** POST /v2/workspaces/{id}/projects/{project_id}/aio/tags — aio-create-project-tags */
    createProjectTags(init) {
      return unwrap('POST', client.POST('/v2/workspaces/{id}/projects/{project_id}/aio/tags', init));
    },
    /** PATCH /v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id} — aio-update-tag */
    updateProjectTag(init) {
      return unwrap('PATCH', client.PATCH('/v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}', init));
    },
  };
}
