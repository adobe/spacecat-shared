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

const WORKSPACE_ID = 'ws-1';
const PROJECT_ID = 'pr-1';

/**
 * @typedef {import('./store.js').Snapshot} Snapshot
 */

/** Empty workspace: no projects yet — the "create from scratch" flow starts here. */
export const EMPTY_WORKSPACE = Object.freeze({
  [collectionKey('projects', { workspaceId: WORKSPACE_ID })]: [],
});

/**
 * Workspace with one project that already has an ai_model and a prompt — the "read/patch/run
 * existing data" flow starts here.
 */
export const WORKSPACE_WITH_DATA = Object.freeze({
  [collectionKey('projects', { workspaceId: WORKSPACE_ID })]: [
    { id: PROJECT_ID, name: 'Seeded Project', workspace_id: WORKSPACE_ID },
  ],
  [collectionKey('ai_models', { workspaceId: WORKSPACE_ID, projectId: PROJECT_ID })]: [
    { id: 'model-gpt4o', name: 'gpt-4o' },
  ],
  [collectionKey('prompts', { workspaceId: WORKSPACE_ID, projectId: PROJECT_ID })]: [
    // Shape matches AIOPromptWithStatus (the by_tags list item): id, name, tags.
    { id: 'prompt-1', name: 'What is the best running shoe?', tags: [] },
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
export const SEED_IDS = Object.freeze({ workspaceId: WORKSPACE_ID, projectId: PROJECT_ID });

/**
 * @typedef {object} SeedProject
 * @property {string} id project id (use the project / `semrush_workspace_id` ids from your DB
 *   fixtures so the mock and Postgres line up)
 * @property {string} [name]
 * @property {Array<{ id: string, name?: string }>} [aiModels]
 * @property {Array<{ id: string, name: string, tags?: string[] }>} [prompts] AIOPromptWithStatus
 */

/**
 * Authors a collection-keyed {@link Snapshot} from a friendly, DB-shaped description, so a caller
 * (the cross-repo e2e harness) can mirror the rows it inserted into Postgres without hand-writing
 * `collectionKey(...)` keys. Pass the result to `POST /__seed` or write it to a `MOCK_SEED_FILE`.
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
