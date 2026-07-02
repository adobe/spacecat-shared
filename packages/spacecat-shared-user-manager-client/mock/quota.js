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
 * Per-workspace AI resource accounting for the User Manager mock — the `{ used, drafted, total }`
 * model the live Semrush gateway exposes at `GET /v1/workspaces/{id}/resources` and enforces on a
 * resource transfer.
 *
 * Model (live-verified 2026-07-02 against `adobe-hackathon.semrush.com`; see the
 * dynamic-allocation plan "Gate 0"):
 * - Every metered workspace holds per-product `{ used, drafted, total }` for `ai`'s `projects` and
 *   `prompts` (plus `weekly_prompts`, always `0` — provisioning is daily-only). `total` is the
 *   allocation limit; `used` is PUBLISHED consumption; `drafted` is staged and free.
 *   `free = total − used`.
 * - A **carve** — a child create, or a transfer that RAISES a child's `total` — moves units from
 *   the MASTER: `master.total` decreases by the delta and `child.total` is set ABSOLUTELY. A
 *   **release** — a transfer that LOWERS a child's `total` — returns the delta to `master.total`.
 *   (Verified: carving a `(3,300)` child moved the master 100→97 / 19920→19620.)
 * - A transfer is **absolute** (sets `child.total` to the value sent) and therefore **idempotent**:
 *   re-sending the same `total` moves nothing further. Carving a master beyond its free units is
 *   rejected `422 "insufficient available units in subscription"` (the status+message are the live
 *   contract).
 * - A workspace with **no resources record is unmetered (unlimited)** — so existing flows/seeds are
 *   unaffected until a seed or `POST /__quota` gives a workspace finite resources.
 *
 * This module owns `total` + the master-pool movement only. A child's own `used` is NOT changed
 * here: metered writes happen on the separate Project Engine gateway/process (the UM/PE split — the
 * two mocks do not share state; full round-trip fidelity is the live-gateway canary's job).
 */

/** The store collection holding per-workspace AI resources: `{ id, ai: AiResources }`. */
export const RESOURCES_COLLECTION = 'workspace_resources';

/** The AI resource dimensions this mock meters and moves between master and child. */
export const AI_DIMS = /** @type {const} */ (['projects', 'prompts']);

/**
 * @typedef {import('./store.js').InMemoryStore} InMemoryStore
 * @typedef {{ used: number, drafted: number, total: number }} UsedLimit a per-dimension triple
 * @typedef {{ projects: UsedLimit, prompts: UsedLimit, weekly_prompts: UsedLimit }} AiResources
 * @typedef {{ projects?: number, prompts?: number }} Allocation a per-dimension total (units)
 * @typedef {Partial<Record<'projects' | 'prompts', number | Partial<UsedLimit>>>} ResourceInput
 */

/** @returns {UsedLimit} a zeroed dimension. */
const zeroDim = () => ({ used: 0, drafted: 0, total: 0 });

/** @returns {AiResources} a zeroed, daily-only AI resource set. */
const zeroAi = () => ({ projects: zeroDim(), prompts: zeroDim(), weekly_prompts: zeroDim() });

/**
 * Normalizes a per-dimension input (a bare `total` number, or a partial `{used,drafted,total}`)
 * onto a base dimension.
 * @param {UsedLimit} base
 * @param {number | Partial<UsedLimit> | undefined} input
 * @returns {UsedLimit}
 */
function applyDim(base, input) {
  if (input == null) {
    return { ...base };
  }
  if (typeof input === 'number') {
    return { ...base, total: input };
  }
  return {
    used: typeof input.used === 'number' ? input.used : base.used,
    drafted: typeof input.drafted === 'number' ? input.drafted : base.drafted,
    total: typeof input.total === 'number' ? input.total : base.total,
  };
}

/**
 * Builds the resource-accounting API over a store. A workspace with no record is unmetered.
 * @param {InMemoryStore} store
 */
export function createQuota(store) {
  const api = {
    /**
     * The workspace's full AI resources, or `null` when unmetered (no record).
     * @param {string} workspaceId
     * @returns {AiResources | null}
     */
    resources(workspaceId) {
      const record = store.get(RESOURCES_COLLECTION, workspaceId);
      return record ? /** @type {AiResources} */ (record.ai) : null;
    },

    /**
     * Sets (creates/replaces) a workspace's AI resources. Absolute per provided dimension; a bare
     * number sets `total` (used/drafted default 0). Makes the workspace metered. Mirrors a
     * workspace provisioned with a finite allocation.
     * @param {string} workspaceId
     * @param {ResourceInput} [input]
     * @returns {AiResources}
     */
    set(workspaceId, input = {}) {
      // Single-writer store (one Node process): the get-then-write below has no TOCTOU.
      const current = api.resources(workspaceId) ?? zeroAi();
      /** @type {AiResources} */
      const ai = {
        projects: applyDim(current.projects, input.projects),
        prompts: applyDim(current.prompts, input.prompts),
        weekly_prompts: { ...current.weekly_prompts },
      };
      if (store.get(RESOURCES_COLLECTION, workspaceId)) {
        store.update(RESOURCES_COLLECTION, workspaceId, { ai });
      } else {
        store.create(RESOURCES_COLLECTION, { id: workspaceId, ai });
      }
      return ai;
    },

    /**
     * Whether `masterId` has enough FREE units (`total − used`) to carve `need` per dimension.
     * Unmetered masters (no record) always can. All-or-nothing, as the live `422` is.
     * @param {string | undefined | null} masterId
     * @param {Allocation} [need]
     * @returns {boolean}
     */
    canCarve(masterId, need = {}) {
      if (!masterId) {
        return true;
      }
      const master = api.resources(masterId);
      if (!master) {
        return true;
      }
      return AI_DIMS.every((dim) => {
        const want = Number(need[dim]) || 0;
        return (master[dim].total - master[dim].used) >= want;
      });
    },

    /**
     * Moves `delta` units per dimension out of (`delta > 0`) or back into (`delta < 0`) the
     * master's `total`. No-op for an unmetered master. Callers must have checked {@link canCarve}
     * for the positive part first.
     * @param {string | undefined | null} masterId
     * @param {Allocation} [delta]
     * @returns {AiResources | null} the master's resources after the move, or null when unmetered
     */
    moveFromMaster(masterId, delta = {}) {
      if (!masterId) {
        return null;
      }
      const master = api.resources(masterId);
      if (!master) {
        return null;
      }
      /** @type {ResourceInput} */
      const next = {};
      for (const dim of AI_DIMS) {
        const d = Number(delta[dim]) || 0;
        next[dim] = { total: master[dim].total - d };
      }
      return api.set(masterId, next);
    },

    /**
     * Applies an ABSOLUTE transfer of `alloc` to a child: for every provided dimension, sets the
     * child's `total` to the value sent and moves the delta to/from the master. Idempotent (a
     * same-value transfer moves nothing). Returns `{ ok: false }` when a positive delta can't be
     * covered by the master's free units (the caller maps that to the `422`). Note: this always
     * writes a child resources record for the provided dims — so transferring onto a previously
     * unmetered child makes it metered (mirrors the live gateway, where a child always has an
     * allocation record once resources have been moved to it).
     * @param {string | undefined | null} masterId the child's parent (units source/sink)
     * @param {string} childId
     * @param {Allocation} [alloc] the absolute per-dimension totals to set on the child
     * @returns {{ ok: boolean }}
     */
    applyTransfer(masterId, childId, alloc = {}) {
      const child = api.resources(childId) ?? zeroAi();
      /** @type {Allocation} */
      const positiveDelta = {};
      /** @type {Allocation} */
      const delta = {};
      /** @type {ResourceInput} */
      const childNext = {};
      for (const dim of AI_DIMS) {
        // Only dimensions present in the transfer move; omitted ones are left untouched.
        if (alloc[dim] != null) {
          const target = Number(alloc[dim]) || 0;
          const d = target - child[dim].total;
          delta[dim] = d;
          if (d > 0) {
            positiveDelta[dim] = d;
          }
          childNext[dim] = { total: target };
        }
      }
      if (!api.canCarve(masterId, positiveDelta)) {
        return { ok: false };
      }
      api.moveFromMaster(masterId, delta);
      api.set(childId, childNext);
      return { ok: true };
    },

    /**
     * The workspace's resources, for `POST/GET /__quota` introspection.
     * @param {string} workspaceId
     * @returns {{ workspaceId: string, resources: AiResources | null }}
     */
    usage(workspaceId) {
      return { workspaceId, resources: api.resources(workspaceId) };
    },
  };

  return api;
}
