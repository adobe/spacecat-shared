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
 * The stateful slice of the User Manager mock.
 *
 * The confirmed consumer inventory (see docs/mock-statefulness.md) makes ONE resource group
 * write-then-read: **workspaces** (sub-workspace lifecycle). `createSubworkspace` writes a child
 * → `getWorkspaceStatus` / `listWorkspaceFamily` read it → `transferWorkspaceResources` updates its
 * allocation → `deleteWorkspace` removes it and cascades over its descendants — see
 * {@link STATEFUL_RESOURCES}. This module encodes that as pure operations over an
 * {@link InMemoryStore} with no Counterfact / HTTP coupling, so it is unit-testable on its own. The
 * Counterfact runner adapts these into per-path handlers (mapping store results into spec-valid
 * response envelopes); the runner serves NO auto-stubs (`--serve`, no `generate` — see run.js), so
 * an unmodelled path 404s.
 *
 * The live `not ready → created` settle is the one async the consumer actually polls
 * (`getWorkspaceStatus`). The mock models it DETERMINISTICALLY (no wall clock): a workspace can be
 * given a `pendingStatusReads` budget (default 0 → reads `created` immediately) that
 * {@link readStatus} burns down per read, returning `not ready` until it reaches 0. Set it
 * via a seed or the `POST /__status` control route to exercise the consumer's poll loop.
 */

/**
 * @typedef {import('./store.js').InMemoryStore} InMemoryStore
 * @typedef {import('./store.js').Entity} Entity
 */

/** The store collection holding the workspace tree (global, keyed by workspace id). */
export const WORKSPACES = 'workspaces';

/** The store collection holding per-workspace `not ready` status budgets: `{ id, pending }`. */
export const STATUS_CONTROL = 'workspace_status';

/**
 * The resource group the live audit confirmed the consumer write-then-reads. A single global
 * `workspaces` tree — children link to their parent via `parent_id`, which the family walk and the
 * delete cascade both follow.
 */
export const STATEFUL_RESOURCES = Object.freeze([WORKSPACES]);

/**
 * The stateful operations over the workspace tree. Each operates on the store and returns stored
 * entities / lists / ids / booleans — never HTTP envelopes — so the Counterfact adapter owns
 * response shaping. Pure and synchronous; the store clones on every read/write.
 * @param {InMemoryStore} store
 */
export function createStatefulOps(store) {
  /**
   * The ids of `root` plus every workspace transitively beneath it (via `parent_id`). `root` is
   * included only when it exists. Pure tree walk over the current `workspaces` collection.
   * @param {string} root
   * @returns {string[]}
   */
  function descendantIds(root) {
    const all = store.list(WORKSPACES);
    /** @type {Map<string, string[]>} */
    const childrenOf = new Map();
    for (const ws of all) {
      const parent = String(ws.parent_id ?? '');
      const siblings = childrenOf.get(parent);
      if (siblings) {
        siblings.push(String(ws.id));
      } else {
        childrenOf.set(parent, [String(ws.id)]);
      }
    }
    /** @type {string[]} */
    const out = [];
    const seen = new Set();
    /** @type {string[]} */
    const queue = store.get(WORKSPACES, root) ? [root] : [];
    while (queue.length > 0) {
      const id = /** @type {string} */ (queue.shift());
      if (seen.has(id)) {
        // A cycle would be a corrupt seed, but guard so the walk always terminates.
        // eslint-disable-next-line no-continue
        continue;
      }
      seen.add(id);
      out.push(id);
      for (const child of childrenOf.get(id) ?? []) {
        queue.push(child);
      }
    }
    return out;
  }

  const workspaces = {
    /**
     * Creates a workspace (a child sub-workspace under `parent_id`). The body is a fully-shaped
     * workspace entity (built by the handler via {@link createWorkspaceMock}).
     * @param {Partial<Entity> & Record<string, unknown>} body
     * @returns {Entity}
     */
    create(body) {
      return store.create(WORKSPACES, body);
    },

    /**
     * @param {string} id
     * @returns {Entity | undefined}
     */
    get(id) {
      return store.get(WORKSPACES, id);
    },

    /**
     * @param {string} id
     * @returns {boolean}
     */
    exists(id) {
      return store.get(WORKSPACES, id) !== undefined;
    },

    /** @returns {Entity[]} */
    list() {
      return store.list(WORKSPACES);
    },

    /**
     * The family of `parentId`: that workspace plus every descendant, as a top-level list (the live
     * `GET …/family` shape). Empty when `parentId` is unknown.
     * @param {string} parentId
     * @returns {Entity[]}
     */
    listFamily(parentId) {
      return descendantIds(parentId)
        .map((id) => store.get(WORKSPACES, id))
        .filter((ws) => ws !== undefined);
    },

    /**
     * Deletes `id` and every descendant (the live delete cascades), plus their status budgets.
     * Returns the ids actually removed (empty when `id` is unknown).
     * @param {string} id
     * @returns {string[]}
     */
    remove(id) {
      const ids = descendantIds(id);
      for (const wid of ids) {
        store.delete(WORKSPACES, wid);
        store.delete(STATUS_CONTROL, wid);
      }
      return ids;
    },

    /**
     * Sets a workspace's `not ready` budget: the next `n` {@link readStatus} calls return
     * `not ready` before it settles to the workspace's real status. `0` clears it (immediately
     * settled). Mirrors a seed flag / the `POST /__status` control route.
     * @param {string} id
     * @param {number} n
     * @returns {{ id: string, pending: number }}
     */
    setPendingStatus(id, n) {
      const pending = Math.max(0, Number(n) || 0);
      const record = { id, pending };
      if (store.get(STATUS_CONTROL, id)) {
        store.update(STATUS_CONTROL, id, { pending });
      } else {
        store.create(STATUS_CONTROL, record);
      }
      return record;
    },

    /**
     * Reads a workspace's status, deterministically burning down any `pendingStatusReads` budget:
     * while the budget is > 0 it decrements and returns `not ready`; once exhausted (or never set)
     * it returns the workspace's settled `status` (default `created`). Assumes the workspace exists
     * — the handler checks existence first (a missing workspace is a 403). Mutating-on-read is the
     * deterministic stand-in for the live async settle.
     * @param {string} id
     * @returns {string}
     */
    readStatus(id) {
      const ctrl = store.get(STATUS_CONTROL, id);
      if (ctrl && Number(ctrl.pending) > 0) {
        store.update(STATUS_CONTROL, id, { pending: Number(ctrl.pending) - 1 });
        return 'not ready';
      }
      return String(store.get(WORKSPACES, id)?.status ?? 'created');
    },
  };

  return { workspaces };
}
