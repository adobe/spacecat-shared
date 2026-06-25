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
 * The confirmed consumer inventory (see docs/mock-statefulness.md) makes five resource groups
 * write-then-read: **projects** (per workspace), **ai_models** / **prompts** / **benchmarks** (per
 * project), and **brand_urls** (per benchmark) — see {@link STATEFUL_RESOURCES}. This module
 * encodes that set as pure operations over an {@link InMemoryStore} —
 * collection-key scoping plus the CRUD each group needs — with no Counterfact / HTTP coupling,
 * so it is unit-testable on its own. The Counterfact runner adapts these into per-path handlers
 * (mapping store results into spec-valid response envelopes); non-stateful operations are left
 * on Counterfact's auto-generated response.
 */

/**
 * @typedef {import('./store.js').InMemoryStore} InMemoryStore
 * @typedef {import('./store.js').Entity} Entity
 */

/**
 * Resource groups the live audit confirmed the consumer
 * write-then-reads: projects, ai_models, prompts, plus benchmarks (per project) and brand_urls
 * (per benchmark) — the competitor-benchmark and brand-URL sync flows create→list→update→delete,
 * so they need real state to be faithfully testable.
 */
export const STATEFUL_RESOURCES = Object.freeze([
  'projects', 'ai_models', 'prompts', 'benchmarks', 'brand_urls',
]);

/**
 * Builds the store collection key for a resource, scoped so two workspaces (or projects, or
 * benchmarks) never share state. `projects` are scoped per workspace; `ai_models`, `prompts`,
 * and `benchmarks` per project; `brand_urls` per benchmark (within a project).
 * @param {'projects' | 'ai_models' | 'prompts' | 'benchmarks' | 'brand_urls'} resource
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
