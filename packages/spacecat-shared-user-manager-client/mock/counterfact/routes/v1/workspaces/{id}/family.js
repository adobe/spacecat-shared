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
 * Stateful handler for GET /v1/workspaces/{id}/family — the consumer's `listWorkspaceFamily`,
 * returning the workspace `{id}` plus every descendant as a TOP-LEVEL array (the live shape; the
 * consumer reads the bare array, not an `{ items }` envelope). Used for ambiguous-create recovery
 * (match a child by title) and the linked-sub-workspace guard. An unknown `{id}` is a 403 "invalid
 * access attempt" — live 403s `family` on a workspace that doesn't exist / you don't own (verified
 * 2026-06-29), mirroring `status`. Materialized into `.counterfact/routes/` by the mock runner;
 * excluded from coverage.
 */

/** GET — the workspace's family (itself + descendants) as a top-level array; 403 if unknown. */
export function GET($) {
  const { path, context } = $;
  if (!context.ops.workspaces.exists(path.id)) {
    return {
      status: 403,
      body: context.factories.createBasicResponseMock({ message: 'invalid access attempt' }),
      contentType: 'application/json',
    };
  }
  return $.response[200].json(context.ops.workspaces.listFamily(path.id));
}
