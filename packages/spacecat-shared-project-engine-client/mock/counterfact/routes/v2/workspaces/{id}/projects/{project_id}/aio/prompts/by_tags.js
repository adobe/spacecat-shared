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
 * stored prompts (`AIOPromptWithStatus`: id, name, is_new, tags) — so a list reflects prior
 * `tagged` writes. Materialized into `.counterfact/routes/` by the mock runner; excluded from
 * coverage.
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
  const all = context.ops.prompts.list(scope).filter((p) => draft || !p.is_new);
  const tagIds = body?.tag_ids ?? [];
  const matched = tagIds.length === 0
    ? all
    : all.filter((p) => (p.tags ?? []).some((t) => tagIds.includes(t.id)));

  // A prompt REFERENCES its tags; the tag object is a view, derived here from the project's tag
  // collection through the one shared serializer. Live embeds the full tag — a descendant carries
  // its own `parent_id` + root-first `path`, a root carries neither — and the embedded object is
  // identical to the same tag read from `GET /aio/tags`. Deriving at read (rather than returning
  // whatever was embedded at write time) is also what keeps a re-parent or a rename from leaving a
  // stale breadcrumb behind on a prompt.
  const { byId } = context.buildTagView(context.ops.tags.list(scope), context.factories);
  const items = matched.map((p) => ({
    ...p,
    tags: (p.tags ?? []).map((t) => byId.get(t.id) ?? t),
  }));

  return $.response[200].json({
    items, page: body?.page ?? 1, total: items.length, unassigned: 0,
  });
}
