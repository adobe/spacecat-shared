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
 * Stateful POST handler for /v2/workspaces/{id}/projects/{project_id}/ai_models/benchmarks —
 * batch-creates benchmarks (the consumer's `createBenchmarks`). Request is an ARRAY of
 * `AIOBenchmarkRequest` `{ brand_name, domain, brand_aliases?, color? }`; a created benchmark is
 * always a competitor (`main_brand: false` — the API cannot set the system-managed own brand).
 * Writes to the SAME store key (`benchmarks:{ws}:{pid}`) the v1 list/delete use, so a subsequent
 * list reflects it. Live: 200 `IDsWithStatsResponse` `{ ids, existing_count }` (verified
 * 2026-06-25). Excluded from coverage (materialized handler).
 */

/** POST — batch-create benchmarks (body: array) → 200 { ids, existing_count }. */
export function POST($) {
  const { path, body, context } = $;
  const entries = Array.isArray(body) ? body : [];
  const created = context.ops.benchmarks.createMany(
    { workspaceId: path.id, projectId: path.project_id },
    entries.map((b) => context.factories.createBenchmarkMock({
      brand_name: b?.brand_name ?? '',
      domain: b?.domain ?? '',
      brand_aliases: Array.isArray(b?.brand_aliases) ? b.brand_aliases : [],
      color: b?.color ?? '',
      project_id: path.project_id,
    })),
  );
  return $.response[200].json({ ids: created.map((b) => b.id), existing_count: 0 });
}
