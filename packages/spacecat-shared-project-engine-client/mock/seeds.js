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
 * Named seed sets for the Project Engine mock. Each is a {@link Snapshot} keyed by the same
 * collection names {@link createStatefulOps} uses (see {@link collectionKey}), so a seed loaded
 * via `store.load(seed)` is immediately visible to the stateful handlers. E2E selects a seed at
 * startup and restores it between tests with `store.reset()` (exposed as `POST /__reset`).
 *
 * Entities are built via the typed {@link createLiveProjectMock} / {@link createProjectAiModelMock}
 * / {@link createPromptMock} factories, so the fixtures are spec-shaped and checked by tsc
 * (`// @ts-check`). E2E flows reference the fixed UUIDs through {@link SEED_IDS}.
 *
 * Sub-workspace model (adobe/spacecat-shared#1754): a brand resolves to a CHILD sub-workspace (the
 * User Manager mock's `parent-with-child`), never the org's parent workspace, so the seeded
 * project/market/model/prompt live under the CHILD id — a brand correctly anchored to the child
 * reads non-empty, live data. The project is built LIVE with a resolvable US/en market so
 * api-service's `listMarkets` surfaces it (it drops projects with no geo/lang). A second, fully
 * independent hierarchy (`two-hierarchies`) exists for the dual-org case (two mock-wired orgs need
 * two distinct `semrush_workspace_id`s — the DB enforces uniqueness).
 */

import { collectionKey } from './stateful.js';
import { QUOTA_COLLECTION } from './quota.js';
import { tagId } from './tag-id.js';
import { findCatalogEntryByKey } from './ai-model-catalog.js';
import {
  createProjectMock,
  createLiveProjectMock,
  createProjectAiModelMock,
  createAiModelMock,
  createPromptMock,
  createBenchmarkMock,
  createBrandUrlMock,
  createAIOTagMock,
} from './factories.js';

// Real-shaped fixtures: the Project Engine API types every id as `format: uuid`, so the seeds
// use fixed UUIDs (not `ws-1`/`pr-1`) to mirror production data. Fixed, not generated, so
// SEED_IDS stays stable for assertions.

// --- Hierarchy 1 — the default single-brand world the local seed SQL + api-service IT anchor to.
// The parent workspace is the org's `semrush_workspace_id`; the CHILD is the brand's. The project
// lives under the CHILD (a brand must not resolve to the org parent — api-service 409s that).
const PARENT_WORKSPACE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'; // org parent (== UM parent)
const CHILD_WORKSPACE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'; // brand sub-workspace (== UM child)
const PROJECT_ID = 'b8c9d0e1-f2a3-4b4c-8d5e-7f8091021324'; // live market under the CHILD
const AI_MODEL_ASSIGNMENT_ID = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f'; // ProjectAIModelResponse.id
const AI_MODEL_CATALOG_ID = findCatalogEntryByKey('search-gpt').id; // catalog `search-gpt` (ChatGPT)
const PROMPT_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8091'; // AIOPromptWithStatus.id
const BENCHMARK_ID = 'f6a7b8c9-d0e1-4f2a-9b3c-5d6e7f809102'; // AIOBenchmarkWithCounters.id (own brand)
const BRAND_URL_ID = 'a7b8c9d0-e1f2-4a3b-8c4d-6e7f80910213'; // BrandURL.id
const ENGLISH_LANGUAGE_ID = '5a0a33ed-7f5c-4901-befd-a042c0350da1'; // catalog "English" → ISO en
const US_GEO_TARGET_ID = 2840; // Google geoTargetId (United States)

// --- The dimension-root tag taxonomy.
// Each dimension is a bare-named ROOT; every value is a bare-named descendant carrying `parent_id`.
// No name contains a `:`, and a tag's dimension is `path[0]`. Ids derive from the shared
// `tagId(name, parentId)` helper (an opaque, URL-safe sha256-derived token — see tag-id.js) — the
// same derivation the tag-minting routes use — so a standalone tag and the same tag inline on a
// prompt resolve to ONE id and the Categories surface / `by_tags` correlate them.
const DIMENSION_ROOTS = Object.freeze({
  category: 'category',
  intent: 'intent',
  origin: 'origin',
  type: 'type',
});

/** The closed dimensions' fixed vocabularies — provisioned server-side, never client-minted. */
const INTENT_VALUES = Object.freeze([
  'Informational', 'Task', 'Commercial', 'Transactional', 'Navigational',
]);
const ORIGIN_VALUES = Object.freeze(['ai', 'human']);
const TYPE_VALUES = Object.freeze(['branded', 'non-branded']);

const CATEGORY_ROOT_TAG_ID = tagId(DIMENSION_ROOTS.category);
const INTENT_ROOT_TAG_ID = tagId(DIMENSION_ROOTS.intent);
const ORIGIN_ROOT_TAG_ID = tagId(DIMENSION_ROOTS.origin);
const TYPE_ROOT_TAG_ID = tagId(DIMENSION_ROOTS.type);

// H1's open taxonomy: one depth-2 category with two depth-3 sub-categories. The sub-category named
// `human` deliberately collides by NAME with the `origin` value `human` — under bare names those
// are two distinct tags only because ids are keyed on `(parent, name)`. Seeding the collision keeps
// the cross-dimension case (model spec §7 gate 4) exercisable end-to-end rather than hypothetical.
const CATEGORY_NAME = 'Running Shoes';
const CATEGORY_CHILD_NAME = 'Trail';
const CATEGORY_CHILD_COLLIDING_NAME = 'human';
const CATEGORY_TAG_ID = tagId(CATEGORY_NAME, CATEGORY_ROOT_TAG_ID); // depth-2 category
const CHILD_TAG_ID = tagId(CATEGORY_CHILD_NAME, CATEGORY_TAG_ID); // depth-3 sub-category
const CHILD_COLLIDING_TAG_ID = tagId(CATEGORY_CHILD_COLLIDING_NAME, CATEGORY_TAG_ID);

// The closed-dimension values H1's seeded prompt carries. `originHuman` shares its NAME with the
// sub-category above and its id with nothing.
const ORIGIN_HUMAN_TAG_ID = tagId('human', ORIGIN_ROOT_TAG_ID);
const INTENT_COMMERCIAL_TAG_ID = tagId('Commercial', INTENT_ROOT_TAG_ID);
const TYPE_BRANDED_TAG_ID = tagId('branded', TYPE_ROOT_TAG_ID);

// --- Legacy `source`-named root (pre-rename shape, adobe/spacecat-shared#1812 / the origin
// dimension). Kept ONLY as its own `legacy-source-workspace` snapshot so downstream consumers
// (e.g. api-service's tolerant resolver) can be tested against both root names. WP-O6 deletes this
// snapshot once the migration completes — do not wire it into any other seed.
const LEGACY_WORKSPACE_ID = 'c2d3e4f5-a6b7-4c8d-9e0f-1a2b3c4d5e6f';
const LEGACY_PROJECT_ID = 'd3e4f5a6-b7c8-4d9e-8f0a-2b3c4d5e6f70';
const LEGACY_SOURCE_ROOT_TAG_ID = tagId('source');
const LEGACY_SOURCE_AI_TAG_ID = tagId('ai', LEGACY_SOURCE_ROOT_TAG_ID);
const LEGACY_SOURCE_HUMAN_TAG_ID = tagId('human', LEGACY_SOURCE_ROOT_TAG_ID);

// --- Hierarchy 2 — a second, fully independent mock-wired org (unique `semrush_workspace_id`s),
// present only in the `two-hierarchies` seed. A German market so the two read distinctly. These
// two ids are the same UUIDs as the User Manager mock's second hierarchy (UM seeds.js), so PE
// projects and UM workspaces line up across the two packages.
const PARENT_WORKSPACE_ID_2 = 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d'; // == UM parent2
const CHILD_WORKSPACE_ID_2 = 'b3c4d5e6-f7a8-4b9c-8d0e-2f3a4b5c6d7e'; // == UM child2
const PROJECT_ID_2 = 'c4d5e6f7-a8b9-4c0d-8e1f-3a4b5c6d7e8f';
const AI_MODEL_ASSIGNMENT_ID_2 = 'c5d6e7f8-a9b0-4c1d-8e2f-4a5b6c7d8e9f';
const GERMAN_LANGUAGE_ID = 'e5282ae9-83a6-4ea3-b3cf-5e99d8f51eca'; // catalog "German" → ISO de
const DE_GEO_TARGET_ID = 2276; // Google geoTargetId (Germany)

/**
 * @typedef {import('./store.js').Snapshot} Snapshot
 * @typedef {import('../src/index.js').components['schemas']} Schemas
 */

/**
 * @typedef {object} SeedProject
 * @property {string} id project UUID (use the project / `semrush_workspace_id` UUIDs from your DB
 *   fixtures so the mock and Postgres line up)
 * @property {string} name
 * @property {Partial<Schemas['model.ProjectRequest']> & { published_at?: string }} [market] when
 *   present, the project is built as a LIVE market via {@link createLiveProjectMock}
 *   (`publish_status: 'live'` + a resolvable geo/lang from `country_code`/`location_id` +
 *   `language_id`), so api-service's `listMarkets` surfaces it. Omit for a market-less project
 *   (built via {@link createProjectMock}) — e.g. a workspace you only exercise for models/prompts.
 * @property {Array<Schemas['model.ProjectAIModelResponse']>} [aiModels] build with
 *   {@link createProjectAiModelMock} so the shape is checked
 * @property {Array<Schemas['model.AIOPromptWithStatus']>} [prompts] build with
 *   {@link createPromptMock} so the shape is checked
 * @property {Array<Schemas['model.AIOBenchmarkWithCounters']>} [benchmarks] build with
 *   {@link createBenchmarkMock} (the competitor + own-brand benchmarks the consumer syncs)
 * @property {Array<Schemas['model.AIOTag']>} [tags] standalone project tags (the dimension-root
 *   taxonomy); build with {@link createAIOTagMock} so the shape is checked. Order matters only for
 *   readability — the tree is reconstructed from `parent_id`, not from position.
 * @property {Array<{ benchmarkId: string, urls: Array<Schemas['model.BrandURL']> }>} [brandUrls]
 *   brand URLs grouped by their benchmark id; build each url with {@link createBrandUrlMock}
 */

/**
 * Authors a collection-keyed {@link Snapshot} from a friendly, DB-shaped description, so a caller
 * (the cross-repo e2e harness) can mirror the rows it inserted into Postgres without hand-writing
 * `collectionKey(...)` keys. Pass a project `market` to get a LIVE, addressable market (built via
 * {@link createLiveProjectMock}); omit it for a bare project. Pass `aiModels`/`prompts` built with
 * the factories so every row stays spec-shaped with real UUIDs.
 *
 * Pass `quota` to mirror the AI-unit allocation the sub-workspace was granted (via user-manager);
 * the project-engine mock then meters project/prompt creates + publish against it. Omit for the
 * unlimited (limits-disabled) default.
 *
 * @param {{ workspaceId: string, projects?: SeedProject[],
 *   quota?: { projects?: number | null, prompts?: number | null } }} spec
 * @returns {import('./store.js').Snapshot}
 */
export function buildSeed({ workspaceId, projects = [], quota }) {
  const projectsKey = collectionKey('projects', { workspaceId });
  /** @type {import('./store.js').Snapshot} */
  const snapshot = { [projectsKey]: [] };
  for (const {
    id, name, market, aiModels = [], prompts = [], benchmarks = [], tags = [], brandUrls = [],
  } of projects) {
    snapshot[projectsKey].push(
      market
        ? createLiveProjectMock({ id, name, ...market })
        : createProjectMock({ id, name }),
    );
    const scope = { workspaceId, projectId: id };
    snapshot[collectionKey('ai_models', scope)] = aiModels;
    snapshot[collectionKey('prompts', scope)] = prompts;
    snapshot[collectionKey('benchmarks', scope)] = benchmarks;
    snapshot[collectionKey('tags', scope)] = tags;
    for (const { benchmarkId, urls } of brandUrls) {
      snapshot[collectionKey('brand_urls', { workspaceId, projectId: id, benchmarkId })] = urls;
    }
  }
  if (quota) {
    // The `quota` collection (id = workspaceId) is read by mock/quota.js; null = unlimited.
    snapshot[QUOTA_COLLECTION] = [{
      id: workspaceId,
      projects: quota.projects ?? null,
      prompts: quota.prompts ?? null,
    }];
  }
  return snapshot;
}

/**
 * A bare-named dimension root (no `parent_id`).
 * @param {string} name
 * @returns {Schemas['model.AIOTag']}
 */
const rootTag = (name) => createAIOTagMock({ id: tagId(name), name });

/**
 * A bare-named descendant carrying its parent's id. Its own id is keyed on `(parent, name)`, so the
 * same name under two parents yields two tags.
 * @param {string} name
 * @param {string} parentId
 * @returns {Schemas['model.AIOTag']}
 */
const childTag = (name, parentId) => createAIOTagMock({
  id: tagId(name, parentId),
  name,
  parent_id: parentId,
});

/**
 * The four dimension roots and the closed dimensions' full child vocabularies — the tree every
 * project is provisioned with, before any customer-authored category exists. Pass `categories` to
 * append the open `category` subtree: each entry is a depth-2 category and its depth-3
 * sub-categories.
 * @param {Array<{ name: string, children?: string[] }>} [categories]
 * @returns {Array<Schemas['model.AIOTag']>} roots first, then descendants (parents before children)
 */
const dimensionRootTree = (categories = []) => [
  rootTag(DIMENSION_ROOTS.category),
  rootTag(DIMENSION_ROOTS.intent),
  rootTag(DIMENSION_ROOTS.origin),
  rootTag(DIMENSION_ROOTS.type),
  ...INTENT_VALUES.map((v) => childTag(v, INTENT_ROOT_TAG_ID)),
  ...ORIGIN_VALUES.map((v) => childTag(v, ORIGIN_ROOT_TAG_ID)),
  ...TYPE_VALUES.map((v) => childTag(v, TYPE_ROOT_TAG_ID)),
  ...categories.flatMap(({ name, children = [] }) => {
    const categoryId = tagId(name, CATEGORY_ROOT_TAG_ID);
    return [
      childTag(name, CATEGORY_ROOT_TAG_ID),
      ...children.map((child) => childTag(child, categoryId)),
    ];
  }),
];

/**
 * Authors one full sub-workspace hierarchy (a live market with a model, a tagged prompt, an
 * own-brand benchmark + URL, and the standalone dimension-root tag tree) under a CHILD workspace,
 * via the public {@link buildSeed} recipe. Both seeded hierarchies go through here so they stay
 * identical in shape.
 *
 * `projectTags` and `promptTags` are passed PRE-BUILT (not as names) because a tag's id depends on
 * its parent: only the caller, which knows the tree it is seeding, can derive the right ids. A
 * prompt's inline tags must reuse the exact ids from `projectTags` or `by_tags` and the Categories
 * surface stop correlating.
 * @param {{ childWorkspaceId: string, projectId: string, aiModelAssignmentId: string, name: string,
 *   domain: string, brandName: string, languageId: string, countryCode: string, locationId: number,
 *   locationName: string, modelKey: string, promptId: string, promptName: string,
 *   promptTags: Array<Schemas['model.AIOTag']>, benchmarkId: string, brandUrlId: string,
 *   projectTags: Array<Schemas['model.AIOTag']> }} cfg
 * @returns {Snapshot}
 */
const peHierarchy = (cfg) => buildSeed({
  workspaceId: cfg.childWorkspaceId,
  projects: [{
    id: cfg.projectId,
    name: cfg.name,
    market: {
      domain: cfg.domain,
      brand_names: [cfg.brandName],
      brand_name_display: cfg.brandName,
      language_id: cfg.languageId,
      country_code: cfg.countryCode,
      location_id: cfg.locationId,
      location_name: cfg.locationName,
    },
    aiModels: [createProjectAiModelMock({
      id: cfg.aiModelAssignmentId,
      model: createAiModelMock(findCatalogEntryByKey(cfg.modelKey)),
    })],
    prompts: [createPromptMock({
      id: cfg.promptId,
      name: cfg.promptName,
      tags: cfg.promptTags,
    })],
    benchmarks: [createBenchmarkMock({
      id: cfg.benchmarkId,
      brand_name: cfg.brandName,
      domain: cfg.domain,
      main_brand: true,
    })],
    tags: cfg.projectTags,
    brandUrls: [{
      benchmarkId: cfg.benchmarkId,
      urls: [createBrandUrlMock({ id: cfg.brandUrlId, url: `https://${cfg.domain}/about`, type: 'own' })],
    }],
  }],
});

/** Empty child workspace: no projects yet — the "create from scratch" flow starts here. */
export const EMPTY_WORKSPACE = Object.freeze({
  [collectionKey('projects', { workspaceId: CHILD_WORKSPACE_ID })]: [],
});

/**
 * A brand's CHILD sub-workspace with one LIVE US/en market (a model + a tagged prompt + own-brand
 * benchmark/URL + the dimension-root tag tree) — the "read/patch/run existing data" flow starts
 * here. Entity shapes mirror the real API responses so `__dump` and GETs look like production.
 *
 * The prompt is dual-tagged (its depth-2 category AND its depth-3 sub-category, per the id-based
 * alignment spec's delete-resilience rule) and carries one closed value per dimension. Its
 * sub-category `human` and its origin value `human` share a name and nothing else.
 */
export const WORKSPACE_WITH_DATA = Object.freeze(peHierarchy({
  childWorkspaceId: CHILD_WORKSPACE_ID,
  projectId: PROJECT_ID,
  aiModelAssignmentId: AI_MODEL_ASSIGNMENT_ID,
  name: 'Seeded Project',
  domain: 'example.com',
  brandName: 'Seeded Brand',
  languageId: ENGLISH_LANGUAGE_ID,
  countryCode: 'us',
  locationId: US_GEO_TARGET_ID,
  locationName: 'United States',
  modelKey: 'search-gpt',
  promptId: PROMPT_ID,
  promptName: 'What is the best running shoe?',
  promptTags: [
    childTag(CATEGORY_NAME, CATEGORY_ROOT_TAG_ID),
    childTag(CATEGORY_CHILD_COLLIDING_NAME, CATEGORY_TAG_ID),
    childTag('human', ORIGIN_ROOT_TAG_ID),
    childTag('Commercial', INTENT_ROOT_TAG_ID),
    childTag('branded', TYPE_ROOT_TAG_ID),
  ],
  benchmarkId: BENCHMARK_ID,
  brandUrlId: BRAND_URL_ID,
  // `Trail` carries no prompts, so a 0-prompt sub-category is exercised by the tree read.
  projectTags: dimensionRootTree([
    { name: CATEGORY_NAME, children: [CATEGORY_CHILD_NAME, CATEGORY_CHILD_COLLIDING_NAME] },
  ]),
}));

/**
 * Two coexisting, fully independent hierarchies (H1 = the `workspace-with-data` US/en world, plus a
 * second DE/de world under distinct workspace ids). For the dual-org local/e2e case where two
 * mock-wired orgs each need their own `semrush_workspace_id` (the DB enforces uniqueness) served by
 * ONE mock container. A strict superset of `workspace-with-data`, so anything anchored to H1 still
 * resolves. (adobe/spacecat-shared#1754 gap 2.)
 */
export const TWO_HIERARCHIES = Object.freeze({
  ...WORKSPACE_WITH_DATA,
  ...peHierarchy({
    childWorkspaceId: CHILD_WORKSPACE_ID_2,
    projectId: PROJECT_ID_2,
    aiModelAssignmentId: AI_MODEL_ASSIGNMENT_ID_2,
    name: 'Seeded Project 2',
    domain: 'zweite-marke.example',
    brandName: 'Zweite Marke',
    languageId: GERMAN_LANGUAGE_ID,
    countryCode: 'de',
    locationId: DE_GEO_TARGET_ID,
    locationName: 'Germany',
    modelKey: 'gemini-2.5-flash',
    promptId: 'd6e7f8a9-b0c1-4d2e-8f3a-5b6c7d8e9f01',
    promptName: 'Was ist der beste Laufschuh?',
    promptTags: [
      childTag('Laufschuhe', CATEGORY_ROOT_TAG_ID),
      childTag('ai', ORIGIN_ROOT_TAG_ID),
      childTag('Informational', INTENT_ROOT_TAG_ID),
      childTag('non-branded', TYPE_ROOT_TAG_ID),
    ],
    benchmarkId: 'e7f8a9b0-c1d2-4e3f-8a4b-6c7d8e9f0112',
    brandUrlId: 'f8a9b0c1-d2e3-4f4a-8b5c-7d8e9f011223',
    // Two depth-2 categories, no sub-categories — a prompt tagged only at the category level.
    projectTags: dimensionRootTree([{ name: 'Laufschuhe' }, { name: 'Trailrunning' }]),
  }),
});

/**
 * A workspace whose dimension-root tree still uses the PRE-rename `source` root (with its `ai`/
 * `human` children), for exercising a tolerant resolver that must accept both `origin` and legacy
 * `source` roots during the migration window (adobe/spacecat-shared#1812, the origin dimension).
 * WP-O6 deletes this snapshot once every consumer's resolver only reads `origin`.
 */
export const LEGACY_SOURCE_WORKSPACE = Object.freeze(buildSeed({
  workspaceId: LEGACY_WORKSPACE_ID,
  projects: [{
    id: LEGACY_PROJECT_ID,
    name: 'Legacy Source Project',
    tags: [
      rootTag(DIMENSION_ROOTS.category),
      rootTag(DIMENSION_ROOTS.intent),
      rootTag('source'), // pre-rename root name — intentionally NOT DIMENSION_ROOTS.origin
      rootTag(DIMENSION_ROOTS.type),
      ...INTENT_VALUES.map((v) => childTag(v, INTENT_ROOT_TAG_ID)),
      ...ORIGIN_VALUES.map((v) => childTag(v, LEGACY_SOURCE_ROOT_TAG_ID)),
      ...TYPE_VALUES.map((v) => childTag(v, TYPE_ROOT_TAG_ID)),
    ],
  }],
}));

/**
 * All seed sets by name, for the runner to select via env/flag. Typed as a string map so a
 * runtime `MOCK_SEED` (an arbitrary string) can index it with a fallback (see {@link Context}).
 * @type {Record<string, import('./store.js').Snapshot>}
 */
export const SEEDS = Object.freeze({
  'empty-workspace': EMPTY_WORKSPACE,
  'workspace-with-data': WORKSPACE_WITH_DATA,
  'two-hierarchies': TWO_HIERARCHIES,
  'legacy-source-workspace': LEGACY_SOURCE_WORKSPACE,
});

/** Default seed loaded when none is specified. */
export const DEFAULT_SEED = 'workspace-with-data';

/** Ids used by the seed sets, exported so E2E flows can reference them without hardcoding. */
export const SEED_IDS = Object.freeze({
  // Hierarchy 1 (the `workspace-with-data` world). `workspaceId` is the brand's CHILD sub-workspace
  // — the one the seeded project lives under (NOT the org parent).
  parentWorkspaceId: PARENT_WORKSPACE_ID,
  workspaceId: CHILD_WORKSPACE_ID,
  projectId: PROJECT_ID,
  aiModelId: AI_MODEL_CATALOG_ID,
  promptId: PROMPT_ID,
  benchmarkId: BENCHMARK_ID,
  brandUrlId: BRAND_URL_ID,
  // The four dimension roots — every project carries exactly these at the root level.
  categoryRootTagId: CATEGORY_ROOT_TAG_ID,
  intentRootTagId: INTENT_ROOT_TAG_ID,
  originRootTagId: ORIGIN_ROOT_TAG_ID,
  typeRootTagId: TYPE_ROOT_TAG_ID,
  // H1's open taxonomy: a depth-2 category and its two depth-3 sub-categories. `childTagId` carries
  // no prompts; `childCollidingTagId` is the sub-category named `human`, whose name — and only
  // whose name — matches the `origin` value below.
  categoryTagId: CATEGORY_TAG_ID,
  childTagId: CHILD_TAG_ID,
  childCollidingTagId: CHILD_COLLIDING_TAG_ID,
  // H1's closed-dimension values, as carried by the seeded prompt.
  originHumanTagId: ORIGIN_HUMAN_TAG_ID,
  intentCommercialTagId: INTENT_COMMERCIAL_TAG_ID,
  typeBrandedTagId: TYPE_BRANDED_TAG_ID,
  // Hierarchy 2 (present only in `two-hierarchies`).
  secondParentWorkspaceId: PARENT_WORKSPACE_ID_2,
  secondWorkspaceId: CHILD_WORKSPACE_ID_2,
  secondProjectId: PROJECT_ID_2,
  // Legacy `source`-rooted world (present only in `legacy-source-workspace`; deleted in WP-O6).
  legacyWorkspaceId: LEGACY_WORKSPACE_ID,
  legacyProjectId: LEGACY_PROJECT_ID,
  legacySourceRootTagId: LEGACY_SOURCE_ROOT_TAG_ID,
  legacySourceAiTagId: LEGACY_SOURCE_AI_TAG_ID,
  legacySourceHumanTagId: LEGACY_SOURCE_HUMAN_TAG_ID,
});
