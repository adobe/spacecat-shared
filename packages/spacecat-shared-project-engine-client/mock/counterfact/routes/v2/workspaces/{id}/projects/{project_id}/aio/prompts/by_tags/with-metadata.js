/*
 * Copyright 2026 Adobe. All rights reserved.
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
 * Stateful handler for POST
 * /v2/workspaces/{id}/projects/{project_id}/aio/prompts/by_tags/with-metadata — the metadata-aware
 * READ that lets a consumer verify what the `PUT`/`PATCH .../aio/prompts/metadata` writes stored
 * (ADR `aio-list-prompts-with-metadata-by-tag-ids`, serenity-docs#35). It mirrors the plain
 * `by_tags.js` list — same bearer guard, same draft/publish gating, same single tag-view serializer
 * — but also surfaces each prompt's OPAQUE `metadata` (null when unset), which the spec-validated
 * `by_tags` response can't carry.
 *
 * MOCK-OWNED, not in the vendored swagger: it returns a raw `{ status, body, contentType }` literal
 * that bypasses Counterfact's response validation (the same mechanism `auth`/`quota` use), so the
 * extra `metadata` field passes through untouched. The payload shape stays soft until Semrush's WP0
 * ships and WP2 re-vendors the refreshed swagger. Materialized into `.counterfact/routes/` by the
 * mock runner; excluded from coverage.
 */

/** POST — list prompts with their opaque metadata, tag-id filtered (OR) + draft-gated → 200. */
export function POST($) {
  const {
    path, query, body, context,
  } = $;
  const denied = context.authError($.headers);
  if (denied) {
    return denied;
  }
  const scope = { workspaceId: path.id, projectId: path.project_id };
  // The draft-gating + tag-id filter + tag-view serialize below deliberately MIRROR by_tags.js
  // (the metadata-blind list), kept in step by hand rather than shared: by_tags.js returns through
  // Counterfact's spec-validated envelope, which can't carry `metadata`, so this route can't call
  // it. Any change to the read/gating contract in by_tags.js must be mirrored here.
  const draft = String(query?.draft ?? '') === 'true';
  const all = context.ops.prompts.list(scope).filter((p) => draft || !p.is_new);
  const tagIds = body?.tag_ids ?? [];
  const matched = tagIds.length === 0
    ? all
    : all.filter((p) => (p.tags ?? []).some((t) => tagIds.includes(t.id)));

  // Same single tag serializer the plain by_tags read uses, so an embedded tag is byte-identical
  // to the same tag from GET /aio/tags. `metadata` is echoed verbatim (null when never written).
  const { byId } = context.buildTagView(context.ops.tags.list(scope), context.factories);
  const items = matched.map((p) => ({
    ...p,
    tags: (p.tags ?? []).map((t) => byId.get(t.id) ?? t),
    metadata: p.metadata ?? null,
  }));

  return {
    status: 200,
    contentType: 'application/json',
    body: {
      items, page: body?.page ?? 1, total: items.length, unassigned: 0,
    },
  };
}
