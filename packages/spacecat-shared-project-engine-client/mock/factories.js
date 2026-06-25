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
 * Mock factory functions for the Project Engine entities — the "mock factory pattern". Each
 * returns a fully-typed entity (typed against the generated, overlay-corrected component schemas)
 * with realistic defaults, and accepts a `Partial<…>` override. Fixtures therefore stay correctly
 * shaped and in sync with the spec, and a per-test caller overrides only what it cares about.
 *
 * Enforcement: this file opts into type-checking via `// @ts-check`, so `npm run test:types`
 * (tsc) fails if a default drifts from the overlayed schema — wrong field type, an unknown field,
 * or (thanks to overlay CR5) a now-`required` field missing from a default. The types come from
 * `build/openapi3.json` (the overlayed artifact), so the fixtures are derived from the spec, not
 * hand-asserted. Ids use real UUIDs (`globalThis.crypto.randomUUID()`) to mirror production.
 */

/** @typedef {import('../src/index.js').components['schemas']} Schemas */
/** @typedef {Schemas['model.AIModelResponse']} AIModel */
/** @typedef {Schemas['model.ProjectAIModelResponse']} ProjectAIModel */
/** @typedef {Schemas['model.AIOPromptWithStatus']} Prompt */
/** @typedef {Schemas['model.ProjectResponse']} Project */
/** @typedef {Schemas['model.ProjectRequest']} ProjectRequest */
/** @typedef {Schemas['model.AIOBenchmarkWithCounters']} Benchmark */
/** @typedef {Schemas['model.BrandURL']} BrandUrl */
/** @typedef {Schemas['model.LanguageResponse']} Language */
/** @typedef {Schemas['model.TreeNodeResponse']} TreeNode */
/** @typedef {Schemas['aiseo.BrandTopicWithPrompts']} BrandTopic */
/** @typedef {Schemas['http_server.BasicResponse']} BasicResponse */
/** @typedef {Schemas['model.AIOProjectInitializedResponse']} InitStatus */
/** @typedef {Schemas['model.CICompetitor']} CiCompetitor */

const uuid = () => globalThis.crypto.randomUUID();

/**
 * A catalog AI model (`AIModelResponse`). Only `id` is required by the spec; `name`/`key` are
 * realistic defaults. `icon` is included because the live add path (`POST .../ai_models`) resolves
 * and returns the catalog model's `name` + `icon` (only `key` comes back empty there) — verified
 * live 2026-06-25 — so the complete shape carries `icon` and an `addAiModel` response matches live.
 * @param {Partial<AIModel>} [overrides]
 * @returns {AIModel}
 */
export const createAiModelMock = (overrides = {}) => ({
  id: uuid(),
  key: 'gpt-4o',
  name: 'GPT-4o',
  icon: 'openai',
  ...overrides,
});

/**
 * A project's assigned AI model (`ProjectAIModelResponse`).
 * @param {Partial<ProjectAIModel>} [overrides]
 * @returns {ProjectAIModel}
 */
export const createProjectAiModelMock = (overrides = {}) => ({
  id: uuid(),
  model: createAiModelMock(),
  prompts_count: 0,
  ...overrides,
});

/**
 * An AIO prompt with status (`AIOPromptWithStatus`) — the `by_tags` list item.
 * @param {Partial<Prompt>} [overrides]
 * @returns {Prompt}
 */
export const createPromptMock = (overrides = {}) => ({
  id: uuid(),
  name: 'What is the best running shoe?',
  is_new: false,
  tags: [],
  ...overrides,
});

/**
 * A project (`ProjectResponse`). Required fields are `id` + `name`; the rest (type,
 * publish_status, …) are situational and omitted by default.
 * @param {Partial<Project>} [overrides]
 * @returns {Project}
 */
export const createProjectMock = (overrides = {}) => ({
  id: uuid(),
  name: 'Seeded Project',
  ...overrides,
});

/**
 * Builds the {@link Project} the live API returns from a *create request* (the
 * `POST /v1/.../projects` body, `model.ProjectRequest`). The live API does NOT echo the flat
 * request fields back: it nests `brand_*` / `language_id` / `country_code` / `location_*` under
 * `settings.ai`, mirrors the new id into `live_id`/`draft_id`, and marks the project a draft
 * (`is_draft: true`, `publish_status: 'draft'`) — verified live 2026-06-25 against the test
 * workspace. The create handler maps the request through this so a create-then-read sees the live
 * shape; the prior `createProjectMock({ ...body })` leaked request-only fields (`country_code`,
 * `language_id`, …) into the response and omitted `settings` entirely.
 * @param {Partial<ProjectRequest>} [request] the create-request body
 * @returns {Project}
 */
export const createProjectResponseFromRequest = (request = {}) => {
  const id = uuid();
  return createProjectMock({
    id,
    live_id: id,
    draft_id: id,
    type: request.type ?? 'ai',
    name: request.name ?? 'Seeded Project',
    domain: request.domain ?? '',
    is_draft: true,
    publish_status: 'draft',
    shared_with: 0,
    settings: {
      ai: {
        models_stats: { models: [], models_count: 0 },
        prompts_count: 0,
        brand_names: request.brand_names ?? [],
        brand_name_display: request.brand_name_display ?? '',
        language: { id: request.language_id ?? '', name: '' },
        country: { code: request.country_code ?? '', name: '' },
        location: { id: request.location_id ?? 0, name: request.location_name ?? '' },
        primary_url: request.domain ?? '',
        segments_count: 0,
        benchmarks_count: 0,
        products_count: 0,
      },
    },
  });
};

/**
 * Applies a flat `ProjectUpdateRequest` patch onto a stored draft `ProjectResponse`, routing each
 * field to the place the live API reflects it (verified 2026-06-25): `name`/`type`/`domain` stay
 * top-level, while `brand_name_display`/`brand_names` are nested under `settings.ai` — a flat PATCH
 * body is reflected there, NOT echoed at the top level. Counts/stats the patch does not touch stay
 * as they were on the stored draft. Mirrors {@link createProjectResponseFromRequest}'s placement so
 * the PATCH response shape matches the create response. The brand-identity re-sync
 * (`brand_name_display` + `brand_names`) is the consumer's only PATCH use today.
 * @param {Project} stored the stored draft ProjectResponse
 * @param {Schemas['model.ProjectUpdateRequest']} patch
 * @returns {Project}
 */
export const applyProjectUpdate = (stored, patch) => {
  const ai = { ...(stored.settings?.ai ?? {}) };
  if (patch.brand_names !== undefined) {
    ai.brand_names = patch.brand_names;
  }
  if (patch.brand_name_display !== undefined) {
    ai.brand_name_display = patch.brand_name_display;
  }
  /** @type {Project} */
  const next = { ...stored, settings: { ...stored.settings, ai } };
  if (patch.name !== undefined) {
    next.name = patch.name;
  }
  if (patch.type !== undefined) {
    next.type = patch.type;
  }
  if (patch.domain !== undefined) {
    next.domain = patch.domain;
  }
  return next;
};

/**
 * An AIO benchmark with counters (`AIOBenchmarkWithCounters`) — the `listBenchmarks` item. The
 * live shape carries `id, project_id, domain, primary_url, root_domain, color, favorite,
 * main_brand, brand_name, brand_aliases, rejected_brand_aliases, products_count` (all verified live
 * 2026-06-25; `primary_url`/`root_domain` are added to the schema by overlay CR10). `primary_url`
 * and `root_domain` mirror the benchmark's `domain` live, so they default off the effective domain
 * here; `project_id` defaults empty and is set by the handler/seed to the owning project. Created
 * benchmarks are competitors (`main_brand: false`); the own-brand benchmark is system-managed.
 * @param {Partial<Benchmark>} [overrides]
 * @returns {Benchmark}
 */
export const createBenchmarkMock = (overrides = {}) => {
  const domain = overrides.domain ?? 'competitor.example';
  return {
    id: uuid(),
    project_id: '',
    brand_name: 'Competitor Brand',
    domain,
    primary_url: domain,
    root_domain: domain,
    brand_aliases: [],
    rejected_brand_aliases: [],
    color: '',
    favorite: false,
    main_brand: false,
    products_count: 0,
    ...overrides,
  };
};

/**
 * A benchmark brand URL (`BrandURL`) — the `listBrandUrls` item.
 * @param {Partial<BrandUrl>} [overrides]
 * @returns {BrandUrl}
 */
export const createBrandUrlMock = (overrides = {}) => ({
  id: uuid(),
  url: 'https://example.com/about',
  type: 'own',
  ...overrides,
});

/**
 * A language catalog entry (`LanguageResponse`) — the `listLanguages` item `{ id, name }`.
 * @param {Partial<Language>} [overrides]
 * @returns {Language}
 */
export const createLanguageMock = (overrides = {}) => ({
  id: uuid(),
  name: 'English',
  ...overrides,
});

/**
 * A taxonomy tree node (`TreeNodeResponse`) — the `createProjectTags` array item.
 * @param {Partial<TreeNode>} [overrides]
 * @returns {TreeNode}
 */
export const createTagNodeMock = (overrides = {}) => ({
  id: uuid(),
  name: 'type:branded',
  children_count: 0,
  keyword_count: 0,
  ...overrides,
});

/**
 * A brand topic with prompts (`aiseo.BrandTopicWithPrompts`) — the `getBrandTopics` array item.
 * @param {Partial<BrandTopic>} [overrides]
 * @returns {BrandTopic}
 */
export const createBrandTopicMock = (overrides = {}) => ({
  topic: 'Running Shoes',
  volume: 12000,
  prompts: ['What is the best running shoe?'],
  ...overrides,
});

/**
 * A simple message envelope (`http_server.BasicResponse`) — the shape the live API uses for its
 * error responses (401/403/409/500). The action routes (publish, delete/update-benchmark,
 * delete-brand-urls) return a 202 with an EMPTY body (`content-length: 0`, verified live
 * 2026-06-25), NOT this envelope, so they no longer build it; it is retained for the error shape.
 * @param {Partial<BasicResponse>} [overrides]
 * @returns {BasicResponse}
 */
export const createBasicResponseMock = (overrides = {}) => ({
  message: '',
  ...overrides,
});

/**
 * The AIO init-status envelope (`AIOProjectInitializedResponse`) — `getInitStatus`'s
 * `{ initialized }`.
 * @param {Partial<InitStatus>} [overrides]
 * @returns {InitStatus}
 */
export const createInitStatusMock = (overrides = {}) => ({
  initialized: false,
  ...overrides,
});

/**
 * A CI competitor (`CICompetitor`) — an item of `updateCiCompetitors`' `{ ci_competitors }` echo.
 * @param {Partial<CiCompetitor>} [overrides]
 * @returns {CiCompetitor}
 */
export const createCiCompetitorMock = (overrides = {}) => ({
  id: uuid(),
  domain: 'competitor.example',
  color: '',
  ...overrides,
});
