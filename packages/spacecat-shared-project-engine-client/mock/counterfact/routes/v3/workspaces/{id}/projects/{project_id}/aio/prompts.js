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
 * Stateful handler for POST /v3/workspaces/{id}/projects/{project_id}/aio/prompts
 * (`aio-create-prompts`, LLMO-6288 WP2 rework) — the v3, metadata-aware create the delivered
 * Semrush swagger defines (2026-07-20). This SUPERSEDES the ADR-shaped `*-with-metadata` PUT
 * family the mock previously modelled against #1818's pre-delivery guess (dropped entirely — see
 * git history). Body `CreateAIOPromptsRequest`: `{ items: [{ name, metadata? }], tag_ids?:
 * [tagId…] }` — `tag_ids` are SHARED across every item, exactly like the sibling v2 id-based
 * create (`aio/prompts.js`'s `POST`). Response 201 `AIOPromptCreateWithMetadataResponse`:
 * `{ items: [{id,name,is_new,metadata}], existing_count }` — ONE RESULT PER REQUEST ITEM, not just
 * the newly-created subset (the delivered swagger's own description: "Response returns per-item
 * {id, name, is_new, metadata}"). Materialized into `.counterfact/routes/` by the mock runner;
 * excluded from coverage — the dedupe / merge / CHECK-constraint logic itself lives in
 * `mock/stateful.js` (`createManyWithMetadata`, unit-tested to 100% branch coverage); this handler
 * only resolves tag ids, meters quota, and shapes the HTTP envelope.
 *
 * Behaviour:
 * - DEDUPE by prompt NAME (`createManyWithMetadata`): a name already present in the project (in
 *   the store, or earlier in this same batch) is NOT re-created — its result echoes the EXISTING
 *   id and its PRESERVED stored metadata, `is_new: false` (the delivered contract's documented
 *   dedupe behaviour). `tag_ids` attach only to genuinely NEW prompts.
 * - ATOMIC tag_id validation: every `tag_id` is resolved against the project's standalone tag
 *   collection BEFORE any write — an unresolvable id 500s and creates nothing, mirroring the v2
 *   id-based create's atomic contract (no live-verified v3 behaviour exists yet, pending
 *   WP0-live; this is the mock's best-faith carry-over of the sibling endpoint).
 * - ATOMIC author-length CHECK: any item's `metadata.created_by` / `metadata.updated_by` beyond
 *   100 chars 400s the WHOLE request, nothing created — the live CHECK-constraint rollback the
 *   delivered contract documents for the metadata PATCH family, applied here too since create
 *   writes the same constrained column.
 * - Quota-metered like every other prompt-create path: the whole batch 405s (creates nothing)
 *   over the workspace's prompt allocation — metered on the NEW-item count only (a dedupe hit
 *   costs nothing), mirroring the v2 create paths' `existing_count` accounting.
 */

/** POST — v3 create prompts with optional per-item metadata + shared tag_ids → 201 per-item. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const items = body?.items ?? [];
  const tagIds = body?.tag_ids ?? [];

  // Atomic tag_id validation, BEFORE any write (mirrors the v2 id-based create — aio/prompts.js).
  const tagsById = new Map(context.ops.tags.list(scope).map((t) => [t.id, t]));
  const unknownTagId = tagIds.find((id) => !tagsById.has(id));
  if (unknownTagId !== undefined) {
    return $.response[500].json(
      context.factories.createBasicResponseMock({ message: `unknown tag id: ${unknownTagId}` }),
    );
  }
  const tags = tagIds.map((id) => {
    const t = tagsById.get(id);
    return { id: t.id, name: t.name };
  });

  // Author-length CHECK, before quota/writing (atomic — nothing created on a violation).
  if (context.ops.prompts.hasOversizedAuthor(items)) {
    return $.response[400].json(context.factories.createBasicResponseMock({
      message: 'created_by/updated_by must be at most 100 characters',
    }));
  }

  // Quota is metered on NEW items only — a dedupe hit costs nothing (mirrors the v2 create paths'
  // existing_count accounting). The dedupe-aware count lives in stateful.js's `countNewPrompts`,
  // shared with the tagged v3 create so the two can't drift from each other or the real dedupe.
  const newCount = context.ops.prompts.countNewPrompts(scope, items.map((item) => item.name));
  if (!context.quota.canCreatePrompts(path.id, newCount)) {
    // 405 is not a declared response for this operation (only 201/400/403/500) — the disguised
    // quota 405 the live API returns (mock/quota.js), so this is a raw bypass like every other
    // quota-gated create route in this package.
    return {
      status: 405,
      body: { message: 'Quota exceeded: prompt allocation exhausted' },
      contentType: 'application/json',
    };
  }

  const outcome = context.ops.prompts.createManyWithMetadata(
    scope,
    items.map((item) => ({ name: item.name, metadata: item.metadata, tags })),
  );
  // Unreachable in practice (hasOversizedAuthor already gated above) — kept as defense-in-depth
  // since createManyWithMetadata re-validates on every call, so it stays safe to call directly.
  if (!outcome.ok) {
    return $.response[400].json(context.factories.createBasicResponseMock({
      message: 'created_by/updated_by must be at most 100 characters',
    }));
  }

  return $.response[201].json({
    items: outcome.results.map((r) => context.factories.createPromptCreateResultMock(r)),
    existing_count: outcome.existingCount,
  });
}
