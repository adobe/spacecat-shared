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
 * Handler for POST /v1/workspaces/{id}/projects/{project_id}/resume — re-consumes the project's
 * prompt limits and restarts data collection (the consumer's `resumeProject`). Excluded from
 * coverage (materialized handler); the decision table it applies lives in mock/pause.js and is
 * unit-tested there.
 *
 * Live-verified 2026-08-24 against prod: `202` with an EMPTY body on a paused project, and — unlike
 * the idempotent pause — `409 { message: 'project is not paused' }` when the project is already
 * running. An unknown project id is `404 { message: 'not found' }`. A bulk resume therefore has to
 * track what it paused, or tolerate 409s.
 *
 * Metered: the swagger states resume "re-consumes prompt limits (subject to the same quota check as
 * publishing)", so an empty-units child (an explicit `prompts: 0` allocation) returns the disguised
 * quota 405 the publish path returns — see mock/quota.js. That gate is the SPEC's claim, not a live
 * probe: exercising it needs a project inside a zero-allocation workspace, which cannot be created
 * there in the first place. It is therefore checked LAST, after the two live-verified branches, so
 * the speculative rule can never pre-empt an observed one. A quota-rejected resume leaves the
 * project paused.
 */

/** POST — resume the paused project → 202; 404 unknown id; 409 not paused; 405 on empty units. */
export function POST($) {
  const { path, context } = $;
  const scope = { workspaceId: path.id };
  const project = context.ops.projects.get(scope, path.project_id);
  const outcome = context.resumeTransition(project);
  if (outcome.status === 404 || outcome.status === 409) {
    return $.response[outcome.status].json(
      context.factories.createBasicResponseMock({ message: outcome.message }),
    );
  }
  if (!context.quota.canPublish(path.id)) {
    return {
      status: 405,
      body: { message: 'Quota exceeded: cannot resume an empty-units workspace' },
      contentType: 'application/json',
    };
  }
  context.ops.projects.update(scope, path.project_id, outcome.patch);
  // Empty body (content-length 0) like live. The explicit content type (via emptyAck) bypasses
  // Counterfact's response negotiation, which would otherwise 406 under `Accept: application/json`.
  return context.emptyAck(202);
}
