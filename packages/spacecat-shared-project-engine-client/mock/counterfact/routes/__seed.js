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

/* eslint-disable no-unused-vars -- Counterfact passes a single `$` context object to handlers. */

/**
 * Test-only control route: replaces the shared store with the posted Snapshot and makes it the
 * new reset baseline, so the harness can set the mock to exactly the state a test needs (use
 * `buildSeed()` from the package to author the body, mirroring DB fixtures). Not part of the
 * Project Engine API; materialized into `.counterfact/routes/` by the mock runner and excluded
 * from coverage.
 */

/** POST /__seed — load an arbitrary collection-keyed Snapshot as the new baseline. */
export function POST($) {
  $.context.seed($.body ?? {});
  return { status: 200, body: { message: 'seeded' }, contentType: 'application/json' };
}
