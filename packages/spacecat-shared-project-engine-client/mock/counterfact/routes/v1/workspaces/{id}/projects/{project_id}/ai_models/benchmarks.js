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
 * Stateful handlers for /v1/workspaces/{id}/projects/{project_id}/ai_models/benchmarks — list
 * and batch-delete the project's AIO benchmarks (the consumer's `listBenchmarks` /
 * `deleteBenchmarks`). Benchmarks are created via the v2 sibling and updated via the
 * `…/benchmarks/{benchmark_id}` route; all three share the version-agnostic store key
 * (`benchmarks:{ws}:{pid}`), so a create/update is visible to this list. Live: list → 200
 * `{ aio_benchmarks: [...] }`; delete → 202 `BasicResponse` (verified 2026-06-25). Excluded from
 * coverage (materialized handler).
 */

/** GET — list the project's benchmarks → 200 { aio_benchmarks }. */
export function GET($) {
  const { path, context } = $;
  const aioBenchmarks = context.ops.benchmarks.list(
    { workspaceId: path.id, projectId: path.project_id },
  );
  return $.response[200].json({ aio_benchmarks: aioBenchmarks });
}

/** DELETE — batch-delete benchmarks by id (body: { ids }) → 202 Accepted. */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.benchmarks.removeMany(
    { workspaceId: path.id, projectId: path.project_id },
    body?.ids ?? [],
  );
  return $.response[202].json({ message: 'benchmarks deleted' });
}
