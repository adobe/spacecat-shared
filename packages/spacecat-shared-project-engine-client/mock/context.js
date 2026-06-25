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

/**
 * The Counterfact per-path Context for the Project Engine mock.
 *
 * Counterfact instantiates one Context per route directory and hands it to every handler as
 * `$.context`; a single Context registered at the routes root (via `_.context.js`) is therefore
 * shared by all routes and persists across requests — the statefulness seam. This class wires the
 * pure {@link InMemoryStore} + {@link createStatefulOps} (unit-tested on their own) to a seed
 * selected at startup, and exposes `reset()` so the test-only `POST /__reset` route can restore
 * the seed between E2E cases.
 *
 * Kept import-resolvable on its own (only relative sibling imports) so the runner can materialize
 * it under `.counterfact/lib/` and re-export it from `.counterfact/routes/_.context.js`.
 */

import { InMemoryStore } from './store.js';
import { createStatefulOps } from './stateful.js';
import { SEEDS, DEFAULT_SEED } from './seeds.js';

export class Context {
  /**
   * @param {{ seed?: string }} [options] selects a named seed set; falls back to the default
   *   when omitted or unknown. The runner passes `process.env.MOCK_SEED`.
   */
  constructor({ seed } = {}) {
    this.seedName = seed && SEEDS[seed] ? seed : DEFAULT_SEED;
    this.store = new InMemoryStore();
    this.store.load(SEEDS[this.seedName]);
    this.ops = createStatefulOps(this.store);
  }

  /**
   * Restores the store to the seed it was loaded with. Backs `POST /__reset`.
   * @returns {void}
   */
  reset() {
    this.store.reset();
  }
}
