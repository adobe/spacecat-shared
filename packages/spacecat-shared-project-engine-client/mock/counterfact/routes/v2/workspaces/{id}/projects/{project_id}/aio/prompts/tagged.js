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
 * carrying an `AIOTag` synthesized from each tag name (stable id so `by_tags` filtering works),
 * so a later `by_tags` list reflects the write. Returns 201 `IDsWithStatsResponse`.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** Deterministic tag id from a tag name so repeated creates under the same name share an id. */
const tagId = (name) => `tag-${encodeURIComponent(name)}`;

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
      tags: (tags ?? []).map((name) => ({ id: tagId(name), name })),
    }));

  if (!context.quota.canCreatePrompts(path.id, toCreate.length)) {
    return {
      status: 405,
      body: { message: 'Quota exceeded: prompt allocation exhausted' },
      contentType: 'application/json',
    };
  }

  const created = context.ops.prompts.createMany(scope, toCreate);
  return $.response[201].json({ ids: created.map((p) => p.id), existing_count: existingCount });
}
