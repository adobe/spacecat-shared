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
 * Stateful handler for GET /v1/workspaces/{id}/status — the consumer's `getWorkspaceStatus`, polled
 * after a child create until `created`. Overlay CR2 retypes the 200 as a single
 * `WorkspaceCheckResponse` object `{ status }` (the live shape; the consumer reads
 * `status.status === 'created'`). A workspace with a `not ready` budget (seed / `__status`) reports
 * `not ready` until the budget burns down, then its settled status. A missing workspace (never
 * created, or cascade-deleted) is a 403 — reads on a deleted workspace 403 (workspace doc §4).
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** GET — the workspace's status (deterministic `not ready → created` settle). */
export function GET($) {
  const { path, context } = $;
  if (!context.ops.workspaces.exists(path.id)) {
    return {
      status: 403,
      body: context.factories.createBasicResponseMock({ message: 'invalid access attempt' }),
      contentType: 'application/json',
    };
  }
  return $.response[200].json(
    context.factories.createWorkspaceStatusMock({
      status: context.ops.workspaces.readStatus(path.id),
    }),
  );
}
