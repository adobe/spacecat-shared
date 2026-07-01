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
 * tag taxonomy (the Categories surface), modelled as a 1-level tree (see serenity-docs#21): a root
 * category (`category:<name>`, no `parent_id`) can own bare-named children (sub-categories /
 * migrated topics) whose `parent_id` is the root's id. The per-project `tags` collection
 * (`tags:{ws}:{pid}`) is scoped so the same category registered across N market projects keeps N
 * independent collections. Materialized into `.counterfact/routes/` by the mock runner; excluded
 * from coverage.
 *
 * - POST (`createProjectTags`): request `TreeNodeListRequest` `{ names, parent_id? }`; persists
 *   each tag idempotently (deterministic `tag-<name>` id, so a repeated create reuses the tag,
 *   matching the live reuse-by-name) — when `parent_id` is present the created tags are stored as
 *   children under it. Returns the live shape — a TOP-LEVEL ARRAY of `TreeNodeResponse`
 *   `[{ id, name, parent_id?, children_count, keyword_count }]` (verified 2026-06-25; overlay CR6
 *   retypes the 201 as an array). NB the tag id is derived from the name ALONE (shared with
 *   `POST /aio/prompts/tagged`, which only knows names), so two same-named children under different
 *   parents collapse to one id — a documented mock limitation while the live prompt→child-tag
 *   reference contract stays unverified (serenity-docs#21 §7-Q1).
 * - GET (`aio-get-project-tags`): returns the project's stored tags as `AIOTagsListResponse`
 *   `{ items, page, total }`, so a 0-prompt category created via POST reads back. The spec marks
 *   `parent_id` + `search` as required query params (request validation 400s a request missing
 *   either, matching live). The mock is tree-aware: `parent_id=''` (empty) returns ROOTS, a
 *   non-empty `parent_id` returns that category's CHILDREN; a non-empty `search` additionally
 *   filters by case-insensitive name substring. Each returned tag carries a DERIVED
 *   `children_count` (stored tags whose `parent_id` is this tag's id) and, for a child, a `path[]`
 *   breadcrumb (a single leaf: its root category); a root's `path` is `[]`.
 * - DELETE (`aio-delete-tags`): removes the body's tag ids (`BatchDeleteRequest` `{ ids }`) from
 *   the standalone tag collection → 204. Prompts that carry a removed tag are a separate
 *   collection and stay intact (the spec's `prompt_id` query param is accepted but not load-bearing
 *   here — the mock's project-tag delete targets the standalone collection, never cascading to
 *   prompts).
 *
 * Known limitations (edges whose LIVE behaviour is NOT yet verified — serenity-docs#21 §7 — so the
 * mock deliberately does not invent a resolution):
 * - DELETE of a parent category does NOT cascade to, or re-parent, its children: a child left
 *   behind keeps a `parent_id` pointing at the removed root, so it drops out of the roots listing
 *   (`parent_id` is truthy) and is only reachable by querying the now-deleted parent's id. Whether
 *   live Semrush cascades, promotes-to-root, or blocks the delete is unconfirmed (§7).
 * - The tag id is derived from the name (`tag-<name>`, see tag-id.js) but PATCH keeps the id stable
 *   on rename, so after a rename the stored id no longer equals `tagId(currentName)`; a later
 *   create or prompt-tag by the NEW name mints a fresh id and thus a duplicate tag. Faithfully
 *   modelling
 *   this needs the live prompt→child-tag reference contract (id vs name), still open (§7-Q1).
 */

/** POST — create (persist, idempotent) project tags → 201 array of TreeNodeResponse. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const names = Array.isArray(body?.names) ? body.names : [];
  // A non-empty `parent_id` makes the created tags children under that category; absent/empty ⇒
  // roots (the created tags carry no `parent_id`) — `context.parentIdField` owns that coercion.
  // `upsertMany` is idempotent by the name-derived id, so re-POSTing an EXISTING name with a
  // different `parent_id` is a no-op on parentage: it returns the already-stored tag (original
  // parent) rather than re-parenting it — re-parenting goes through PATCH, not a repeated POST.
  const parentField = context.parentIdField(body?.parent_id);
  const stored = context.ops.tags.upsertMany(
    scope,
    names.map((name) => context.factories.createAIOTagMock({
      id: context.tagId(name),
      name,
      ...parentField,
    })),
  );
  const tags = stored.map((t) => context.factories.createTagNodeMock({
    id: t.id,
    name: t.name,
    ...context.parentIdField(t.parent_id),
  }));
  return $.response[201].json(tags);
}

/** GET — list the project's stored tags, tree-aware (`parent_id` scope + `search`) → 200 list. */
export function GET($) {
  const { path, query, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const parentId = String(query?.parent_id ?? '');
  const search = String(query?.search ?? '').toLowerCase();
  const stored = context.ops.tags.list(scope);
  const byId = new Map(stored.map((t) => [t.id, t]));
  // Pre-count children per parent in one O(n) pass, so the per-item map below is O(n) overall
  // (not an O(n^2) re-scan of `stored` inside every iteration).
  const childCounts = new Map();
  for (const t of stored) {
    if (t.parent_id) {
      childCounts.set(t.parent_id, (childCounts.get(t.parent_id) ?? 0) + 1);
    }
  }

  // `parent_id=''` ⇒ roots (no parent); a non-empty `parent_id` ⇒ that category's children.
  const scoped = parentId
    ? stored.filter((t) => t.parent_id === parentId)
    : stored.filter((t) => !t.parent_id);
  const matched = search
    ? scoped.filter((t) => String(t.name).toLowerCase().includes(search))
    : scoped;

  const items = matched.map((t) => {
    const parent = t.parent_id ? byId.get(t.parent_id) : undefined;
    return context.factories.createAIOTagMock({
      ...t,
      // Derived, never stored: the live tree carries these on every read.
      children_count: childCounts.get(t.id) ?? 0,
      path: parent
        ? [context.factories.createAIOTagLeafMock({
          id: parent.id, name: parent.name, parent_id: String(parent.parent_id ?? ''),
        })]
        : [],
    });
  });
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
