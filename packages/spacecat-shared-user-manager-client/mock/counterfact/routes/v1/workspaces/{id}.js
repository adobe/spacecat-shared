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
 * Stateful handler for DELETE /v1/workspaces/{id} — the consumer's `deleteWorkspace` (TEST-CLEANUP
 * ONLY upstream; the consumer gates it behind SERENITY_ALLOW_WORKSPACE_DELETE). The delete cascades
 * over the workspace's descendants (workspace doc §4), and subsequent reads on a deleted workspace
 * 403. Returns 200 `{ id }`. A delete of an unknown/already-deleted workspace is a 403 (reads after
 * a cascade 403). The spec's GET/PUT on this path are not used by the consumer, so only DELETE is
 * modelled (serve-only → the other verbs are unhandled). Materialized into `.counterfact/routes/`
 * by the mock runner; excluded from coverage.
 */

/** DELETE — remove the workspace and cascade over its descendants → 200 { id }. */
export function DELETE($) {
  const { path, context } = $;
  if (!context.ops.workspaces.exists(path.id)) {
    return {
      status: 403,
      body: context.factories.createBasicResponseMock({ message: 'invalid access attempt' }),
      contentType: 'application/json',
    };
  }
  context.ops.workspaces.remove(path.id);
  return $.response[200].json(context.factories.createWorkspaceDeleteResponseMock({ id: path.id }));
}
