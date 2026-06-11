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

/* eslint-disable no-unused-vars -- Counterfact passes a single `$` context object to handlers. */

/**
 * Stateful handlers for /v2/workspaces/{id}/projects/{project_id}/aio/prompts — create (one per
 * supplied keyword) and batch-delete. Materialized into `.counterfact/routes/` by the mock
 * runner; excluded from coverage.
 */

/** POST — create prompts (body: { items: [text], tag_ids }). Returns the first as StringIDName. */
export function POST($) {
  const { path, body, context } = $;
  const created = context.ops.prompts.createMany(
    { workspaceId: path.id, projectId: path.project_id },
    (body?.items ?? []).map((text) => ({ name: text })),
  );
  const first = created[0] ?? {};
  return $.response[200].json({ id: first.id, name: first.name });
}

/** DELETE — batch-delete prompts (body: { ids }). */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.prompts.removeMany(
    { workspaceId: path.id, projectId: path.project_id },
    body?.ids ?? [],
  );
  return { status: 204 };
}
