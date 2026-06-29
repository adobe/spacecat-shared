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
 * 2026-06-25). Unlike prompts (which dedup into `existing_count`), a benchmark whose brand name,
 * alias, or domain collides with an existing one is a HARD **409** conflict
 * `{ message: 'ai benchmark conflict: duplicate brand name or alias' }` (verified live 2026-06-29);
 * the whole batch is rejected, nothing is created. Excluded from coverage (materialized handler).
 */

/** Case-insensitive identity tokens (brand name + aliases + domain) a benchmark conflicts on. */
const identityTokens = (b) => [b?.brand_name, b?.domain, ...(b?.brand_aliases ?? [])]
  .filter((t) => typeof t === 'string' && t.length > 0)
  .map((t) => t.toLowerCase());

/** POST — batch-create benchmarks (body: array) → 200 { ids, existing_count }; 409 on conflict. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const entries = Array.isArray(body) ? body : [];

  // Reject if any incoming benchmark collides (brand name / alias / domain, case-insensitive) with
  // one already in the project — the live hard-409, not a silent duplicate (#1745 second sweep).
  const taken = new Set(context.ops.benchmarks.list(scope).flatMap(identityTokens));
  const conflicts = entries.some((b) => identityTokens(b).some((t) => taken.has(t)));
  if (conflicts) {
    return {
      status: 409,
      body: context.factories.createBasicResponseMock({
        message: 'ai benchmark conflict: duplicate brand name or alias',
      }),
      contentType: 'application/json',
    };
  }

  const created = context.ops.benchmarks.createMany(
    scope,
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
