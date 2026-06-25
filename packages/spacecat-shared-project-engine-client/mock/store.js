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
 * A generic, resource-agnostic in-memory store for the Project Engine mock.
 *
 * Deliberately knows nothing about specific resources — the statefulness spike decides
 * *which* collections need it (see docs/mock-statefulness.md); this primitive is the same
 * regardless of that outcome. Stateful mock handlers plug their resources into it; endpoints
 * that don't need state keep returning the auto-generated schema response.
 *
 * All reads and writes clone, so a loaded seed snapshot is never mutated by store operations
 * and `reset()` always restores a pristine copy.
 */

/**
 * A stored entity. Always has a string `id`; any other fields are resource-specific.
 * @typedef {{ id: string, [key: string]: unknown }} Entity
 */

/**
 * A named seed set: collection name -> entities.
 * @typedef {Record<string, Entity[]>} Snapshot
 */

/**
 * @template T
 * @param {T} value
 * @returns {T} a deep clone, so callers never share references with the store
 */
const clone = (value) => structuredClone(value);

export class InMemoryStore {
  /** @type {Map<string, Map<string, Entity>>} */
  #collections = new Map();

  /** @type {Snapshot | null} */
  #seed = null;

  /**
   * @param {string} name
   * @returns {Map<string, Entity>}
   */
  #collection(name) {
    let col = this.#collections.get(name);
    if (!col) {
      col = new Map();
      this.#collections.set(name, col);
    }
    return col;
  }

  /**
   * @returns {string} a fresh UUID (Node >=22 always provides `crypto.randomUUID`)
   */
  static #generateId() {
    return globalThis.crypto.randomUUID();
  }

  /**
   * @param {Partial<Entity> & Record<string, unknown>} entity
   * @param {string} name
   * @returns {Entity} the stored entity (cloned)
   */
  create(name, entity) {
    const id = entity.id ?? InMemoryStore.#generateId();
    if (entity.id && this.#collection(name).has(entity.id)) {
      throw new Error(`duplicate id ${entity.id} in collection ${name}`);
    }
    /** @type {Entity} */
    const stored = { ...entity, id };
    this.#collection(name).set(id, stored);
    return clone(stored);
  }

  /**
   * @param {string} name
   * @param {string} id
   * @returns {Entity | undefined}
   */
  get(name, id) {
    const entity = this.#collection(name).get(id);
    return entity ? clone(entity) : undefined;
  }

  /**
   * @param {string} name
   * @param {(entity: Entity) => boolean} [predicate]
   * @returns {Entity[]}
   */
  list(name, predicate) {
    const all = [...this.#collection(name).values()].map((e) => clone(e));
    return predicate ? all.filter(predicate) : all;
  }

  /**
   * @param {string} name
   * @param {string} id
   * @param {Record<string, unknown>} patch
   * @returns {Entity | undefined} the updated entity, or undefined if the id is unknown
   */
  update(name, id, patch) {
    const current = this.#collection(name).get(id);
    if (!current) {
      return undefined;
    }
    /** @type {Entity} */
    const next = { ...current, ...patch, id };
    this.#collection(name).set(id, next);
    return clone(next);
  }

  /**
   * @param {string} name
   * @param {string} id
   * @returns {boolean} whether anything was removed
   */
  delete(name, id) {
    return this.#collection(name).delete(id);
  }

  /**
   * Loads a seed set, remembers it as the reset target, and applies it.
   * @param {Snapshot} snapshot
   * @returns {void}
   */
  load(snapshot) {
    this.#seed = clone(snapshot);
    this.#applySeed();
  }

  /**
   * Restores the store to the last-loaded seed (or empty if none was loaded).
   * @returns {void}
   */
  reset() {
    this.#applySeed();
  }

  /**
   * Exports the CURRENT store state (live mutations, not the seed baseline) as a deep-cloned
   * {@link Snapshot}. Backs the test-only `GET /__dump` introspection route. Empty collections
   * are included so callers can see a collection exists but holds nothing.
   * @returns {Snapshot}
   */
  snapshot() {
    /** @type {Snapshot} */
    const out = {};
    for (const [name, col] of this.#collections) {
      out[name] = [...col.values()].map((entity) => clone(entity));
    }
    return out;
  }

  /**
   * @returns {void}
   */
  #applySeed() {
    this.#collections = new Map();
    if (!this.#seed) {
      return;
    }
    for (const [name, items] of Object.entries(this.#seed)) {
      /** @type {Map<string, Entity>} */
      const col = new Map();
      for (const item of items) {
        col.set(item.id, clone(item));
      }
      this.#collections.set(name, col);
    }
  }
}
