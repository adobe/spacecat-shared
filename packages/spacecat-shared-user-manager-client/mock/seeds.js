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
 * collection names used ({@link WORKSPACES} for the workspace tree, {@link POOL_COLLECTION}
 * for parent pools, {@link STATUS_CONTROL} for `not ready` budgets), so a seed loaded via
 * `store.load(seed)` is immediately visible to the stateful handlers. E2E selects a seed at startup
 * and restores it between tests with `store.reset()` (exposed as `POST /__reset`).
 *
 * Workspace entities are built via the typed {@link createWorkspaceMock} factory, so the fixtures
 * are spec-shaped and checked by tsc (`// @ts-check`). E2E flows reference the fixed UUIDs through
 * {@link SEED_IDS}.
 */

import {
  WORKSPACES, STATUS_CONTROL,
} from './stateful.js';
import { POOL_COLLECTION } from './quota.js';
import { createWorkspaceMock } from './factories.js';

// Real-shaped fixtures: the User Manager API types every workspace id as a UUID-like string, so the
// seeds use fixed UUIDs (not `ws-1`) to mirror production data. Fixed, not generated, so SEED_IDS
// stays stable for assertions.
const PARENT_WORKSPACE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d'; // org parent workspace (path {id})
const CHILD_WORKSPACE_ID = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e'; // a brand sub-workspace under it

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
 * All seed sets by name, for the runner to select via env/flag. Typed as a string map so a runtime
 * `MOCK_SEED` (an arbitrary string) can index it with a fallback (see {@link Context}).
 * @type {Record<string, import('./store.js').Snapshot>}
 */
export const SEEDS = Object.freeze({
  'empty-parent': EMPTY_PARENT,
  'parent-with-child': PARENT_WITH_CHILD,
});

/** Default seed loaded when none is specified. */
export const DEFAULT_SEED = 'parent-with-child';

/** Ids used by the seed sets, exported so E2E flows can reference them without hardcoding. */
export const SEED_IDS = Object.freeze({
  parentWorkspaceId: PARENT_WORKSPACE_ID,
  childWorkspaceId: CHILD_WORKSPACE_ID,
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
 * @typedef {object} SeedPool
 * @property {string} workspaceId the pool owner (the parent that child allocations draw from)
 * @property {number | null} [projects] available project units (`null`/omitted = unlimited)
 * @property {number | null} [prompts] available prompt units (`null`/omitted = unlimited)
 */

/**
 * Authors a collection-keyed {@link Snapshot} from a friendly, DB-shaped description, so a caller
 * (the cross-repo e2e harness) can mirror the rows it inserted without hand-writing collection
 * keys. Each workspace is built via {@link createWorkspaceMock} (typed) with real UUIDs; pass
 * `pools` to mirror finite parent allocations the mock then meters child creates/transfers against.
 *
 * @param {{ workspaces?: SeedWorkspace[], pools?: SeedPool[] }} spec
 * @returns {import('./store.js').Snapshot}
 */
export function buildSeed({ workspaces = [], pools = [] } = {}) {
  /** @type {import('./store.js').Snapshot} */
  const snapshot = { [WORKSPACES]: [], [POOL_COLLECTION]: [], [STATUS_CONTROL]: [] };
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
  for (const { workspaceId, projects = null, prompts = null } of pools) {
    snapshot[POOL_COLLECTION].push({ id: workspaceId, projects, prompts });
  }
  return snapshot;
}
