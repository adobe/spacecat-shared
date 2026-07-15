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
 * The stateful slice of the Project Engine mock.
 *
 * The confirmed consumer inventory (see docs/mock-statefulness.md) makes six resource groups
 * write-then-read: **projects** (per workspace), **ai_models** / **prompts** / **benchmarks** /
 * **tags** (per project), and **brand_urls** (per benchmark) — see {@link STATEFUL_RESOURCES}.
 * This module
 * encodes that set as pure operations over an {@link InMemoryStore} —
 * collection-key scoping plus the CRUD each group needs — with no Counterfact / HTTP coupling,
 * so it is unit-testable on its own. The Counterfact runner adapts these into per-path handlers
 * (mapping store results into spec-valid response envelopes); non-stateful operations (catalogs,
 * echo reads, the publish/202 acks) are thin hand-authored handlers too. The runner serves NO
 * auto-stubs (`--serve`, no `generate` — see run.js), so an unmodelled path 404s; nothing falls
 * back to a generated random response.
 */

/**
 * @typedef {import('./store.js').InMemoryStore} InMemoryStore
 * @typedef {import('./store.js').Entity} Entity
 */

/**
 * Resource groups the live audit confirmed the consumer
 * write-then-reads: projects, ai_models, prompts, plus benchmarks (per project) and brand_urls
 * (per benchmark) — the competitor-benchmark and brand-URL sync flows create→list→update→delete,
 * so they need real state to be faithfully testable. `tags` are the project-level AIO taxonomy
 * (the Categories surface): the consumer creates standalone tags per market project — a bare-named
 * category under the `category` dimension root — and must read them back even before any prompt
 * carries them, so they need real state too.
 */
export const STATEFUL_RESOURCES = Object.freeze([
  'projects', 'ai_models', 'prompts', 'benchmarks', 'tags', 'brand_urls',
]);

/**
 * Builds the store collection key for a resource, scoped so two workspaces (or projects, or
 * benchmarks) never share state. `projects` are scoped per workspace; `ai_models`, `prompts`,
 * `benchmarks`, and `tags` per project; `brand_urls` per benchmark (within a project).
 * @param {'projects' | 'ai_models' | 'prompts' | 'benchmarks' | 'tags' | 'brand_urls'} resource
 * @param {{ workspaceId?: string | number, projectId?: string | number,
 *   benchmarkId?: string | number }} scope
 * @returns {string}
 */
export function collectionKey(resource, scope = {}) {
  const { workspaceId, projectId, benchmarkId } = scope;
  if (resource === 'projects') {
    return `projects:${workspaceId}`;
  }
  if (resource === 'brand_urls') {
    return `brand_urls:${workspaceId}:${projectId}:${benchmarkId}`;
  }
  return `${resource}:${workspaceId}:${projectId}`;
}

/**
 * The stateful operations, grouped by resource. Each operates on the store and returns stored
 * entities / lists / booleans — never HTTP envelopes — so the Counterfact adapter owns response
 * shaping. Pure and synchronous; the store clones on every read/write.
 * @param {InMemoryStore} store
 */
export function createStatefulOps(store) {
  return {
    projects: {
      /**
       * @param {{ workspaceId: string | number }} scope
       * @param {Partial<Entity> & Record<string, unknown>} body
       * @returns {Entity}
       */
      create(scope, body) {
        return store.create(collectionKey('projects', scope), body);
      },
      /**
       * @param {{ workspaceId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('projects', scope));
      },
      /**
       * @param {{ workspaceId: string | number }} scope
       * @param {string} id
       * @returns {Entity | undefined}
       */
      get(scope, id) {
        return store.get(collectionKey('projects', scope), id);
      },
      /**
       * Partially updates a project, returning the updated entity or undefined if unknown.
       * @param {{ workspaceId: string | number }} scope
       * @param {string} id
       * @param {Record<string, unknown>} patch
       * @returns {Entity | undefined}
       */
      update(scope, id, patch) {
        return store.update(collectionKey('projects', scope), id, patch);
      },
      /**
       * @param {{ workspaceId: string | number }} scope
       * @param {string} id
       * @returns {boolean}
       */
      remove(scope, id) {
        return store.delete(collectionKey('projects', scope), id);
      },
    },

    ai_models: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('ai_models', scope));
      },
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Partial<Entity> & Record<string, unknown>} body
       * @returns {Entity}
       */
      add(scope, body) {
        return store.create(collectionKey('ai_models', scope), body);
      },
      /**
       * Deletes the given model ids, reporting how many were actually removed.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('ai_models', scope);
        return ids.reduce((removed, id) => (store.delete(key, id) ? removed + 1 : removed), 0);
      },
    },

    prompts: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {(entity: Entity) => boolean} [predicate]
       * @returns {Entity[]}
       */
      list(scope, predicate) {
        return store.list(collectionKey('prompts', scope), predicate);
      },
      /**
       * Creates one entity per supplied prompt, returning all created entities.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<Partial<Entity> & Record<string, unknown>>} prompts
       * @returns {Entity[]}
       */
      createMany(scope, prompts) {
        const key = collectionKey('prompts', scope);
        return prompts.map((prompt) => store.create(key, prompt));
      },
      /**
       * Partially updates one stored prompt in place (the id-based `PUT /aio/prompts/tags` tag-set
       * write), returning the updated entity or undefined if the id is unknown. Live silently skips
       * an unknown prompt id, so the handler treats an `undefined` return as a no-op.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {string} id
       * @param {Record<string, unknown>} patch
       * @returns {Entity | undefined}
       */
      update(scope, id, patch) {
        return store.update(collectionKey('prompts', scope), id, patch);
      },
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('prompts', scope);
        return ids.reduce((removed, id) => (store.delete(key, id) ? removed + 1 : removed), 0);
      },
    },

    benchmarks: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('benchmarks', scope));
      },
      /**
       * Creates one benchmark per supplied entry, returning all created entities (so the caller
       * can surface their ids). The own/main-brand benchmark is system-managed, so created
       * benchmarks are always competitor (`main_brand: false`) — matching the live create API.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<Partial<Entity> & Record<string, unknown>>} benchmarks
       * @returns {Entity[]}
       */
      createMany(scope, benchmarks) {
        const key = collectionKey('benchmarks', scope);
        return benchmarks.map((b) => store.create(key, b));
      },
      /**
       * Updates one benchmark in place, returning the updated entity or undefined if unknown.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {string} id
       * @param {Record<string, unknown>} patch
       * @returns {Entity | undefined}
       */
      update(scope, id, patch) {
        return store.update(collectionKey('benchmarks', scope), id, patch);
      },
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('benchmarks', scope);
        return ids.reduce((removed, id) => (store.delete(key, id) ? removed + 1 : removed), 0);
      },
    },

    tags: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('tags', scope));
      },
      /**
       * Resolve-before-create for a batch of project tags — the discipline live REQUIRES of every
       * consumer (gate 7, verified 2026-07-02): the `POST /aio/tags` endpoint does NOT dedupe, so
       * creating a tag whose NAME already exists at the same parent is a same-name/same-parent
       * COLLISION that live answers with a hard 500. This models it: it resolves each requested tag
       * (by its deterministic id) against the stored collection and, if any id is already taken —
       * or repeats within the batch — the batch is rejected ATOMICALLY (`collision: true`, nothing
       * written) so the caller can 500. On no collision every tag is persisted.
       *
       * The id is derived from the tag's `(parent, name)` pair (see tag-id.js), so an id clash IS a
       * same-name/same-parent clash: the same name under a DIFFERENT parent derives a different id
       * and is created normally, which is what live does and what the dimension-root model needs
       * (two sub-categories may share a bare name under different categories).
       *
       * One deliberate, LOUD divergence: `PATCH` keeps a tag's id stable across a rename or a
       * re-parent, after which the stored id no longer equals `tagId(name, parent)`. Re-creating
       * the tag's ORIGINAL `(parent, name)` then derives an id already occupied by the moved tag,
       * and this reports a collision where live would mint a fresh opaque id and return 201.
       * The mock cannot represent two tags at one derived id; failing loudly beats silently handing
       * the caller back a tag that now lives somewhere else in the tree.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<Entity>} tags each carrying its deterministic `id` (+ optional `parent_id`)
       * @returns {{ tags: Entity[], collision: boolean }} `collision: true` ⇒ nothing was written
       */
      upsertMany(scope, tags) {
        const key = collectionKey('tags', scope);
        // Atomic pre-check: an id already in the store, or repeated inside this batch, is a
        // collision. Checked before any write, so a collision leaves the store untouched.
        const seen = new Set();
        for (const tag of tags) {
          if (seen.has(tag.id) || store.get(key, tag.id)) {
            return { tags: [], collision: true };
          }
          seen.add(tag.id);
        }
        const stored = tags.map((tag) => store.create(key, tag));
        return { tags: stored, collision: false };
      },
      /**
       * Re-parents / renames one tag in place (the `PATCH /aio/tags/{tag_id}` — `aio-update-tag`
       * surface), returning the updated entity or undefined if the id is unknown. The id stays
       * stable (Semrush tag ids are opaque; only `name`/`parent_id` change). Promoting a child to a
       * root is expressed by patching `parent_id` to `''` (the read path treats a falsy `parent_id`
       * as a root); `children_count`/`path` are never stored, so they are not part of the patch.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {string} id
       * @param {Record<string, unknown>} patch
       * @returns {Entity | undefined}
       */
      update(scope, id, patch) {
        return store.update(collectionKey('tags', scope), id, patch);
      },
      /**
       * Removes the given tag ids from the project's tag collection, reporting how many standalone
       * tags were actually removed, and DETACHES each removed id from every prompt that carries it.
       *
       * The detach is not a courtesy — it is the live contract (gate 4, verified 2026-07-02):
       * deleting a tag detaches it from every carrying prompt, and a prompt whose only tag was
       * deleted becomes fully unassigned rather than orphaned or silently still matchable through
       * `by_tags`. A mock that left the tag embedded on the prompt would keep answering `by_tags`
       * queries for an id that no longer exists, hiding exactly the class of bug consumers must
       * handle.
       *
       * The returned count reports the STANDALONE tags removed, not prompts touched: an id that
       * names no stored tag still detaches from any prompt carrying it, and does not count.
       * @param {{ workspaceId: string | number, projectId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('tags', scope);
        const removed = ids.reduce((n, id) => (store.delete(key, id) ? n + 1 : n), 0);

        const doomed = new Set(ids.map((id) => String(id)));
        const promptsKey = collectionKey('prompts', scope);
        for (const prompt of store.list(promptsKey)) {
          const tags = Array.isArray(prompt.tags) ? prompt.tags : [];
          const kept = tags.filter((t) => !doomed.has(String(t?.id)));
          if (kept.length !== tags.length) {
            store.update(promptsKey, prompt.id, { tags: kept });
          }
        }
        return removed;
      },
    },

    brand_urls: {
      /**
       * @param {{ workspaceId: string | number, projectId: string | number,
       *   benchmarkId: string | number }} scope
       * @returns {Entity[]}
       */
      list(scope) {
        return store.list(collectionKey('brand_urls', scope));
      },
      /**
       * Creates one brand URL per supplied entry, returning all created entities.
       * @param {{ workspaceId: string | number, projectId: string | number,
       *   benchmarkId: string | number }} scope
       * @param {Array<Partial<Entity> & Record<string, unknown>>} urls
       * @returns {Entity[]}
       */
      createMany(scope, urls) {
        const key = collectionKey('brand_urls', scope);
        return urls.map((u) => store.create(key, u));
      },
      /**
       * @param {{ workspaceId: string | number, projectId: string | number,
       *   benchmarkId: string | number }} scope
       * @param {Array<string>} ids
       * @returns {number}
       */
      removeMany(scope, ids) {
        const key = collectionKey('brand_urls', scope);
        return ids.reduce((removed, id) => (store.delete(key, id) ? removed + 1 : removed), 0);
      },
    },
  };
}
