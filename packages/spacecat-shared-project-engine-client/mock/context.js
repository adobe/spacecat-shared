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
 * can drive and inspect mock state between cases. It also wires {@link createQuota} as `quota`
 * (AI-unit metering; allocation set via `POST /__quota`, enforced on project/prompt create +
 * publish — the disguised-405 the live API returns for an over-allocation) and {@link authError}
 * as `authError` (bearer-auth gate; every real route guards on it, the `__*` control routes are
 * exempt — see mock/auth.js).
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
import { createQuota } from './quota.js';
import { authError } from './auth.js';
import { emptyAck } from './responses.js';
import * as factories from './factories.js';
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
    // AI-unit metering over the same store (limits live in the `quota` collection, so they ride
    // along in seed / reset / dump; usage is derived from the projects/prompts collections).
    this.quota = createQuota(this.store);
    // Bearer-auth gate. Stateless, so it is a plain reference to the pure guard; every real route
    // calls `context.authError($.headers)`, the `__*` control routes do not (see mock/auth.js).
    this.authError = authError;
    // Empty-body 2xx ack shape (mock/responses.js). Stateless, so a plain reference to the pure
    // helper. Action-ack handlers (publish, batch-delete, update-benchmark) return
    // `context.emptyAck(202)` so the empty body carries an explicit content type and bypasses
    // Counterfact's response negotiation, which otherwise 406s under `Accept: application/json`.
    // 204 No Content handlers don't need it — Counterfact serves 204 raw (see mock/responses.js).
    this.emptyAck = emptyAck;
    // The typed entity factories (mock/factories.js), exposed so route handlers build every
    // response entity through them (`context.factories.createXMock(...)`) instead of inline
    // literals — the factory is the single, tsc-checked source of truth for each shape, so the
    // handlers can't drift from the spec the way duplicated literals would.
    this.factories = factories;
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
