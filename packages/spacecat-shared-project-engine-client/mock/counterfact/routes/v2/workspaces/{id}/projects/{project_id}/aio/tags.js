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
 * Stateful handlers for /v2/workspaces/{id}/projects/{project_id}/aio/tags — the project-level AIO
 * tag taxonomy (the Categories surface). The per-project `tags` collection (`tags:{ws}:{pid}`) is
 * scoped so the same category registered across N market projects keeps N independent collections.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 *
 * - POST (`createProjectTags`): request `TreeNodeListRequest` `{ names }`; persists each tag
 *   idempotently (deterministic `tag-<name>` id, so a repeated create reuses the stored tag,
 *   matching the live reuse-by-name) and returns the live shape — a TOP-LEVEL ARRAY of
 *   `TreeNodeResponse` `[{ id, name, children_count, keyword_count }]` (verified 2026-06-25;
 *   overlay CR6 retypes the 201 as an array).
 * - GET (`aio-get-project-tags`): returns the project's stored tags as `AIOTagsListResponse`
 *   `{ items, page, total }`, so a 0-prompt category created via POST reads back. The spec marks
 *   `parent_id` + `search` as required query params (request validation 400s a request missing
 *   either, matching live); the mock's tags are a flat per-project collection, so `parent_id` is
 *   accepted but not used to filter, while a non-empty `search` filters by case-insensitive name
 *   substring.
 * - DELETE (`aio-delete-tags`): removes the body's tag ids (`BatchDeleteRequest` `{ ids }`) from
 *   the standalone tag collection → 204. Prompts that carry a removed tag are a separate
 *   collection and stay intact (the spec's `prompt_id` query param is accepted but not load-bearing
 *   here — the mock's project-tag delete targets the standalone collection, never cascading to
 *   prompts).
 */

/** POST — create (persist, idempotent) project tags → 201 array of TreeNodeResponse. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const names = Array.isArray(body?.names) ? body.names : [];
  const stored = context.ops.tags.upsertMany(
    scope,
    names.map((name) => context.factories.createAIOTagMock({ id: context.tagId(name), name })),
  );
  const tags = stored.map((t) => context.factories.createTagNodeMock({ id: t.id, name: t.name }));
  return $.response[201].json(tags);
}

/** GET — list the project's stored tags (optional `search` name filter) → 200 list response. */
export function GET($) {
  const { path, query, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const search = String(query?.search ?? '').toLowerCase();
  const stored = context.ops.tags.list(scope);
  const items = search
    ? stored.filter((t) => String(t.name).toLowerCase().includes(search))
    : stored;
  // `page` arrives as a query string (e.g. "2"); coerce so the response field stays the numeric
  // type AIOTagsListResponse declares, regardless of whether the param was passed.
  return $.response[200].json({ items, page: Number(query?.page ?? 1), total: items.length });
}

/** DELETE — remove standalone project tags by id (prompts are untouched) → 204 No Content. */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.tags.removeMany(
    { workspaceId: path.id, projectId: path.project_id },
    body?.ids ?? [],
  );
  return { status: 204 };
}
