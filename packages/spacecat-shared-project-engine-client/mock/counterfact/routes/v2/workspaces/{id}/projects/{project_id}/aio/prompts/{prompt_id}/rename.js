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
 * /v2/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/rename
 * (`aio-rename-prompt`) — the IN-PLACE text edit of one prompt. In the AIO model a prompt's `name`
 * IS its text, so rename is the text-edit operation. Live-verified 2026-07-14 against prod
 * (serenity-docs#63 §2): the prompt id is preserved (`{ id, name, is_updated }` echoes the SAME
 * id), the prompt count is unchanged, and renaming onto ANOTHER prompt's exact text fails with a
 * clean `409 conflict` — no mutation, no duplicate (409 declared via overlay CR17). Materialized
 * into `.counterfact/routes/` by the mock runner; excluded from coverage.
 *
 * Behaviour:
 * - Unknown `prompt_id` → `404 { message: 'not found' }` (declared upstream; same shape as the
 *   sibling aio/tags/{tag_id} 404).
 * - `new_name` equal to ANOTHER prompt's text in this project → `409` BasicResponse, nothing
 *   mutated. The check excludes the prompt itself: renaming a prompt onto its own current text is
 *   the documented no-op, not a collision.
 * - Otherwise the stored prompt's `name` is updated in place (id stable) and the response carries
 *   `is_updated: true` — or `false` for the no-op rename (unchanged name), per the vendored
 *   swagger's description. Live also answers `is_updated: false` for the not-yet-live and
 *   live-name-restore cases; the mock does not model those (prompts carry no draft/live text
 *   split here — `is_new` gates by_tags visibility only, see prompts.js).
 * - Draft/live: live applies a rename to the DRAFT layer (the live view keeps the old text until
 *   publish). The mock stores a single `name`, so the rename is immediately visible on both the
 *   draft and default `by_tags` reads — a known simplification, matching the package's
 *   single-layer tag model.
 */

/** POST — rename a prompt in place (body: `{ new_name }`) → 200 RenamePromptResponse. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const newName = body?.new_name ?? '';

  const prompts = context.ops.prompts.list(scope);
  const prompt = prompts.find((p) => p.id === path.prompt_id);
  if (!prompt) {
    // Live returns `404 {"message":"not found"}` for an unknown prompt id — the vendored swagger
    // declares the 404, so it goes through Counterfact's normal response validation.
    return $.response[404].json(context.factories.createBasicResponseMock({ message: 'not found' }));
  }

  // A text collision with a SIBLING prompt is a 409 with nothing mutated (live-verified
  // 2026-07-14, declared via overlay CR17). The prompt itself is excluded: an unchanged-name
  // rename is the documented `is_updated: false` no-op below, not a conflict.
  const conflict = prompts.some((p) => p.id !== path.prompt_id && p.name === newName);
  if (conflict) {
    return $.response[409].json(
      context.factories.createBasicResponseMock({ message: 'prompt name conflict: a prompt with this name already exists' }),
    );
  }

  const isUpdated = prompt.name !== newName;
  const updated = isUpdated
    ? context.ops.prompts.update(scope, path.prompt_id, { name: newName })
    : prompt;
  return $.response[200].json(context.factories.createRenamePromptResponseMock({
    id: updated.id,
    name: updated.name,
    is_updated: isUpdated,
  }));
}
