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
 * IS its text, so rename is the text-edit operation. Live-verified 2026-07-14 (serenity-docs#63
 * §2) and re-probed 2026-07-15 against prod for every corner below: the prompt id is preserved
 * (`{ id, name, is_updated }` echoes the SAME id), the prompt count is unchanged, and renaming
 * onto ANOTHER prompt's exact text fails with a clean `409` — no mutation, no duplicate (409
 * declared via overlay CR17). Materialized into `.counterfact/routes/` by the mock runner;
 * excluded from coverage.
 *
 * Behaviour (each point live-pinned 2026-07-15 unless noted):
 * - A request with NO body at all → `400 { message: 'EOF' }`. That is the ONLY input live
 *   rejects: with a JSON body, `new_name` is applied literally — an empty, missing or null
 *   `new_name` renames the prompt to `''` (no validation error; the request schema does not
 *   mark `new_name` required).
 * - Unknown `prompt_id` → `404 { message: 'not found' }` (exact live body).
 * - `new_name` equal to ANOTHER prompt's text in this project → `409` BasicResponse carrying
 *   live's exact wording (`conflict\nprompt with name "<new_name>" already exists`), nothing
 *   mutated. The comparison is EXACT — live applies no whitespace, case or Unicode
 *   normalization (a trailing-space, uppercased and NFD variant of a sibling's text each
 *   rename cleanly as a DIFFERENT name). The prompt itself is excluded: renaming a prompt
 *   onto its own current text is the documented `is_updated: false` no-op, not a conflict.
 * - `is_updated` reflects the LIVE layer, not whether the rename landed: a draft-only prompt
 *   (`is_new: true`) always answers `false` while the rename still applies; a published prompt
 *   answers `true` for a changed name (live-verified 2026-07-14) and `false` for an unchanged
 *   one. The live-name-restore `false` (renaming a published prompt back to its live text) is
 *   not modelled — the mock stores a single `name`, no draft/live text split.
 * - Draft/live: live applies a rename to the DRAFT layer (the live view keeps the old text until
 *   publish). The mock's single `name` makes the rename immediately visible on both the draft
 *   and default `by_tags` reads — a known simplification, matching the package's single-layer
 *   tag model.
 */

/** POST — rename a prompt in place (body: `{ new_name }`) → 200 RenamePromptResponse. */
export function POST($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };

  // The one input live rejects: no request body at all → 400 {"message":"EOF"}
  // (live-pinned 2026-07-15). Anything with a JSON body — `{}` included — is applied
  // literally below. Counterfact's parser normalizes a missing body to `{}`, so the
  // empty request is detected via the content-length header instead.
  if (!Number($.headers?.['content-length'] ?? 0)) {
    return $.response[400].json(context.factories.createBasicResponseMock({ message: 'EOF' }));
  }
  const newName = body?.new_name ?? '';

  const prompts = context.ops.prompts.list(scope);
  const prompt = prompts.find((p) => p.id === path.prompt_id);
  if (!prompt) {
    // Exact live body for an unknown prompt id (live-pinned 2026-07-15) — the vendored swagger
    // declares the 404, so it goes through Counterfact's normal response validation.
    return $.response[404].json(context.factories.createBasicResponseMock({ message: 'not found' }));
  }

  // A text collision with a SIBLING prompt is a 409 with nothing mutated (live-verified
  // 2026-07-14; body wording pinned 2026-07-15). The comparison is EXACT (`===`) — live
  // applies no whitespace, case or Unicode normalization (probed 2026-07-15). The prompt
  // itself is excluded: an unchanged-name rename is the `is_updated: false` no-op below.
  const conflict = prompts.some((p) => p.id !== path.prompt_id && p.name === newName);
  if (conflict) {
    return $.response[409].json(context.factories.createBasicResponseMock({
      message: `conflict\nprompt with name "${newName}" already exists`,
    }));
  }

  // `is_updated` mirrors the LIVE layer, not whether the rename landed: false for a draft-only
  // prompt (`is_new`) and for an unchanged name, true only for a real change to a published
  // prompt — while the rename itself applies whenever the name differs (live-pinned 2026-07-15).
  const changed = prompt.name !== newName;
  const updated = changed
    ? context.ops.prompts.update(scope, path.prompt_id, { name: newName })
    : prompt;
  return $.response[200].json(context.factories.createRenamePromptResponseMock({
    id: updated.id,
    name: updated.name,
    is_updated: changed && !prompt.is_new,
  }));
}
