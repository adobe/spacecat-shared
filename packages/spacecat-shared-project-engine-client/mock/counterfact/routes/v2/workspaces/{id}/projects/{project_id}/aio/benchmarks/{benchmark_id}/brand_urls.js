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
 * Stateful handlers for
 * /v2/workspaces/{id}/projects/{project_id}/aio/benchmarks/{benchmark_id}/brand_urls — list,
 * batch-create, and batch-delete a benchmark's brand URLs (the consumer's `listBrandUrls` /
 * `createBrandUrls` / `deleteBrandUrls`). Scoped per benchmark (`brand_urls:{ws}:{pid}:{bid}`) so
 * a create is visible to a subsequent list under the same benchmark. Live: list → 200
 * `{ brand_urls: [...] }`; create → 200 `IDsWithStatsResponse` `{ ids, existing_count }`;
 * delete → 202 with an EMPTY body (`content-length: 0` — verified 2026-06-25; the swagger declares
 * no 202 schema). Excluded from coverage (materialized handler).
 */

/** GET — list the benchmark's brand URLs → 200 { brand_urls }. */
export function GET($) {
  const { path, context } = $;
  const brandUrls = context.ops.brand_urls.list(
    { workspaceId: path.id, projectId: path.project_id, benchmarkId: path.benchmark_id },
  );
  return $.response[200].json({ brand_urls: brandUrls });
}

/** POST — batch-create brand URLs (body: array of { url, type }) → 200 { ids, existing_count }. */
export function POST($) {
  const { path, body, context } = $;
  const entries = Array.isArray(body) ? body : [];
  const created = context.ops.brand_urls.createMany(
    { workspaceId: path.id, projectId: path.project_id, benchmarkId: path.benchmark_id },
    entries.map((u) => context.factories.createBrandUrlMock({
      url: u?.url ?? '',
      type: u?.type ?? '',
      benchmark_id: path.benchmark_id,
      project_id: path.project_id,
    })),
  );
  return $.response[200].json({ ids: created.map((u) => u.id), existing_count: 0 });
}

/** DELETE — batch-delete brand URLs by id (body: { ids }) → 202 Accepted (empty body). */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.brand_urls.removeMany(
    { workspaceId: path.id, projectId: path.project_id, benchmarkId: path.benchmark_id },
    body?.ids ?? [],
  );
  // Empty body (content-length 0) like live, not Counterfact's default "Accepted" reason.
  return { status: 202, body: '' };
}
