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
 * The Counterfact per-path Context for the Project Engine mock.
 *
 * Counterfact instantiates one Context per route directory and hands it to every handler as
 * `$.context`; a single Context registered at the routes root (via `_.context.js`) is therefore
 * shared by all routes and persists across requests — the statefulness seam. This class wires the
 * pure {@link InMemoryStore} + {@link createStatefulOps} (unit-tested on their own) to a seed
 * selected at startup, and exposes the test-only control surface — `reset()` (`POST /__reset`),
 * `seed()` (`POST /__seed`), and `dump()` (`GET /__dump`) — so an E2E / the cross-repo harness
 * can drive and inspect mock state between cases.
 *
 * Startup seed precedence: an explicit `seedFile` (a JSON {@link Snapshot} path, e.g. one the
 * harness generates from the same fixtures it loads into Postgres so the workspace/project ids
 * line up) wins over a named `seed`, which falls back to the default. `seedFile` is read with
 * `node:fs` at construction.
 *
 * Kept import-resolvable on its own (only relative sibling imports + node builtins) so the runner
 * can materialize it under `.counterfact/routes/_lib/` and re-export it from `_.context.js`.
 */

import { readFileSync } from 'node:fs';
import { InMemoryStore } from './store.js';
import { createStatefulOps } from './stateful.js';
import { SEEDS, DEFAULT_SEED } from './seeds.js';

/**
 * @typedef {import('./store.js').Snapshot} Snapshot
 */

export class Context {
  /**
   * @param {{ seed?: string, seedFile?: string }} [options] `seedFile` (a JSON Snapshot path)
   *   takes precedence; otherwise `seed` selects a named seed set, falling back to the default
   *   when omitted or unknown. The runner passes `process.env.MOCK_SEED` / `MOCK_SEED_FILE`.
   */
  constructor({ seed, seedFile } = {}) {
    this.store = new InMemoryStore();
    if (seedFile) {
      this.seedName = null;
      this.store.load(JSON.parse(readFileSync(seedFile, 'utf8')));
    } else {
      this.seedName = seed && SEEDS[seed] ? seed : DEFAULT_SEED;
      this.store.load(SEEDS[this.seedName]);
    }
    this.ops = createStatefulOps(this.store);
  }

  /**
   * Restores the store to the seed it was loaded with (boot seed, or the last `seed()`).
   * Backs `POST /__reset`.
   * @returns {void}
   */
  reset() {
    this.store.reset();
  }

  /**
   * Replaces the store state with `snapshot` and makes it the new reset baseline, so a later
   * `reset()` returns here. Lets the harness set the world to exactly the state a test needs
   * (typically a shared baseline merged with per-test, namespaced data). Backs `POST /__seed`.
   * @param {Snapshot} snapshot collection-keyed state; see {@link buildSeed} to author one
   * @returns {void}
   */
  seed(snapshot) {
    this.store.load(snapshot);
  }

  /**
   * Returns the CURRENT store state (live mutations, deep-cloned) for inspection. Backs the
   * read-only `GET /__dump` route — the way to "look inside" the mock DB.
   * @returns {Snapshot}
   */
  dump() {
    return this.store.snapshot();
  }
}
