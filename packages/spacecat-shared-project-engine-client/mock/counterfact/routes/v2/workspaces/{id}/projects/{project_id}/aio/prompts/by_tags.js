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
 * Stateful handler for POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags
 * (`aio-list-prompts-by-tag-ids`) — the list/read path the real consumer calls
 * (spacecat-api-service `listPromptsByTags`). Request is `AIOPromptsListRequest`; an empty
 * `tag_ids` lists every prompt, otherwise prompts carrying any of the supplied tag ids match
 * (Semrush OR semantics). Returns 200 `AIOPromptsWithStatusListResponse` whose `items` are the
 * stored prompts (`AIOPromptWithStatus`: id, name, is_new, tags, metadata) — so a list reflects
 * prior `tagged`/v3-create writes AND their authorship metadata. Materialized into
 * `.counterfact/routes/` by the mock runner; excluded from coverage.
 *
 * LLMO-6288 WP2 rework: the delivered swagger carries `metadata` inline on THIS existing list —
 * there is no separate `by_tags/with-metadata` endpoint (the mock previously invented one against
 * the pre-delivery ADR guess; it is dropped). `metadata` is echoed verbatim from the stored prompt
 * (`undefined` when never written or fully wiped — `JSON.stringify` drops the key, matching the
 * optional schema field; present as an object once the v3 create/patch family stamps it).
 *
 * The `include_metadata` query param (declared in the vendored swagger for this operation:
 * "Include prompt metadata into response") GATES that inline metadata: the DEFAULT (absent, or any
 * value other than the literal string `true`) omits `metadata` from every item, and
 * `?include_metadata=true` includes it — so a consumer that never opts in sees the pre-metadata
 * payload shape, and the mock does not silently mask a missing-flag code path (MysticatBot review,
 * LLMO-6288 rework).
 *
 * Fidelity fixes (Rainer review — pre-existing on main, corrected here since this PR already
 * touches this handler): the response `unassigned` is the REAL count of untagged prompts in the
 * current view (was hardcoded 0), NOT narrowed by `search`; the request-body `search` is honored
 * as a case-insensitive prompt-name filter on the returned items (was ignored); and an untagged
 * prompt OMITS the `tags` key entirely rather than emitting `[]` — matching prod, and spec-valid
 * now that overlay CR5 no longer marks `tags` required on `AIOPromptWithStatus`.
 *
 * Draft/publish gating (live-verified 2026-07-02, serenity-docs#24 §3.1 gate 2 + gate 6): both
 * prompt-create endpoints (`tagged.js`, id-based `aio/prompts.js`) stamp a fresh prompt
 * `is_new: true`. The `draft` query param (already declared in the vendored swagger for this
 * operation — no overlay correction needed) selects the view: the DEFAULT (no `draft`, or any
 * value other than the literal string `true`) is PUBLISHED-ONLY and excludes `is_new: true`
 * prompts entirely; `?draft=true` returns every stored prompt regardless of publish state,
 * matching live's always-visible draft tree. `publish.js` flips `is_new` back to `false` for
 * every prompt in the project on a successful publish, which is what moves a prompt from
 * draft-only into this endpoint's default (published) view.
 */

/** POST — list prompts, optionally tag-id filtered (OR), gated by draft/publish state → 200. */
export function POST($) {
  const {
    path, query, body, context,
  } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const draft = String(query?.draft ?? '') === 'true';
  const includeMetadata = String(query?.include_metadata ?? '') === 'true';
  const search = String(body?.search ?? '').trim().toLowerCase();
  const all = context.ops.prompts.list(scope).filter((p) => draft || !p.is_new);
  const tagIds = body?.tag_ids ?? [];
  const byTag = tagIds.length === 0
    ? all
    : all.filter((p) => (p.tags ?? []).some((t) => tagIds.includes(t.id)));
  // Prod filters the returned items on `search` (a case-insensitive prompt-name match); the mock
  // previously IGNORED the field (Rainer review, pre-existing). An empty/absent search matches all.
  const matched = search === ''
    ? byTag
    : byTag.filter((p) => String(p.name ?? '').toLowerCase().includes(search));

  // A prompt REFERENCES its tags; the tag object is a view, derived here from the project's tag
  // collection through the one shared serializer. Live embeds the full tag — a descendant carries
  // its own `parent_id` + root-first `path`, a root carries neither — and the embedded object is
  // identical to the same tag read from `GET /aio/tags`. Deriving at read (rather than returning
  // whatever was embedded at write time) is also what keeps a re-parent or a rename from leaving a
  // stale breadcrumb behind on a prompt.
  //
  // Every id a prompt references resolves: the two create paths both register their tags — the
  // id-based `aio/prompts.js` rejects an unresolvable id outright, and `tagged.js` mints a root for
  // an unknown name — and `DELETE /aio/tags` detaches a removed tag from its prompts. The `?? t`
  // guard is what a store hand-seeded with a prompt referencing an unregistered tag would fall back
  // to: the raw `{ id, name }` stub, missing `children_count`, `prompts_count` and `path`. That
  // degraded shape is not what live returns, so seed prompts only with tags the seed registers too.
  const { byId } = context.buildTagView(context.ops.tags.list(scope), context.factories);
  // `metadata` is pulled out of the spread so it is only re-attached when `include_metadata=true`;
  // when omitted the item carries no `metadata` key at all (not `undefined`), matching the flag-off
  // payload shape. Every other stored field flows through `...rest` unchanged.
  const items = matched.map((p) => {
    const { metadata, tags: stored, ...rest } = p;
    const tags = (Array.isArray(stored) ? stored : []).map((t) => byId.get(t.id) ?? t);
    // Prod OMITS `tags` entirely on an untagged prompt rather than emitting `[]` (Rainer review,
    // pre-existing). Overlay CR5 no longer marks `tags` required, so the omitted key stays
    // spec-valid under Counterfact response validation.
    const item = tags.length > 0 ? { ...rest, tags } : { ...rest };
    if (includeMetadata && metadata !== undefined) {
      item.metadata = metadata;
    }
    return item;
  });

  // `unassigned` is the real count of prompts in this (draft/publish-filtered) view that carry no
  // tags — prod returns it; the mock previously hardcoded 0 (Rainer review, pre-existing). It is
  // NOT narrowed by `search` (prod probe: total 2, unassigned 3 on a filtered read) nor by the
  // tag_ids filter (an untagged prompt matches no tag id).
  const unassigned = all.filter((p) => !(Array.isArray(p.tags) && p.tags.length > 0)).length;

  return $.response[200].json({
    items, page: body?.page ?? 1, total: items.length, unassigned,
  });
}
