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

/**
 * Named seed sets for the User Manager mock. Each is a {@link Snapshot} keyed by the same
 * collection names used ({@link WORKSPACES} for the workspace tree, {@link RESOURCES_COLLECTION}
 * for per-workspace AI resources, {@link STATUS_CONTROL} for `not ready` budgets), so a seed
 * loaded via `store.load(seed)` is immediately visible to the stateful handlers. E2E selects a
 * seed at startup and restores it between tests with `store.reset()` (exposed as `POST /__reset`).
 *
 * Workspace entities are built via the typed {@link createWorkspaceMock} factory, so the fixtures
 * are spec-shaped and checked by tsc (`// @ts-check`). E2E flows reference the fixed UUIDs through
 * {@link SEED_IDS}.
 */

import {
  WORKSPACES, STATUS_CONTROL,
} from './stateful.js';
import { RESOURCES_COLLECTION } from './quota.js';
import { createWorkspaceMock } from './factories.js';

/**
 * @typedef {import('./quota.js').UsedLimit} UsedLimit
 * A per-dimension seed value: a bare `total`, or a partial `{ used, drafted, total }`.
 * @typedef {number | Partial<UsedLimit>} DimSeed
 */

/** @param {DimSeed} [v] @returns {UsedLimit} */
const dim = (v) => (typeof v === 'number'
  ? { used: 0, drafted: 0, total: v }
  : {
    used: 0, drafted: 0, total: 0, ...(v ?? {}),
  });

/**
 * A `workspace_resources` store entity: `{ id, ai: { projects, prompts, weekly_prompts } }`.
 * @param {string} id
 * @param {{ projects?: DimSeed, prompts?: DimSeed }} [alloc]
 * @returns {import('./store.js').Entity}
 */
const resourceEntity = (id, { projects, prompts } = {}) => ({
  id,
  ai: { projects: dim(projects), prompts: dim(prompts), weekly_prompts: dim(0) },
});

// Real-shaped fixtures: the User Manager API types every workspace id as a UUID-like string, so the
// seeds use fixed UUIDs (not `ws-1`) to mirror production data. Fixed, not generated, so SEED_IDS
// stays stable for assertions.
// Hierarchy 1 parent/child — the same UUIDs as the Project Engine mock's first hierarchy
// (PE seeds.js), so PE projects and UM workspaces line up across the two packages. The parent
// is the URL path `{id}`; the child is a brand sub-workspace under it.
const PARENT_WORKSPACE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'; // == PE parent
const CHILD_WORKSPACE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'; // == PE child

// A second, fully independent hierarchy (present only in `two-hierarchies`). Ids match the Project
// Engine mock's second hierarchy so PE projects and UM workspaces line up across the two packages.
const PARENT_WORKSPACE_ID_2 = 'a2b3c4d5-e6f7-4a8b-9c0d-1e2f3a4b5c6d';
const CHILD_WORKSPACE_ID_2 = 'b3c4d5e6-f7a8-4b9c-8d0e-2f3a4b5c6d7e';

/**
 * @typedef {import('./store.js').Snapshot} Snapshot
 */

/** Just the org parent workspace, no children yet — the "create a sub-workspace from scratch" flow
 * starts here (createSubworkspace under the parent). */
export const EMPTY_PARENT = Object.freeze({
  [WORKSPACES]: [
    createWorkspaceMock({ id: PARENT_WORKSPACE_ID, title: 'Parent Org Workspace', parent_id: '' }),
  ],
});

/**
 * The org parent with one already-provisioned child sub-workspace — the "read/transfer/delete
 * existing data" flow starts here. The child links to the parent via `parent_id`, so the family
 * walk and the delete cascade both find it.
 */
export const PARENT_WITH_CHILD = Object.freeze({
  [WORKSPACES]: [
    createWorkspaceMock({ id: PARENT_WORKSPACE_ID, title: 'Parent Org Workspace', parent_id: '' }),
    createWorkspaceMock({
      id: CHILD_WORKSPACE_ID,
      title: 'Seeded Child [b2c3d4e5]',
      parent_id: PARENT_WORKSPACE_ID,
      status: 'created',
    }),
  ],
});

/**
 * Two coexisting, independent parent→child hierarchies — the User Manager side of the Project
 * Engine mock's `two-hierarchies` seed (matching workspace ids). For the dual-org case where two
 * mock-wired orgs each need their own parent workspace + brand sub-workspace (the DB enforces a
 * unique `semrush_workspace_id`). A strict superset of `parent-with-child`.
 */
export const TWO_HIERARCHIES = Object.freeze({
  [WORKSPACES]: [
    createWorkspaceMock({ id: PARENT_WORKSPACE_ID, title: 'Parent Org Workspace', parent_id: '' }),
    createWorkspaceMock({
      id: CHILD_WORKSPACE_ID,
      title: 'Seeded Child [b2c3d4e5]',
      parent_id: PARENT_WORKSPACE_ID,
      status: 'created',
    }),
    createWorkspaceMock({ id: PARENT_WORKSPACE_ID_2, title: 'Second Org Workspace', parent_id: '' }),
    createWorkspaceMock({
      id: CHILD_WORKSPACE_ID_2,
      title: 'Seeded Child [b3c4d5e6]',
      parent_id: PARENT_WORKSPACE_ID_2,
      status: 'created',
    }),
  ],
});

/**
 * `parent-with-child` plus **finite AI resources** — the metered variant the dynamic-allocation
 * tests opt into (the plain `parent-with-child` stays unmetered so existing flows are unaffected).
 * The parent holds a gold-shaped pool net of the child's carve (13/800 total, child already carved
 * 2/100 → parent shows 11/700); the child holds its `2 projects / 100 prompts` allocation. Reads
 * (`/resources`) and transfers (carve/release, `422` on over-draw) meter against these.
 */
export const PARENT_WITH_CHILD_METERED = Object.freeze({
  [WORKSPACES]: [
    createWorkspaceMock({ id: PARENT_WORKSPACE_ID, title: 'Parent Org Workspace', parent_id: '' }),
    createWorkspaceMock({
      id: CHILD_WORKSPACE_ID,
      title: 'Seeded Child [b2c3d4e5]',
      parent_id: PARENT_WORKSPACE_ID,
      status: 'created',
    }),
  ],
  [RESOURCES_COLLECTION]: [
    resourceEntity(PARENT_WORKSPACE_ID, { projects: 11, prompts: 700 }),
    resourceEntity(CHILD_WORKSPACE_ID, { projects: 2, prompts: 100 }),
  ],
});

/**
 * All seed sets by name, for the runner to select via env/flag. Typed as a string map so a runtime
 * `MOCK_SEED` (an arbitrary string) can index it with a fallback (see {@link Context}).
 * @type {Record<string, import('./store.js').Snapshot>}
 */
export const SEEDS = Object.freeze({
  'empty-parent': EMPTY_PARENT,
  'parent-with-child': PARENT_WITH_CHILD,
  'parent-with-child-metered': PARENT_WITH_CHILD_METERED,
  'two-hierarchies': TWO_HIERARCHIES,
});

/** Default seed loaded when none is specified. */
export const DEFAULT_SEED = 'parent-with-child';

/** Ids used by the seed sets, exported so E2E flows can reference them without hardcoding. */
export const SEED_IDS = Object.freeze({
  parentWorkspaceId: PARENT_WORKSPACE_ID,
  childWorkspaceId: CHILD_WORKSPACE_ID,
  // Hierarchy 2 (present only in `two-hierarchies`).
  secondParentWorkspaceId: PARENT_WORKSPACE_ID_2,
  secondChildWorkspaceId: CHILD_WORKSPACE_ID_2,
});

/**
 * @typedef {object} SeedWorkspace
 * @property {string} id workspace UUID (use the `semrush_workspace_id` UUIDs from your DB fixtures
 *   so the mock and Postgres line up)
 * @property {string} [title]
 * @property {string} [parentId] the parent workspace id (`''`/omitted for a root)
 * @property {string} [status] settled status (default `created`)
 * @property {number} [pendingStatusReads] number of `not ready` reads before it settles (default 0)
 *
 * @typedef {object} SeedResources a workspace's finite AI resources (omit to leave it unmetered)
 * @property {string} workspaceId the workspace these resources belong to (master or child)
 * @property {DimSeed} [projects] project units — a bare `total`, or `{ used, drafted, total }`
 * @property {DimSeed} [prompts] prompt units — a bare `total`, or `{ used, drafted, total }`
 */

/**
 * Authors a collection-keyed {@link Snapshot} from a friendly, DB-shaped description, so a caller
 * (the cross-repo e2e harness) can mirror the rows it inserted without hand-writing collection
 * keys. Each workspace is built via {@link createWorkspaceMock} (typed) with real UUIDs; pass
 * `resources` to give workspaces finite `{ used, drafted, total }` AI allocations the mock then
 * meters reads/transfers against (a workspace with no entry stays unmetered / unlimited).
 *
 * @param {{ workspaces?: SeedWorkspace[], resources?: SeedResources[] }} spec
 * @returns {import('./store.js').Snapshot}
 */
export function buildSeed({ workspaces = [], resources = [] } = {}) {
  /** @type {import('./store.js').Snapshot} */
  const snapshot = { [WORKSPACES]: [], [RESOURCES_COLLECTION]: [], [STATUS_CONTROL]: [] };
  for (const {
    id, title, parentId = '', status = 'created', pendingStatusReads = 0,
  } of workspaces) {
    snapshot[WORKSPACES].push(createWorkspaceMock({
      id, title: title ?? `Workspace ${id}`, parent_id: parentId, status,
    }));
    if (pendingStatusReads > 0) {
      snapshot[STATUS_CONTROL].push({ id, pending: pendingStatusReads });
    }
  }
  for (const { workspaceId, projects, prompts } of resources) {
    snapshot[RESOURCES_COLLECTION].push(resourceEntity(workspaceId, { projects, prompts }));
  }
  return snapshot;
}
