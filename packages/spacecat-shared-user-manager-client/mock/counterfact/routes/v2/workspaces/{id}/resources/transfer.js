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
 * Stateful handler for POST /v2/workspaces/{id}/resources/transfer — the consumer's
 * `transferWorkspaceResources` (grant/re-grant or release an allocation onto the workspace `{id}`).
 * Body is `{ resources: { ai: { projects, prompts } } }`. The allocation draws from the workspace's
 * PARENT pool: when the parent can't cover it, 422 "insufficient available units in subscription"
 * (see mock/quota.js); otherwise the units are drawn and the updated child `workspaceResponse` is
 * returned — overlay CR4: live returns the workspace, NOT the spec's `WorkspaceResourcesV2`
 * (verified live 2026-06-26). The consumer only needs the 200. A missing workspace is a 403.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** POST — transfer resources onto the workspace (metered against its parent pool → 422). */
export function POST($) {
  const { path, body, context } = $;
  const workspace = context.ops.workspaces.get(path.id);
  if (!workspace) {
    return {
      status: 403,
      body: context.factories.createBasicResponseMock({ message: 'invalid access attempt' }),
      contentType: 'application/json',
    };
  }
  const ai = body?.resources?.ai ?? {};
  const parentId = workspace.parent_id;
  // A transfer sets the child's `total` ABSOLUTELY and moves the delta to/from the parent — a raise
  // carves from the parent (`422` when its free units can't cover it), a lower returns units, a
  // same-value transfer is a no-op (idempotent). Verified live 2026-07-02 (see plan Gate 0). Only
  // meters when the child or its parent is metered; unmetered stays unlimited (legacy).
  const metered = context.quota.resources(path.id) !== null
    || context.quota.resources(parentId) !== null;
  if (metered && !context.quota.applyTransfer(parentId, path.id, ai).ok) {
    return {
      status: 422,
      body: context.factories.createBasicResponseMock({
        message: 'insufficient available units in subscription',
      }),
      contentType: 'application/json',
    };
  }
  // Live returns the updated child workspaceResponse (CR4), not a WorkspaceResourcesV2 envelope.
  return $.response[200].json(workspace);
}
