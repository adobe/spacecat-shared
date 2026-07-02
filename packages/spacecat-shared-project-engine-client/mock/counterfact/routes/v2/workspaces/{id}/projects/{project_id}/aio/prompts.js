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
 * Stateful handlers for /v2/workspaces/{id}/projects/{project_id}/aio/prompts — the two operations
 * the spec defines on this exact path: `aio-create-prompt-v2` (POST) and
 * `aio-delete-prompt-by-ids-v2` (DELETE). The name-based create lives at `aio/prompts/tagged` and
 * *list* at `aio/prompts/by_tags`. POST here is the ID-based create the nested-category migration
 * uses: it references tags by their upstream ids (from `POST /aio/tags`), not by name. Materialized
 * into `.counterfact/routes/` by the mock runner; excluded from coverage.
 *
 * POST contract (live-verified 2026-07-02, serenity-docs#24): body
 * `{ items: [text…], tag_ids: [id…] }` (items = prompt texts, tag_ids = tags attached to EVERY
 * created prompt). Response is **201 Created** with a LIST WRAPPER
 * `{ page, total, items: [{ id, name }…], existing_count }` — typed as
 * `model.StringIDNameListResponse` via the spec overlay's CR14 (the vendored public swagger
 * originally modelled this as a 200 with a bare `StringIDName`, a spec↔live drift on BOTH the
 * status code and the body shape — the sibling `aio/prompts/tagged` create endpoint already
 * correctly documents 201; CR14 retypes this one to match, so the 201 below goes through
 * Counterfact's normal `$.response[201].json(...)` validation, not a raw bypass). Behaviour:
 * - Each `tag_id` resolves against the project's standalone tags collection to embed the full
 *   `{ id, name }` pair on the created prompt (mirroring `prompts/tagged.js`), so `by_tags` (which
 *   matches on the embedded tag id) correlates the write for free.
 * - ATOMIC on an unresolvable `tag_id`: live returns 500 and creates NOTHING, so all tag_ids are
 *   validated BEFORE any write; the first unknown id yields a 500 BasicResponse and no prompt.
 * - Text-dedupe mirrors `prompts/tagged.js`: a text already present (in the store or earlier in the
 *   same batch) is not re-created — it is folded into `existing_count`.
 * - Metered like `prompts/tagged.js` (both write the same quota-metered prompts collection): the
 *   whole batch 405s (creates nothing) when it would exceed the workspace's prompt allocation.
 * - Visibility: this mock has NO draft/live distinction for prompts — `prompts/tagged.js` makes a
 *   created prompt immediately visible via the default `by_tags` read, and POST here mirrors that:
 *   it shows up immediately. KNOWN GAP vs live: live writes this endpoint to draft only —
 *   `by_tags` (no `?draft=`) is empty until the existing publish step runs (serenity-docs#24 §3.1
 *   gate 2 + §4 deliverable-1 item 2, which explicitly asks this mock to gate on "the mock's
 *   existing publish semantics" — but no such prompt-level draft/publish state exists anywhere in
 *   this mock; `publish.js` only flips a project-level `publish_status` that no prompt read
 *   consults). Left unmodeled deliberately here to avoid inventing a parallel mechanism
 *   unilaterally; flagged for a decision by the spec owner before a consumer relies on it.
 */

/** POST — create prompts by id-based tag refs → 201 list wrapper; 500 (atomic) on unknown tag. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const items = body?.items ?? [];
  const tagIds = body?.tag_ids ?? [];

  // Resolve every tag_id up front against the project's standalone tag collection. Live is ATOMIC:
  // any unresolvable tag_id 500s and creates nothing, so validate before writing a single prompt.
  const tagsById = new Map(context.ops.tags.list(scope).map((t) => [t.id, t]));
  const unknownTagId = tagIds.find((id) => !tagsById.has(id));
  if (unknownTagId !== undefined) {
    return $.response[500].json(
      context.factories.createBasicResponseMock({ message: `unknown tag id: ${unknownTagId}` }),
    );
  }
  // Embed the full { id, name } pair (as prompts/tagged.js does) so by_tags correlates on the id.
  const tags = tagIds.map((id) => {
    const t = tagsById.get(id);
    return { id: t.id, name: t.name };
  });

  // Text-dedupe against the stored prompt texts AND within this batch, mirroring prompts/tagged.js:
  // a text already present is counted in existing_count and gets no new id.
  const seen = new Set(context.ops.prompts.list(scope).map((p) => p.name));
  const newTexts = [];
  for (const text of items) {
    if (!seen.has(text)) {
      seen.add(text);
      newTexts.push(text);
    }
  }
  const existingCount = items.length - newTexts.length;

  const toCreate = newTexts.map((name) => context.factories.createPromptMock({
    name,
    is_new: true,
    tags,
  }));

  if (!context.quota.canCreatePrompts(path.id, toCreate.length)) {
    // 405 is not a declared response for this operation (only 201/401/403/500) — the disguised
    // quota 405 the live API returns (mock/quota.js), so this stays a raw bypass like every other
    // quota-gated route in this package; it can't go through $.response[405].json(...).
    return {
      status: 405,
      body: { message: 'Quota exceeded: prompt allocation exhausted' },
      contentType: 'application/json',
    };
  }

  const created = context.ops.prompts.createMany(scope, toCreate);
  return $.response[201].json({
    page: 1,
    total: created.length,
    items: created.map((p) => ({ id: p.id, name: p.name })),
    existing_count: existingCount,
  });
}

/** DELETE — batch-delete prompts (body: { ids }) → 204 No Content. */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.prompts.removeMany(
    { workspaceId: path.id, projectId: path.project_id },
    body?.ids ?? [],
  );
  return { status: 204 };
}
