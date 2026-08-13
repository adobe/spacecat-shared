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
 * Stateful handler for PUT /v2/workspaces/{id}/projects/{project_id}/aio/prompts/tags
 * (`aio-update-prompts-batch`) — the id-based batch update of a prompt's tag references the
 * nested-category migration uses. Materialized into `.counterfact/routes/` by the mock runner;
 * excluded from coverage.
 *
 * PUT contract (live-verified 2026-07-02, serenity-docs#24): body
 * `{ items: [{ id, references: [tagId…], replace }…] }` (id = existing prompt id, references = tag
 * ids). Per item:
 * - `replace: false` → MERGE: `references` are added to the prompt's existing tag set (kept ones
 *   stay); dedupe by tag id.
 * - `replace: true` → FULL REPLACE: the prompt's tag set becomes EXACTLY `references`.
 * - an unknown prompt `id` is skipped SILENTLY — live does not signal "prompt not found"; the call
 *   still returns 204 overall.
 * Each reference id is resolved against the project's standalone tags collection to embed the full
 * `{ id, name }` pair (as prompts.js / prompts/tagged.js do), so `by_tags` correlates on the id; a
 * reference not present in that collection falls back to `{ id, name: id }` (the id is what
 * `by_tags` matches on — a mock simplification, since a real ref always names a created tag).
 * Response: 204 No Content — a bare `{ status: 204 }` return (Counterfact serves 204 without
 * negotiating, like the sibling DELETE handlers).
 */

/** PUT — batch-update prompt tag refs (merge or replace) → 204; unknown prompt ids skipped. */
export function PUT($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const items = body?.items ?? [];

  const promptsById = new Map(context.ops.prompts.list(scope).map((p) => [p.id, p]));
  const tagsById = new Map(context.ops.tags.list(scope).map((t) => [t.id, t]));

  for (const { id, references = [], replace = false } of items) {
    const prompt = promptsById.get(id);
    // An unknown prompt id is skipped SILENTLY (live returns 204, no "not found" signal).
    if (prompt) {
      const refTags = references.map((tid) => {
        const t = tagsById.get(tid);
        return t ? { id: t.id, name: t.name } : { id: tid, name: tid };
      });
      let nextTags = refTags;
      if (!replace) {
        // Merge: keep existing tags, add the references, dedupe by tag id.
        const byId = new Map((prompt.tags ?? []).map((t) => [t.id, t]));
        for (const rt of refTags) {
          byId.set(rt.id, rt);
        }
        nextTags = [...byId.values()];
      }
      context.ops.prompts.update(scope, id, { tags: nextTags });
    }
  }

  return { status: 204 };
}
