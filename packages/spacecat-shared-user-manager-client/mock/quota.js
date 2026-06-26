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
 * Parent-pool allocation for the User Manager mock — the metering the live Semrush API enforces
 * when units are carved off a parent workspace's pool.
 *
 * Real behaviour (spacecat-api-service `serenity/workspace-lifecycle.js`, "workspace doc §5"): a
 * child sub-workspace is carved a metered `{ ai: { projects, prompts } }` allocation drawn from its
 * PARENT's pool, at create (`createSubworkspace`) and on re-grant (`transferWorkspaceResources`).
 * A parent without enough free units rejects the draw with a **422** "insufficient available units"
 * (the status, not the body, is the contract; the consumer keys off it). The dev parent runs with
 * limits DISABLED (unlimited), so the mock's default — no pool record for a workspace — is
 * unlimited, and existing flows are unaffected until a pool is set.
 *
 * This module is pure metering over the {@link InMemoryStore}: the available pool lives in a
 * `workspace_pool` collection (so it rides along in seed / `__reset` / `__dump`). A draw deducts
 * from it; a release (a transfer of `{ projects: 0, … }` back) is a no-op against the pool (the
 * exact release accounting is a live-replay pin). The pool owner is chosen by the handler: the
 * parent path id for a create, the child's `parent_id` for a transfer. The 422 condition + body are
 * pinned by the live replay.
 */

/** The store collection holding per-workspace available pools: `{ id, projects, prompts }`. */
export const POOL_COLLECTION = 'workspace_pool';

/**
 * @typedef {import('./store.js').InMemoryStore} InMemoryStore
 * @typedef {{ projects: number | null, prompts: number | null }} Pool a `null` dimension is
 *   unlimited (not metered)
 * @typedef {{ projects?: number, prompts?: number }} Allocation a requested AI allocation
 */

/**
 * Builds the quota API over a store. `null`/omitted pool dimensions mean "unlimited".
 * @param {InMemoryStore} store
 */
export function createQuota(store) {
  /** @param {unknown} v @returns {number | null} */
  const asLimit = (v) => (typeof v === 'number' ? v : null);

  const api = {
    /**
     * Sets (grants/replaces) a workspace's available pool. Absolute, not additive. An omitted
     * dimension is unlimited. Mirrors a parent workspace provisioned with a finite pool.
     * @param {string} workspaceId
     * @param {{ projects?: number | null, prompts?: number | null }} [pool]
     * @returns {{ id: string, projects: number | null, prompts: number | null }}
     */
    set(workspaceId, pool = {}) {
      // Read-then-write is safe: the mock store is single-writer (one Node process), so there is no
      // TOCTOU between the get below and the update/create.
      const record = {
        id: workspaceId,
        projects: asLimit(pool.projects),
        prompts: asLimit(pool.prompts),
      };
      if (store.get(POOL_COLLECTION, workspaceId)) {
        store.update(POOL_COLLECTION, workspaceId, {
          projects: record.projects, prompts: record.prompts,
        });
      } else {
        store.create(POOL_COLLECTION, record);
      }
      return record;
    },

    /**
     * The workspace's available pool, or `null` when none is set (unlimited).
     * @param {string} workspaceId
     * @returns {Pool | null}
     */
    pool(workspaceId) {
      const p = store.get(POOL_COLLECTION, workspaceId);
      if (!p) {
        return null;
      }
      return { projects: asLimit(p.projects), prompts: asLimit(p.prompts) };
    },

    /**
     * Whether `workspaceId`'s pool covers an `{ projects, prompts }` draw (all-or-nothing, as the
     * live 422 is). Unlimited (no pool, or a `null` dimension) always covers that dimension; an
     * unset pool owner (e.g. a transfer whose target has no parent) is unlimited too.
     * @param {string | undefined | null} workspaceId
     * @param {Allocation} [allocation]
     * @returns {boolean}
     */
    canAllocate(workspaceId, allocation = {}) {
      if (!workspaceId) {
        return true;
      }
      const pool = api.pool(workspaceId);
      if (!pool) {
        return true;
      }
      const needProjects = Number(allocation.projects) || 0;
      const needPrompts = Number(allocation.prompts) || 0;
      const okProjects = pool.projects == null || pool.projects >= needProjects;
      const okPrompts = pool.prompts == null || pool.prompts >= needPrompts;
      return okProjects && okPrompts;
    },

    /**
     * Deducts a draw from `workspaceId`'s pool (no-op when unlimited or the
     * owner is unset). Caller must have checked {@link canAllocate} first. Returns the remaining
     * pool, or null when unmetered.
     * @param {string | undefined | null} workspaceId
     * @param {Allocation} [allocation]
     * @returns {Pool | null}
     */
    draw(workspaceId, allocation = {}) {
      if (!workspaceId) {
        return null;
      }
      const pool = api.pool(workspaceId);
      if (!pool) {
        return null;
      }
      const next = {
        projects: pool.projects == null ? null : pool.projects - (Number(allocation.projects) || 0),
        prompts: pool.prompts == null ? null : pool.prompts - (Number(allocation.prompts) || 0),
      };
      store.update(POOL_COLLECTION, workspaceId, next);
      return next;
    },

    /**
     * The workspace's pool, for `__quota` introspection.
     * @param {string} workspaceId
     * @returns {{ workspaceId: string, pool: Pool | null }}
     */
    usage(workspaceId) {
      return { workspaceId, pool: api.pool(workspaceId) };
    },
  };

  return api;
}
