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
 * `{ aio_benchmarks: [...] }`, each item carrying `project_id` + `primary_url`/`root_domain`
 * (overlay CR10, verified live 2026-06-25); delete → 202 with an EMPTY body (`content-length: 0`
 * — verified 2026-06-25; the swagger declares no 202 schema). Excluded from coverage (handler).
 */

/** GET — list the project's benchmarks → 200 { aio_benchmarks }. */
export function GET($) {
  const { path, context } = $;
  const stored = context.ops.benchmarks.list(
    { workspaceId: path.id, projectId: path.project_id },
  );
  // Live returns primary_url/root_domain mirroring the benchmark's CURRENT domain, plus
  // project_id = the path project. The create handler is the write-time source; here we re-derive
  // both off the row's domain at read time, dropping any stored value so a stale one (e.g. left by
  // a PUT that changed the domain, or a pre-CR10 row) can't leak, then stamp project_id. The
  // factory recomputes the two URL fields from the (preserved) domain.
  const aioBenchmarks = stored.map((b) => {
    const row = { ...b };
    delete row.primary_url;
    delete row.root_domain;
    return context.factories.createBenchmarkMock({ ...row, project_id: path.project_id });
  });
  return $.response[200].json({ aio_benchmarks: aioBenchmarks });
}

/** DELETE — batch-delete benchmarks by id (body: { ids }) → 202 Accepted (empty body). */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.benchmarks.removeMany(
    { workspaceId: path.id, projectId: path.project_id },
    body?.ids ?? [],
  );
  // Empty body (content-length 0) like live. The explicit content type (via emptyAck) bypasses
  // Counterfact's response negotiation, which would otherwise 406 under `Accept: application/json`.
  return context.emptyAck(202);
}
