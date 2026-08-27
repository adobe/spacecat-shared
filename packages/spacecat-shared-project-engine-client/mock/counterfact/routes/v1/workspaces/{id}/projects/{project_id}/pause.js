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
 * Handler for POST /v1/workspaces/{id}/projects/{project_id}/pause — releases the project's prompt
 * limits and stops data collection while configuration and historical data are preserved (the
 * consumer's `pauseProject`). Excluded from coverage (materialized handler); the decision table it
 * applies lives in mock/pause.js and is unit-tested there.
 *
 * Live-verified 2026-08-24 against prod: `202` with an EMPTY body, and **idempotent** — pausing an
 * already-paused project acks again rather than conflicting. An unknown project id is
 * `404 { message: 'not found' }`. So a bulk pause can be re-run safely over the same project list.
 *
 * Stateful side-effect: flips `is_paused` to `true` on the stored project, which the v1 detail and
 * both list reads then surface (live carries the key on all three). Nothing else moves —
 * `publish_status` stays `live`, and `updated_at` is NOT bumped, matching live.
 *
 * Unlike the sibling child writes, this DOES require the project to exist: live 404s an unknown
 * project id here, so the handler reads before it writes.
 */

/** POST — pause the project → 202 (idempotent); 404 when the project id is unknown. */
export function POST($) {
  const { path, context } = $;
  const scope = { workspaceId: path.id };
  const project = context.ops.projects.get(scope, path.project_id);
  const outcome = context.pauseTransition(project);
  if (outcome.status === 404) {
    return $.response[404].json(
      context.factories.createBasicResponseMock({ message: outcome.message }),
    );
  }
  context.ops.projects.update(scope, path.project_id, outcome.patch);
  // Empty body (content-length 0) like live. The explicit content type (via emptyAck) bypasses
  // Counterfact's response negotiation, which would otherwise 406 under `Accept: application/json`.
  return context.emptyAck(202);
}
