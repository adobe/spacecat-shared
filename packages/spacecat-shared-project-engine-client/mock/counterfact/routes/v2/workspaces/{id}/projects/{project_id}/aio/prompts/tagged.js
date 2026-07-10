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
 * Stateful handler for POST /v2/workspaces/{id}/projects/{project_id}/aio/prompts/tagged
 * (`aio-create-prompts-with-tags`) — the create path the real consumer calls
 * (spacecat-api-service `createTaggedPrompts`). Request is `AIOTaggedPromptsCreateRequest`:
 * `{ prompts: { [promptText]: [tagName, ...] } }` — keyed by PROMPT TEXT (verified live
 * 2026-06-25), each value the tag names to attach. One stored prompt is created per text key,
 * carrying an `AIOTag` synthesized from each tag name (stable id so `by_tags` filtering works).
 * The tag ids are minted via `context.tagId` (the shared mock/tag-id.js helper) so they match the
 * ids `POST /aio/tags` persists for the same name. Returns 201 `IDsWithStatsResponse`.
 *
 * **This endpoint can only ever address ROOT tags.** Its request carries names and nothing else —
 * there is no field in `AIOTaggedPromptsCreateRequest` for a `parent_id`, so a nested tag is
 * unreachable and a name that does not exist at root level mints a NEW ROOT (live-verified:
 * serenity-docs#24 §3.1, "name-based and root-only"). `context.tagId` is therefore called WITHOUT a
 * parent here, deriving the root id for each name. That is a faithful model of the live contract,
 * not a mock shortcut — do not invent a name→nested-tag lookup the real API does not have.
 * Under the dimension-root model every value is a bare-named DESCENDANT, so this endpoint cannot
 * express a prompt's tags at all; the id-based `POST /aio/prompts { items, tag_ids }` replaces it.
 *
 * Writes to DRAFT only, `is_new: true` on the created prompt (live-verified 2026-07-02,
 * serenity-docs#24 §3.1 gate 2 + gate 6, same mechanism as the id-based `aio/prompts.js` create):
 * `by_tags.js`'s default (non-draft) read excludes it until the project's `publish` endpoint
 * runs and flips it to `is_new: false`; `?draft=true` sees it immediately.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/**
 * POST — create prompts → 201 { ids, existing_count }. Body is `AIOTaggedPromptsCreateRequest`
 * `{ prompts: { [promptText]: [tagName, ...] } }` — keyed by PROMPT TEXT, each value the list of
 * tag names to attach (matching the real consumer: `prompts.js` sends `{ [text]: tags }`, the
 * subworkspace provisioner calls it `promptsByText`). One prompt is created per text key. Metered:
 * the whole batch 405s (creates nothing) when it would exceed the workspace's prompt allocation —
 * the disguised quota 405 the live API returns (see mock/quota.js).
 */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const promptsByText = body?.prompts ?? {};

  // Live dedups prompts by TEXT: a text already present in the project is not re-created — it is
  // counted in `existing_count` and gets no new id (verified 2026-06-29). Partition the request
  // against the stored prompt texts so only genuinely-new texts are created (object keys are
  // unique, so there are no in-batch text duplicates to fold in).
  const existingTexts = new Set(context.ops.prompts.list(scope).map((p) => p.name));
  const newEntries = Object.entries(promptsByText).filter(([text]) => !existingTexts.has(text));
  const existingCount = Object.keys(promptsByText).length - newEntries.length;
  const toCreate = newEntries.map(([text, tags]) => context.factories
    .createPromptMock({
      name: text,
      is_new: true,
      tags: (tags ?? []).map((name) => ({ id: context.tagId(name), name })),
    }));

  if (!context.quota.canCreatePrompts(path.id, toCreate.length)) {
    return {
      status: 405,
      body: { message: 'Quota exceeded: prompt allocation exhausted' },
      contentType: 'application/json',
    };
  }

  const created = context.ops.prompts.createMany(scope, toCreate);

  // A name absent from the root level mints a ROOT tag, so every tag a created prompt carries is a
  // real row in the project's tag tree — which is what lets `by_tags` serialize an embedded tag
  // through the same view as `GET /aio/tags` rather than echoing a bare `{ id, name }` stub.
  // Resolve-before-create: only the absent ids are written, since `upsertMany` treats an id that is
  // already stored as a collision. Runs after the quota gate so a 405 still creates nothing.
  const storedTagIds = new Set(context.ops.tags.list(scope).map((t) => t.id));
  const minted = new Map();
  for (const tag of created.flatMap((p) => p.tags ?? [])) {
    if (!storedTagIds.has(tag.id) && !minted.has(tag.id)) {
      minted.set(tag.id, context.factories.createAIOTagMock({ id: tag.id, name: tag.name }));
    }
  }
  if (minted.size > 0) {
    context.ops.tags.upsertMany(scope, [...minted.values()]);
  }

  return $.response[201].json({ ids: created.map((p) => p.id), existing_count: existingCount });
}
