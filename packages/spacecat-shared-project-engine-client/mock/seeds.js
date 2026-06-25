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
 * Entities are built via the typed {@link createProjectMock} / {@link createProjectAiModelMock} /
 * {@link createPromptMock} factories, so the fixtures are spec-shaped and checked by tsc
 * (`// @ts-check`). E2E flows reference the fixed UUIDs through {@link SEED_IDS}.
 */

import { collectionKey } from './stateful.js';
import { QUOTA_COLLECTION } from './quota.js';
import {
  createProjectMock,
  createProjectAiModelMock,
  createAiModelMock,
  createPromptMock,
  createBenchmarkMock,
  createBrandUrlMock,
} from './factories.js';

// Real-shaped fixtures: the Project Engine API types every id as `format: uuid`, so the seeds
// use fixed UUIDs (not `ws-1`/`pr-1`) to mirror production data. Fixed, not generated, so
// SEED_IDS stays stable for assertions.
const WORKSPACE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'; // workspace UUID (path {id})
const PROJECT_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'; // project UUID (path {project_id})
const AI_MODEL_ASSIGNMENT_ID = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f'; // ProjectAIModelResponse.id
const AI_MODEL_CATALOG_ID = 'd4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f80'; // AIModelResponse.id (the model_id)
const PROMPT_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8091'; // AIOPromptWithStatus.id
const BENCHMARK_ID = 'f6a7b8c9-d0e1-4f2a-9b3c-5d6e7f809102'; // AIOBenchmarkWithCounters.id (own brand)
const BRAND_URL_ID = 'a7b8c9d0-e1f2-4a3b-8c4d-6e7f80910213'; // BrandURL.id

/**
 * @typedef {import('./store.js').Snapshot} Snapshot
 */

/** Empty workspace: no projects yet — the "create from scratch" flow starts here. */
export const EMPTY_WORKSPACE = Object.freeze({
  [collectionKey('projects', { workspaceId: WORKSPACE_ID })]: [],
});

/**
 * Workspace with one project that already has an ai_model and a prompt — the "read/patch/run
 * existing data" flow starts here. Entity shapes mirror the real API responses
 * (ProjectAIModelResponse, AIOPromptWithStatus) so `__dump` and GETs look like production.
 */
export const WORKSPACE_WITH_DATA = Object.freeze({
  [collectionKey('projects', { workspaceId: WORKSPACE_ID })]: [
    createProjectMock({ id: PROJECT_ID, name: 'Seeded Project' }),
  ],
  [collectionKey('ai_models', { workspaceId: WORKSPACE_ID, projectId: PROJECT_ID })]: [
    createProjectAiModelMock({
      id: AI_MODEL_ASSIGNMENT_ID,
      model: createAiModelMock({ id: AI_MODEL_CATALOG_ID, key: 'gpt-4o', name: 'GPT-4o' }),
    }),
  ],
  [collectionKey('prompts', { workspaceId: WORKSPACE_ID, projectId: PROJECT_ID })]: [
    createPromptMock({ id: PROMPT_ID, name: 'What is the best running shoe?' }),
  ],
  // The project's own-brand benchmark (main_brand: true) — the `benchmark_id` brand URLs attach
  // to. Mirrors the live listBenchmarks own-brand row.
  [collectionKey('benchmarks', { workspaceId: WORKSPACE_ID, projectId: PROJECT_ID })]: [
    createBenchmarkMock({
      id: BENCHMARK_ID,
      brand_name: 'Seeded Brand',
      domain: 'example.com',
      main_brand: true,
    }),
  ],
  // One brand URL under the own-brand benchmark.
  [collectionKey('brand_urls', {
    workspaceId: WORKSPACE_ID, projectId: PROJECT_ID, benchmarkId: BENCHMARK_ID,
  })]: [
    createBrandUrlMock({ id: BRAND_URL_ID, url: 'https://example.com/about', type: 'own' }),
  ],
});

/**
 * All seed sets by name, for the runner to select via env/flag. Typed as a string map so a
 * runtime `MOCK_SEED` (an arbitrary string) can index it with a fallback (see {@link Context}).
 * @type {Record<string, import('./store.js').Snapshot>}
 */
export const SEEDS = Object.freeze({
  'empty-workspace': EMPTY_WORKSPACE,
  'workspace-with-data': WORKSPACE_WITH_DATA,
});

/** Default seed loaded when none is specified. */
export const DEFAULT_SEED = 'workspace-with-data';

/** Ids used by the seed sets, exported so E2E flows can reference them without hardcoding. */
export const SEED_IDS = Object.freeze({
  workspaceId: WORKSPACE_ID,
  projectId: PROJECT_ID,
  aiModelId: AI_MODEL_CATALOG_ID,
  promptId: PROMPT_ID,
  benchmarkId: BENCHMARK_ID,
  brandUrlId: BRAND_URL_ID,
});

/**
 * @typedef {import('../src/index.js').components['schemas']} Schemas
 * @typedef {object} SeedProject
 * @property {string} id project UUID (use the project / `semrush_workspace_id` UUIDs from your DB
 *   fixtures so the mock and Postgres line up)
 * @property {string} name
 * @property {Array<Schemas['model.ProjectAIModelResponse']>} [aiModels] build with
 *   {@link createProjectAiModelMock} so the shape is checked
 * @property {Array<Schemas['model.AIOPromptWithStatus']>} [prompts] build with
 *   {@link createPromptMock} so the shape is checked
 */

/**
 * Authors a collection-keyed {@link Snapshot} from a friendly, DB-shaped description, so a caller
 * (the cross-repo e2e harness) can mirror the rows it inserted into Postgres without hand-writing
 * `collectionKey(...)` keys. Pass the result to `POST /__seed` or write it to a `MOCK_SEED_FILE`.
 * The project entity is built via {@link createProjectMock} (typed); pass `aiModels`/`prompts`
 * built with the factories so every row stays spec-shaped with real UUIDs.
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
    id, name, aiModels = [], prompts = [],
  } of projects) {
    snapshot[projectsKey].push(createProjectMock({ id, name }));
    const scope = { workspaceId, projectId: id };
    snapshot[collectionKey('ai_models', scope)] = aiModels;
    snapshot[collectionKey('prompts', scope)] = prompts;
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
