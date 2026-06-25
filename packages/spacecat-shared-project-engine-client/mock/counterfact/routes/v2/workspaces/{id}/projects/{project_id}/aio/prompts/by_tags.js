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
 */

/** POST — list prompts, optionally tag-id filtered (OR) → 200 list response. */
export function POST($) {
  const { path, body, context } = $;
  const all = context.ops.prompts.list({ workspaceId: path.id, projectId: path.project_id });
  const tagIds = body?.tag_ids ?? [];
  const items = tagIds.length === 0
    ? all
    : all.filter((p) => (p.tags ?? []).some((t) => tagIds.includes(t.id)));
  return $.response[200].json({
    items, page: body?.page ?? 1, total: items.length, unassigned: 0,
  });
}
