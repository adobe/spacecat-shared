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
/** @typedef {Schemas['model.RenamePromptResponse']} RenamePromptResponse */
/** @typedef {Schemas['model.ProjectResponse']} Project */
/** @typedef {Schemas['model.ProjectRequest']} ProjectRequest */
/** @typedef {Schemas['model.AIOBenchmarkWithCounters']} Benchmark */
/** @typedef {Schemas['model.BrandURL']} BrandUrl */
/** @typedef {Schemas['model.LanguageResponse']} Language */
/** @typedef {Schemas['model.TreeNodeResponse']} TreeNode */
/** @typedef {Schemas['model.AIOTag']} AIOTag */
/** @typedef {Schemas['model.AIOTagLeaf']} AIOTagLeaf */
/** @typedef {Schemas['aiseo.BrandTopicWithPrompts']} BrandTopic */
/** @typedef {Schemas['http_server.BasicResponse']} BasicResponse */
/** @typedef {Schemas['model.AIOProjectInitializedResponse']} InitStatus */
/** @typedef {Schemas['model.CICompetitor']} CiCompetitor */
/** @typedef {Schemas['model.ResolveURLResponse']} UrlResolve */

import { isoForLanguageId } from './language-catalog.js';
import { findCatalogEntryByKey } from './ai-model-catalog.js';

const uuid = () => globalThis.crypto.randomUUID();

/**
 * The canonical default assigned model — the live catalog's "search" ChatGPT entry
 * (`key: 'search-gpt'`). Catalog-valid by construction (id/key/name/icon come straight from the
 * shared catalog the mock also serves at `GET /v1/ai_models`), so a seeded assignment or an
 * add-path fallback never surfaces a model the catalog can't resolve. The prior `gpt-4o` default
 * was NOT in the catalog, which rendered an unresolvable model chip on a seeded market
 * (adobe/spacecat-shared#1754 gap 4). {@link findCatalogEntryByKey} throws if `search-gpt` ever
 * leaves the catalog, so this can't silently go stale.
 */
const DEFAULT_AI_MODEL = findCatalogEntryByKey('search-gpt');

// Built once: the locale + options are constant, so a per-call constructor would be wasteful.
const REGION_NAMES = new Intl.DisplayNames(['en'], { type: 'region' });

/**
 * `null`, typed as `any`, for read-view fields the live API echoes as `null` when the create
 * request omitted them (`brand_names`, `location.name`). The generated schema types those as
 * `string[]`/`string` with no null variant, so this localizes the one unavoidable cast to a single
 * documented spot rather than scattering `@ts-ignore`s across the literal.
 * @type {any}
 */
const NULLABLE = null;

/**
 * Resolves a 2-letter country code to the informal country name the live project read-view returns
 * as `settings.ai.country.name` (e.g. `de` → "Germany"). Live actually returns the short informal
 * name ("USA" for `us`), which no built-in reproduces; `Intl.DisplayNames` is the faithful-enough,
 * zero-maintenance choice (it returns "United States" for `us` — the one documented divergence —
 * and matches live for most others). Not load-bearing: no consumer reads `country.name` (geo
 * resolves from `country.code`), so a `''` fallback for an empty/invalid code is safe.
 * @param {string} [code] the 2-letter country code (e.g. `us`)
 * @returns {string} the English country name, or `''` when the code is empty/invalid
 */
const countryName = (code) => {
  if (!code) {
    return '';
  }
  try {
    // With the default `fallback: 'code'`, `.of()` returns the resolved name for a known region
    // and the code itself for an unknown-but-valid one — never nullish here — so `String(...)`
    // (not `?? ''`) keeps this branchless while satisfying the `string | undefined` return type.
    return String(REGION_NAMES.of(code.toUpperCase()));
  } catch {
    // `.of()` throws a RangeError for a structurally invalid region code — fall back to empty.
    return '';
  }
};

/**
 * A catalog AI model (`AIModelResponse`). Only `id` is required by the spec; the default
 * `id`/`key`/`name`/`icon` come from the canonical catalog entry ({@link DEFAULT_AI_MODEL},
 * `search-gpt` / ChatGPT), so the default is catalog-valid (adobe/spacecat-shared#1754 gap 4).
 * `icon` matters because the live add path (`POST .../ai_models`) resolves and returns the catalog
 * model's `name` + `icon` (only `key` comes back empty there) — verified live 2026-06-25 — so the
 * complete shape carries `icon` and an `addAiModel` response matches live.
 * @param {Partial<AIModel>} [overrides]
 * @returns {AIModel}
 */
export const createAiModelMock = (overrides = {}) => ({
  ...DEFAULT_AI_MODEL,
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
 * A prompt-rename result (`RenamePromptResponse`) — the `aio-rename-prompt` 200 body. The
 * prompt id is echoed UNCHANGED (rename is in-place; verified live 2026-07-14,
 * serenity-docs#63 §2); `is_updated` mirrors the live layer — `false` for a no-op rename
 * or a draft-only prompt (the default `true` is the published-prompt-changed path).
 * @param {Partial<RenamePromptResponse>} [overrides]
 * @returns {RenamePromptResponse}
 */
export const createRenamePromptResponseMock = (overrides = {}) => ({
  id: uuid(),
  name: 'What is the best running shoe?',
  is_updated: true,
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
 * Builds the `settings.ai` read-view sub-object the live project GET echoes — nested
 * brand / language / country / location plus zeroed counters. Extracted so
 * {@link createProjectResponseFromRequest} (the draft create-response) and
 * {@link createLiveProjectMock} (a seeded live market) build the SAME shape and can't drift.
 *
 * `language.name` is the ISO code resolved from the catalog id (e.g. "en"), NOT the English display
 * name; `langOf` (api-service) reads it directly as the slice code, so resolving id → ISO is the
 * load-bearing round-trip fix (#1745). `country.name` is the informal Intl region name, populated
 * for fidelity. Live echoes `null` (not `[]`/`''`) for an omitted `brand_names` / `location.name`
 * on the read-view (verified 2026-06-29); the {@link NULLABLE} casts satisfy the schema
 * (`string[]`/`string`, no explicit null variant).
 * @param {Partial<ProjectRequest>} [request] the create-request body
 * @returns {NonNullable<Project['settings']>['ai']}
 */
const buildAiSettings = (request = {}) => ({
  models_stats: { models: [], models_count: 0 },
  prompts_count: 0,
  brand_names: request.brand_names ?? NULLABLE,
  brand_name_display: request.brand_name_display ?? '',
  language: { id: request.language_id ?? '', name: isoForLanguageId(request.language_id) },
  country: { code: request.country_code ?? '', name: countryName(request.country_code) },
  location: { id: request.location_id ?? 0, name: request.location_name ?? NULLABLE },
  primary_url: request.domain ?? '',
  segments_count: 0,
  benchmarks_count: 0,
  products_count: 0,
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
    settings: { ai: buildAiSettings(request) },
  });
};

/**
 * A seeded LIVE project (`ProjectResponse`) — a published market whose `settings.ai` carries a
 * resolvable geo + language so api-service's `listMarkets` surfaces it. That read DROPS any project
 * with no geo/lang (`subworkspace-projects.js` drops `geoTargetId`/`languageCode` nulls), so a
 * bare `createProjectMock({ id, name })` seeds an *invisible* market. This is the seed/default side
 * of adobe/spacecat-shared#1754 gap 3 (live status): it mirrors the live read-view (nested
 * `settings.ai`, like {@link createProjectResponseFromRequest}) but marks the project live
 * (`publish_status:'live'`, `published_at`) with a caller-fixed id. Pass
 * `location_id` (a positive Google geoTargetId, e.g. `2840` = US, `2276` = Germany) so the market
 * resolves without depending on api-service's ISO→geo table; `language_id` is a catalog id (→ ISO
 * via {@link isoForLanguageId}). The live create/publish path still starts drafts — only seeds use
 * this. `is_draft` stays `true` even when live: the publish route flips only `publish_status` /
 * `published_at` (verified live 2026-06-25), so a seeded live market byte-matches a create→publish
 * one.
 * @param {Partial<ProjectRequest> & { id?: string, published_at?: string }} [overrides]
 * @returns {Project}
 */
export const createLiveProjectMock = (overrides = {}) => {
  const { id = uuid(), published_at: publishedAt = '2026-01-01T00:00:00Z', ...request } = overrides;
  return createProjectMock({
    id,
    live_id: id,
    draft_id: id,
    type: request.type ?? 'ai',
    name: request.name ?? 'Seeded Project',
    domain: request.domain ?? '',
    is_draft: true,
    publish_status: 'live',
    published_at: publishedAt,
    shared_with: 0,
    settings: { ai: buildAiSettings(request) },
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
 * here (the mock mirrors the full domain; it does not extract a registrable root); `project_id`
 * defaults empty and is set by the handler/seed to the owning project. Created
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
  name: 'branded',
  children_count: 0,
  keyword_count: 0,
  ...overrides,
});

/**
 * A stored/listed project tag (`AIOTag`) — the `GET /aio/tags` (`AIOTagsListResponse`) item and
 * the shape the mock persists in the per-project `tags` collection.
 *
 * The tag taxonomy is a dimension-root tree (see the dimension-root tag model): each **dimension**
 * — `category`, `intent`, `origin`, `type` — is a bare-named ROOT with no `parent_id`, and every
 * **value** is a bare-named descendant carrying its parent's id. No name ever contains a `:`. A
 * category sits at depth 2 and a sub-category at depth 3; the API caps no depth. Because roots
 * legitimately have no parent, `parent_id` is left OUT of the defaults (optional, supplied via
 * override on a descendant) — a plain `createAIOTagMock()` is a root. `children_count` and `path`
 * are DERIVED at read time by the `GET /aio/tags` handler from the stored collection (count of
 * children; the root-first ancestor breadcrumb), never stored — so they stay consistent as children
 * are added; the `children_count: 0` default is only the empty baseline a childless root carries in
 * the store.
 *
 * Distinct from {@link createTagNodeMock}: the create path returns a `TreeNodeResponse`
 * (`keyword_count`) while the list/store shape is an `AIOTag` (`prompts_count`) — two genuinely
 * different live shapes.
 * @param {Partial<AIOTag>} [overrides]
 * @returns {AIOTag}
 */
export const createAIOTagMock = (overrides = {}) => ({
  id: uuid(),
  name: 'category',
  children_count: 0,
  prompts_count: 0,
  ...overrides,
});

/**
 * A tag ancestry-breadcrumb leaf (`AIOTagLeaf`) — one level of an {@link AIOTag}'s `path[]`, which
 * lists every ancestor ROOT-FIRST and excludes the tag itself. A depth-2 tag's `path` is one leaf
 * (its dimension root); a depth-3 tag's is two (the dimension root, then its category).
 *
 * A leaf echoes `parent_id` only when it HAS a parent: the root leaf carries none, and each deeper
 * leaf carries the id of the leaf before it (verified 2026-07-09 against prod, where a depth-3
 * node's second breadcrumb leaf carries `parent_id`). `parent_id` is therefore omitted from the
 * defaults and supplied by the caller per leaf. Built through this factory (not an inline literal)
 * so the derived breadcrumb stays tsc-checked.
 * @param {Partial<AIOTagLeaf>} [overrides]
 * @returns {AIOTagLeaf}
 */
export const createAIOTagLeafMock = (overrides = {}) => ({
  id: uuid(),
  name: 'category',
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

/**
 * A URL-resolve result (`ResolveURLResponse`) — the `GET /v1/url/resolve` body. The DEFAULT is the
 * live invalid/unresolvable shape (`{ domain: '', primary_url: '', is_valid: false }`, HTTP 200),
 * so the route handler passes the {@link resolveUrl} overrides for a valid input and nothing (→
 * this empty default) for an invalid one. All three fields are required by the schema (CR16).
 * @param {Partial<UrlResolve>} [overrides]
 * @returns {UrlResolve}
 */
export const createUrlResolveMock = (overrides = {}) => ({
  domain: '',
  primary_url: '',
  is_valid: false,
  ...overrides,
});
