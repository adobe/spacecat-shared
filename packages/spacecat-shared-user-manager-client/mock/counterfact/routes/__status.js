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
 * Test-only control route for the deterministic `not ready → created` settle. Sets how many of the
 * next `getWorkspaceStatus` reads on a workspace return `not ready` before it settles — so a test /
 * the cross-repo harness can exercise the consumer's poll loop without a wall clock.
 *
 *   POST /__status  { workspaceId, pending }  — the next `pending` status reads return `not ready`,
 *     then the workspace's settled status. `0` clears it (immediately settled). Returns the record.
 *
 * Not part of the User Manager API; materialized into `.counterfact/routes/` by the mock runner and
 * excluded from coverage.
 */

/** POST /__status — set a workspace's `not ready` read budget. */
export function POST($) {
  const { body, context } = $;
  if (!body?.workspaceId) {
    return {
      status: 400,
      body: { message: '__status requires a workspaceId' },
      contentType: 'application/json',
    };
  }
  const record = context.ops.workspaces.setPendingStatus(body.workspaceId, body?.pending ?? 0);
  return { status: 200, body: record, contentType: 'application/json' };
}
