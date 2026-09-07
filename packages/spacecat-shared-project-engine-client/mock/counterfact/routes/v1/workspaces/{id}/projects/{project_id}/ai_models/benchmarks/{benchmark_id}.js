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
 * Stateful PUT handler for the `…/ai_models/benchmarks/{benchmark_id}` route — updates one
 * benchmark in place (the consumer's `updateBenchmark`, used to re-sync a
 * competitor's `brand_aliases` when the domain is unchanged). Request is `AIOBenchmarkRequest`;
 * the patch lands on the stored benchmark so a subsequent `listBenchmarks` reflects it. Live: 202
 * with an EMPTY body (`content-length: 0` — verified 2026-06-25; the swagger declares no 202
 * schema), so we return no body. Excluded from coverage (materialized handler).
 *
 * `main_brand` is stripped from the patch: it can only be set at CREATE, never via PUT
 * (live-verified — see the v2 create route and `brand-urls.js` `ensureOwnBrandBenchmark` in
 * spacecat-api-service, LLMO-7421). Spreading the whole request body here would let a caller
 * flip a benchmark's own-brand flag in place in the mock while live silently ignores it — the
 * same class of mock/live divergence LLMO-7421 fixed on the create side, inverted (the mock
 * being MORE permissive than live, rather than less).
 */

/** PUT — update a benchmark in place (main_brand ignored, matching live) → 202 Accepted (empty). */
export function PUT($) {
  const { path, body, context } = $;
  const { main_brand: ignoredMainBrand, ...patch } = body ?? {};
  context.ops.benchmarks.update(
    { workspaceId: path.id, projectId: path.project_id },
    path.benchmark_id,
    patch,
  );
  // Empty body (content-length 0) like live. The explicit content type (via emptyAck) bypasses
  // Counterfact's response negotiation, which would otherwise 406 under `Accept: application/json`.
  return context.emptyAck(202);
}
