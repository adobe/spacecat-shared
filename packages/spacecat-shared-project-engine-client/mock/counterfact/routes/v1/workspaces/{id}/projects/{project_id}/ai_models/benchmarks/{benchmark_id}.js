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
 * `BasicResponse` (verified 2026-06-25). Excluded from coverage
 * (materialized handler).
 */

/** PUT — update a benchmark in place → 202 Accepted. */
export function PUT($) {
  const { path, body, context } = $;
  context.ops.benchmarks.update(
    { workspaceId: path.id, projectId: path.project_id },
    path.benchmark_id,
    { ...body },
  );
  return $.response[202].json({ message: 'benchmark updated' });
}
