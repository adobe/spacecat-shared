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

/**
 * Named seed sets for the Project Engine mock. Each is a {@link Snapshot} keyed by the same
 * collection names {@link createStatefulOps} uses (see {@link collectionKey}), so a seed loaded
 * via `store.load(seed)` is immediately visible to the stateful handlers. E2E selects a seed at
 * startup and restores it between tests with `store.reset()` (exposed as `POST /__reset`).
 */

import { collectionKey } from './stateful.js';

// Real-shaped fixtures: the Project Engine API types every id as `format: uuid`, so the seeds
// use fixed UUIDs (not `ws-1`/`pr-1`) to mirror production data. Fixed, not generated, so
// SEED_IDS stays stable for assertions.
const WORKSPACE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'; // workspace UUID (path {id})
const PROJECT_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'; // project UUID (path {project_id})
const AI_MODEL_ASSIGNMENT_ID = 'c3d4e5f6-a7b8-4c9d-8e1f-2a3b4c5d6e7f'; // ProjectAIModelResponse.id
const AI_MODEL_CATALOG_ID = 'd4e5f6a7-b8c9-4d0e-9f1a-3b4c5d6e7f80'; // AIModelResponse.id (the model_id)
const PROMPT_ID = 'e5f6a7b8-c9d0-4e1f-8a2b-4c5d6e7f8091'; // AIOPromptWithStatus.id

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
    { id: PROJECT_ID, name: 'Seeded Project', workspace_id: WORKSPACE_ID },
  ],
  [collectionKey('ai_models', { workspaceId: WORKSPACE_ID, projectId: PROJECT_ID })]: [
    // ProjectAIModelResponse: assignment id + nested catalog model + prompts_count.
    {
      id: AI_MODEL_ASSIGNMENT_ID,
      model: { id: AI_MODEL_CATALOG_ID, key: 'gpt-4o', name: 'GPT-4o' },
      prompts_count: 0,
    },
  ],
  [collectionKey('prompts', { workspaceId: WORKSPACE_ID, projectId: PROJECT_ID })]: [
    // AIOPromptWithStatus (the by_tags list item): id, name, is_new, tags.
    {
      id: PROMPT_ID, name: 'What is the best running shoe?', is_new: false, tags: [],
    },
  ],
});

/** All seed sets by name, for the runner to select via env/flag. */
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
});

/**
 * @typedef {object} SeedProject
 * @property {string} id project UUID (use the project / `semrush_workspace_id` UUIDs from your DB
 *   fixtures so the mock and Postgres line up)
 * @property {string} [name]
 * @property {Array<object>} [aiModels] entity rows, stored verbatim — pass the real
 *   ProjectAIModelResponse shape (`{ id, model: { id, key, name }, prompts_count }`) for fidelity
 * @property {Array<object>} [prompts] entity rows, stored verbatim (`tags` defaults to `[]`) —
 *   pass the real AIOPromptWithStatus shape (`{ id, name, is_new, tags }`)
 */

/**
 * Authors a collection-keyed {@link Snapshot} from a friendly, DB-shaped description, so a caller
 * (the cross-repo e2e harness) can mirror the rows it inserted into Postgres without hand-writing
 * `collectionKey(...)` keys. Pass the result to `POST /__seed` or write it to a `MOCK_SEED_FILE`.
 * `aiModels`/`prompts` are routed verbatim, so use real UUIDs and real entity shapes (see
 * {@link WORKSPACE_WITH_DATA} for the reference shapes) to keep the mock close to production data.
 *
 * @param {{ workspaceId: string, projects?: SeedProject[] }} spec
 * @returns {import('./store.js').Snapshot}
 */
export function buildSeed({ workspaceId, projects = [] }) {
  const projectsKey = collectionKey('projects', { workspaceId });
  /** @type {import('./store.js').Snapshot} */
  const snapshot = { [projectsKey]: [] };
  for (const {
    id, name, aiModels = [], prompts = [],
  } of projects) {
    snapshot[projectsKey].push({ id, name, workspace_id: workspaceId });
    const scope = { workspaceId, projectId: id };
    snapshot[collectionKey('ai_models', scope)] = aiModels.map((m) => ({ ...m }));
    snapshot[collectionKey('prompts', scope)] = prompts.map((p) => ({ tags: [], ...p }));
  }
  return snapshot;
}
