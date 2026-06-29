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
 * Stateful handler for POST /v2/workspaces/{id}/child — create a brand's child sub-workspace under
 * the parent `{id}` (the consumer's `createSubworkspace`). Body is `{ title, resources }` where
 * `resources` carries the `{ ai: { projects, prompts } }` allocation carved off the parent's pool.
 * An unknown parent is a 403 "invalid access attempt" (mirrors status/transfer/delete), never a
 * silent orphan create. Otherwise metered: when the parent's pool can't cover the allocation it
 * returns the 422 "insufficient available units in subscription" (see mock/quota.js); else it draws
 * the units, creates a `created` child linked to the parent, returns it. Materialized into
 * `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** POST — create a child sub-workspace (metered → 422 when the parent pool is insufficient). */
export function POST($) {
  const { path, body, context } = $;
  // A child can only be created under a parent that exists — an unknown parent is a 403
  // (mirrors status/transfer/delete), never a silent orphan create the live gateway would reject.
  if (!context.ops.workspaces.exists(path.id)) {
    return {
      status: 403,
      body: context.factories.createBasicResponseMock({ message: 'invalid access attempt' }),
      contentType: 'application/json',
    };
  }
  const ai = body?.resources?.ai ?? {};
  if (!context.quota.canAllocate(path.id, ai)) {
    return {
      status: 422,
      body: context.factories.createBasicResponseMock({
        message: 'insufficient available units in subscription',
      }),
      contentType: 'application/json',
    };
  }
  context.quota.draw(path.id, ai);
  // The created child mirrors the live workspaceResponse exactly (no extra `resources` field —
  // the live API does not echo the allocation here; it is tracked via the parent pool draw above).
  const created = context.ops.workspaces.create(context.factories.createWorkspaceMock({
    title: body?.title ?? 'Child Workspace',
    parent_id: path.id,
    status: 'created',
  }));
  return $.response[200].json(created);
}
