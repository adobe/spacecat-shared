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
 * tag taxonomy (the Categories surface), modelled as a dimension-root tree: each DIMENSION
 * (`category`, `intent`, `source`, `type`) is a bare-named root with no `parent_id`, and every
 * VALUE is a bare-named descendant carrying its parent's id. No tag name contains a `:`; a tag's
 * dimension is `path[0]`. Categories sit at depth 2 and sub-categories at depth 3. The per-project
 * `tags` collection (`tags:{ws}:{pid}`) is scoped so the same taxonomy registered across N market
 * projects keeps N independent collections. Materialized into `.counterfact/routes/` by the mock
 * runner; excluded from coverage.
 *
 * - POST (`createProjectTags`): request `TreeNodeListRequest` `{ names, parent_id? }`; persists
 *   each tag (deterministic opaque `tag-<sha256(parent, name) prefix>` id — see tag-id.js) under
 *   the given `parent_id` (absent/empty ⇒ a root). The endpoint does NOT dedupe: a create of a
 *   name that already exists at the same parent is a same-name/same-parent COLLISION that live
 *   answers with a hard 500 (gate 7, verified 2026-07-02) — resolve-before-create is MANDATORY
 *   discipline, so `ops.tags.upsertMany` rejects such a batch atomically and the handler 500s
 *   (`http_server.BasicResponse`); a clean batch returns the live shape — a TOP-LEVEL ARRAY of
 *   `TreeNodeResponse` `[{ id, name, parent_id?, children_count, keyword_count }]` (verified
 *   2026-06-25; overlay CR6 retypes the 201 as an array). Because the id is keyed on
 *   `(parent, name)`, two same-named children under DIFFERENT parents are two distinct tags — as
 *   live, and as the dimension-root model requires (a sub-category `human` and the source value
 *   `human` must coexist).
 * - GET (`aio-get-project-tags`): returns the project's stored tags as `AIOTagsListResponse`
 *   `{ items, page, total }`, so a 0-prompt tag created via POST reads back. The spec marks
 *   `parent_id` + `search` as required query params (request validation 400s a request missing
 *   either, matching live). The mock is tree-aware: `parent_id=''` (empty) returns ROOTS, a
 *   non-empty `parent_id` returns that tag's CHILDREN; a non-empty `search` additionally filters by
 *   case-insensitive name substring WITHIN that one level and never descends (verified live) — so a
 *   nested tag is unfindable from the root level, exactly as on the real API. Each returned tag
 *   carries a DERIVED `children_count` (stored tags whose `parent_id` is this tag's id) and a
 *   root-first `path[]` ancestry breadcrumb excluding itself (a depth-2 tag: one leaf, its
 *   dimension root; a depth-3 tag: two leaves); a root's `parent_id` and `path` are `null`.
 * - DELETE (`aio-delete-tags`): removes the body's tag ids (`BatchDeleteRequest` `{ ids }`) from
 *   the standalone tag collection AND detaches each id from every prompt carrying it → 204. A
 *   prompt whose only tag was deleted becomes fully unassigned (gate 4, verified 2026-07-02); it is
 *   not orphaned, and it stops matching `by_tags` on the removed id. The prompts themselves are
 *   never deleted. (The spec's `prompt_id` query param is accepted but not load-bearing here.)
 *
 * There is no depth cap on the wire: a live probe (2026-07-01, prod) confirmed Semrush accepts a
 * grandchild and a great-grandchild, returning 201 at each level with `parent_id` set at create
 * time. The mock likewise does not cap depth.
 *
 * Known limitations (edges whose LIVE behaviour is NOT yet verified, so the mock deliberately does
 * not invent a resolution):
 * - DELETE of a parent does NOT cascade to, or re-parent, its children: a child left behind keeps a
 *   `parent_id` pointing at the removed tag, so it drops out of the roots listing (`parent_id` is
 *   truthy) and is only reachable by querying the now-deleted parent's id. Whether live Semrush
 *   cascades, promotes-to-root, or blocks the delete is unconfirmed.
 * - The tag id is derived from `(parent, name)` but PATCH keeps the id stable across a rename or a
 *   re-parent, so afterwards the stored id no longer equals `tagId(name, parent_id)`. Re-creating
 *   the tag's original `(parent, name)` therefore collides in the mock where live would mint a
 *   fresh opaque id — see `ops.tags.upsertMany`, which fails loudly rather than adopting the moved
 *   tag.
 */

/** POST — create project tags → 201 array of TreeNodeResponse; 500 on same-name/same-parent. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const names = Array.isArray(body?.names) ? body.names : [];
  // A non-empty `parent_id` makes the created tags children under that category; absent/empty ⇒
  // roots (the created tags carry no `parent_id`) — `context.parentIdField` owns that coercion.
  const parentField = context.parentIdField(body?.parent_id);
  const { tags: stored, collision } = context.ops.tags.upsertMany(
    scope,
    names.map((name) => context.factories.createAIOTagMock({
      id: context.tagId(name, parentField.parent_id),
      name,
      ...parentField,
    })),
  );
  if (collision) {
    // Gate 7 (verified live 2026-07-02): creating a tag whose name already exists at the same
    // parent level 500s — the endpoint does NOT dedupe, so resolve-before-create is the consumer's
    // job. The batch is atomic (nothing written), matching live. 500 is declared (BasicResponse).
    return $.response[500].json(context.factories.createBasicResponseMock({
      message: 'tag already exists at this level',
    }));
  }
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

  // The full ancestry breadcrumb, ROOT-FIRST, excluding the tag itself — the shape live returns at
  // every depth (verified 2026-07-09 against prod: a depth-3 node reads back with a two-leaf path).
  // Consumers key a tag's DIMENSION off `path[0]`, so a breadcrumb truncated to the direct parent
  // would resolve a sub-category's dimension to its category. Each leaf beyond the root carries its
  // own `parent_id`; the root leaf carries none.
  const ancestryOf = (tag) => {
    const leaves = [];
    const guard = new Set([tag.id]);
    let cursor = tag.parent_id ? byId.get(tag.parent_id) : undefined;
    while (cursor && !guard.has(cursor.id)) {
      guard.add(cursor.id);
      leaves.unshift(context.factories.createAIOTagLeafMock({
        id: cursor.id,
        name: cursor.name,
        ...context.parentIdField(cursor.parent_id),
      }));
      cursor = cursor.parent_id ? byId.get(cursor.parent_id) : undefined;
    }
    return leaves.length > 0 ? leaves : null;
  };

  const items = matched.map((t) => context.factories.createAIOTagMock({
    ...t,
    // Derived, never stored: the live tree carries these on every read. Live returns `null` (not an
    // omitted field / an empty array) for a root's parent_id + path (CR13 makes both nullable).
    children_count: childCounts.get(t.id) ?? 0,
    parent_id: t.parent_id || null,
    path: ancestryOf(t),
  }));
  // `page` arrives as a query string (e.g. "2"); coerce so the response field stays the numeric
  // type AIOTagsListResponse declares, regardless of whether the param was passed.
  return $.response[200].json({ items, page: Number(query?.page ?? 1), total: items.length });
}

/** DELETE — remove standalone project tags by id, detaching them from prompts → 204 No Content. */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.tags.removeMany(
    { workspaceId: path.id, projectId: path.project_id },
    body?.ids ?? [],
  );
  return { status: 204 };
}
