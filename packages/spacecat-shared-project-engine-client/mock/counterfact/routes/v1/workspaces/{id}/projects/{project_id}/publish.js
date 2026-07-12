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
 * Handler for POST /v1/workspaces/{id}/projects/{project_id}/publish — moves a draft to live
 * (the consumer's `publishProject`). Success is a `202` with an EMPTY body (the swagger declares no
 * 202 schema; the sibling action acks return `content-length: 0` live, verified 2026-06-25).
 * Metered: publish is a metered op, so an empty-units child (an explicit `prompts: 0` allocation)
 * returns the disguised quota 405 — exactly the "publishing an empty-units child 405s" behaviour
 * the consumer's `republishBestEffort` swallows (see mock/quota.js). Excluded from coverage
 * (materialized handler).
 *
 * Stateful side-effect: on a successful publish the stored project's read-view is moved to the
 * live state — `publish_status` flips `draft` → `live` and `published_at` is set — so a later
 * `GET`/list reflects the publish (the slice's reported status reads `live`, not `draft`; #1745).
 * `is_draft` is deliberately LEFT as-is: live keeps `is_draft: true` after publish (only
 * `publish_status`/`published_at` change), and the consumer ignores `is_draft` anyway. The update
 * is a no-op for an unknown project id (the quota cases publish under never-created ids), so the
 * 202 ack is unaffected — child writes do not assert the parent project exists (see
 * docs/mock-statefulness.md).
 *
 * Also publishes the project's DRAFT PROMPTS (live-verified 2026-07-02, serenity-docs#24 §3.1
 * gate 2 + gate 6): both prompt-create endpoints stamp a fresh prompt `is_new: true`, and
 * `aio/prompts/by_tags.js`'s default (non-draft) read excludes them. A successful publish flips
 * every still-draft prompt in this project to `is_new: false`, moving it into that default view —
 * mirroring the real consumer's existing `createTaggedPrompts` → `publishAffected` →
 * `publishProject` sequence (`src/support/serenity/handlers/prompts.js` in spacecat-api-service).
 * Tags have an analogous live draft/publish split (serenity-docs#24 discovery doc) that this mock
 * does NOT yet model — out of scope here, flagged separately.
 */

/** POST — publish the draft (project + draft prompts) → 202; 405 on an empty-units workspace. */
export function POST($) {
  const { path, context } = $;
  if (!context.quota.canPublish(path.id)) {
    return {
      status: 405,
      body: { message: 'Quota exceeded: cannot publish an empty-units workspace' },
      contentType: 'application/json',
    };
  }
  // Reflect the publish in the stored read-view: draft → live, stamp published_at, keep is_draft.
  context.ops.projects.update({ workspaceId: path.id }, path.project_id, {
    publish_status: 'live',
    published_at: new Date().toISOString(),
  });
  // Move every still-draft prompt into the published view (see the header note above).
  const promptScope = { workspaceId: path.id, projectId: path.project_id };
  for (const prompt of context.ops.prompts.list(promptScope, (p) => p.is_new === true)) {
    context.ops.prompts.update(promptScope, prompt.id, { is_new: false });
  }
  // Empty body (content-length 0) like live. The explicit content type (via emptyAck) bypasses
  // Counterfact's response negotiation, which would otherwise 406 under `Accept: application/json`.
  return context.emptyAck(202);
}
