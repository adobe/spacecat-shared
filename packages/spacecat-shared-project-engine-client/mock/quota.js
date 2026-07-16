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
 * AI-unit quota for the Project Engine mock — the metering the live Semrush API enforces on a
 * sub-workspace's `{ ai: { projects, prompts } }` allocation.
 *
 * Real behaviour (spacecat-api-service `serenity/workspace-lifecycle.js` + `brand-provisioning.js`,
 * "workspace doc §5"): a sub-workspace is carved a metered allocation of `projects` + `prompts`
 * units (via the user-manager gateway — OUT of this project-engine mock; the allocation is
 * *provided* here, by seed or the `POST /__quota` control route, mirroring what the user-manager
 * mock/harness transferred). The project-engine API then ENFORCES it: a metered op — project
 * create, prompt write, live publish — that exceeds the allocation is rejected with a **disguised
 * 405** (the status code, not a real method error — the live API reuses 405 for over-allocation).
 * The mock returns that 405 with a JSON `{ message: 'Quota exceeded: …' }` body; the consumer keys
 * off the 405 *status*, not the body. A child created with an empty/inherited
 * allocation lands with 0 units, so its prompt writes and publishes 405. The dev parent runs with
 * limits DISABLED (unlimited), so the mock's default — no quota record for a workspace — is
 * unlimited, and existing flows are unaffected until an allocation is set.
 *
 * This module is pure metering over the {@link InMemoryStore}: the allocation (limits) lives in a
 * `quota` collection (so it rides along in seed / `__reset` / `__dump`), while USAGE is derived
 * live from the actual `projects:{ws}` and `prompts:{ws}:*` collections — so deleting a project or
 * prompt frees its unit, matching an allocation that meters concurrent count.
 */

/** The store collection holding per-workspace allocations: `{ id: ws, projects, prompts }`. */
export const QUOTA_COLLECTION = 'quota';

/**
 * @typedef {import('./store.js').InMemoryStore} InMemoryStore
 * @typedef {{ projects: number | null, prompts: number | null }} Limits a `null` dimension is
 *   unlimited (not metered)
 */

/**
 * Builds the quota API over a store. `null`/omitted limits mean "unlimited" for that dimension.
 * @param {InMemoryStore} store
 */
export function createQuota(store) {
  /** @param {unknown} v @returns {number | null} */
  const asLimit = (v) => (typeof v === 'number' ? v : null);

  const api = {
    /**
     * Sets (grants/replaces) a workspace's AI allocation. Absolute, not additive — pass
     * `{ projects: 0, prompts: 0 }` to model a released/empty-units child. An omitted dimension
     * is unlimited. Mirrors a user-manager resource transfer landing on this workspace.
     * @param {string} workspaceId
     * @param {{ projects?: number | null, prompts?: number | null }} [allocation]
     * @returns {{ id: string, projects: number | null, prompts: number | null }}
     */
    set(workspaceId, allocation = {}) {
      // Read-then-write is safe: the mock store is single-writer (one Node process), so there is no
      // TOCTOU between the get below and the update/create.
      const record = {
        id: workspaceId,
        projects: asLimit(allocation.projects),
        prompts: asLimit(allocation.prompts),
      };
      if (store.get(QUOTA_COLLECTION, workspaceId)) {
        store.update(QUOTA_COLLECTION, workspaceId, {
          projects: record.projects, prompts: record.prompts,
        });
      } else {
        store.create(QUOTA_COLLECTION, record);
      }
      return record;
    },

    /**
     * The workspace's allocation, or `null` when none is set (unlimited).
     * @param {string} workspaceId
     * @returns {Limits | null}
     */
    limits(workspaceId) {
      const q = store.get(QUOTA_COLLECTION, workspaceId);
      if (!q) {
        return null;
      }
      return { projects: asLimit(q.projects), prompts: asLimit(q.prompts) };
    },

    /**
     * Projects currently created in the workspace (the `projects:{ws}` collection size).
     * @param {string} workspaceId
     * @returns {number}
     */
    projectsUsed(workspaceId) {
      return store.size(`projects:${workspaceId}`);
    },

    /**
     * Prompts currently created across ALL the workspace's projects (`prompts:{ws}:*`).
     * @param {string} workspaceId
     * @returns {number}
     */
    promptsUsed(workspaceId) {
      const prefix = `prompts:${workspaceId}:`;
      return store.keys()
        .filter((name) => name.startsWith(prefix))
        .reduce((sum, name) => sum + store.size(name), 0);
    },

    /**
     * Whether the workspace can create one more project. Unlimited (no/`null` projects limit)
     * always true; otherwise true while `used < limit`.
     * @param {string} workspaceId
     * @returns {boolean}
     */
    canCreateProject(workspaceId) {
      const limit = api.limits(workspaceId)?.projects;
      if (limit == null) {
        return true;
      }
      return api.projectsUsed(workspaceId) < limit;
    },

    /**
     * Whether the workspace can create `count` more prompts (all-or-nothing, as the live 405 is).
     * @param {string} workspaceId
     * @param {number} count
     * @returns {boolean}
     */
    canCreatePrompts(workspaceId, count) {
      const limit = api.limits(workspaceId)?.prompts;
      if (limit == null) {
        return true;
      }
      return api.promptsUsed(workspaceId) + count <= limit;
    },

    /**
     * Whether the workspace can publish. An empty-units child (an explicit `prompts: 0`
     * allocation) 405s on publish; an unlimited or non-zero allocation can publish.
     * @param {string} workspaceId
     * @returns {boolean}
     */
    canPublish(workspaceId) {
      const limit = api.limits(workspaceId)?.prompts;
      return limit == null || limit > 0;
    },

    /**
     * Limits + live usage for a workspace, for `__quota` introspection.
     * @param {string} workspaceId
     * @returns {{ workspaceId: string, projects: { limit: number | null, used: number },
     *   prompts: { limit: number | null, used: number } }}
     */
    usage(workspaceId) {
      const limits = api.limits(workspaceId);
      return {
        workspaceId,
        projects: { limit: limits?.projects ?? null, used: api.projectsUsed(workspaceId) },
        prompts: { limit: limits?.prompts ?? null, used: api.promptsUsed(workspaceId) },
      };
    },
  };

  return api;
}
