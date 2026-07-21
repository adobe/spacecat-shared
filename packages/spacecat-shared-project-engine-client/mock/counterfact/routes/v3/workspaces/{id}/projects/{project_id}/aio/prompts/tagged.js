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
 * Stateful handler for POST /v3/workspaces/{id}/projects/{project_id}/aio/prompts/tagged
 * (`aio-create-tagged-prompts`, LLMO-6288 WP2 rework) — the v3 PER-ITEM tags+metadata create the
 * delivered Semrush swagger defines (2026-07-20). Body `CreateTaggedAIOPromptsRequest`:
 * `{ prompts: [{ name, tags?: [tagName…], metadata? }] }` — each item carries its OWN tag names
 * and metadata (unlike the shared-`tag_ids` v3 `POST /aio/prompts`). Response 201
 * `AIOPromptCreateWithMetadataResponse`, same per-item echo shape as the plain v3 create.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage — the
 * dedupe/CHECK logic lives in `mock/stateful.js` (`createManyWithMetadata`, unit-tested).
 *
 * Tag resolution mirrors the v2 name-based `aio/prompts/tagged.js`: **root-only** — a name absent
 * from the root level MINTS a new root tag (the request carries names, nothing else, so there is
 * no way to address a nested tag here; see that file's doc for the full rationale). Minted tags
 * are registered AFTER the write (so a 405/400 short-circuit mints nothing).
 *
 * Behaviour:
 * - DEDUPE by prompt NAME (mirrors the plain v3 create): a name already present in the project
 *   (in the store, or earlier in this batch) is NOT re-created — its result echoes the EXISTING
 *   id + PRESERVED stored metadata, `is_new: false`. Its OWN request tags/metadata are discarded.
 * - ATOMIC author-length CHECK: any item's metadata beyond the 100-char CHECK 400s the whole
 *   request, nothing created (mirrors the plain v3 create).
 * - Quota-metered on NEW items only (a dedupe hit costs nothing).
 */

/** POST — v3 create prompts with per-item tag names + metadata → 201 per-item echo. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const requested = body?.prompts ?? [];

  // Resolve/mint a ROOT tag id per NAME across the whole batch (mirrors v2 tagged.js: root-only,
  // no nested lookup is possible from a bare tag name).
  const existingTagIds = new Set(context.ops.tags.list(scope).map((t) => t.id));
  const minted = new Map();
  const resolveTag = (name) => {
    const id = context.tagId(name);
    if (!existingTagIds.has(id) && !minted.has(id)) {
      minted.set(id, context.factories.createAIOTagMock({ id, name }));
    }
    return { id, name };
  };

  const items = requested.map((p) => ({
    name: p.name,
    metadata: p.metadata,
    tags: (p.tags ?? []).map(resolveTag),
  }));

  if (context.ops.prompts.hasOversizedAuthor(items)) {
    return $.response[400].json(context.factories.createBasicResponseMock({
      message: 'created_by/updated_by must be at most 100 characters',
    }));
  }

  // Quota metered on NEW items only, same dedupe-aware accounting as the plain v3 create.
  const seenNames = new Set(context.ops.prompts.list(scope).map((p) => p.name));
  let newCount = 0;
  for (const item of items) {
    if (!seenNames.has(item.name)) {
      seenNames.add(item.name);
      newCount += 1;
    }
  }
  if (!context.quota.canCreatePrompts(path.id, newCount)) {
    return {
      status: 405,
      body: { message: 'Quota exceeded: prompt allocation exhausted' },
      contentType: 'application/json',
    };
  }

  const outcome = context.ops.prompts.createManyWithMetadata(scope, items);
  if (!outcome.ok) {
    return $.response[400].json(context.factories.createBasicResponseMock({
      message: 'created_by/updated_by must be at most 100 characters',
    }));
  }

  // Register newly-minted root tags AFTER the write, same ordering as v2 tagged.js (a 400/405
  // short-circuit above mints nothing).
  if (minted.size > 0) {
    context.ops.tags.upsertMany(scope, [...minted.values()]);
  }

  return $.response[201].json({
    items: outcome.results.map((r) => context.factories.createPromptCreateResultMock(r)),
    existing_count: outcome.existingCount,
  });
}
