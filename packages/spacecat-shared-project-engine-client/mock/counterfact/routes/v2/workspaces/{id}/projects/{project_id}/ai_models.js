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
 * Stateful POST handler for /v2/workspaces/{id}/projects/{project_id}/ai_models — adds an AI
 * model to a project. The real consumer (spacecat-api-service `addAiModel`) writes via this v2
 * route while listing/deleting via the v1 sibling; the v2 add is a drop-in of v1 (identical
 * `{ model_id }` request and `ProjectAIModelResponse` response). It writes to the SAME
 * version-agnostic store key (`ai_models:{workspaceId}:{projectId}`), so a subsequent v1 GET
 * reflects it. v2 has no list/delete variant, so only POST is wired here.
 *
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** POST — add an AI model to the project (body: { model_id }) → 201 (matches live). */
export function POST($) {
  const { path, body, context } = $;
  const created = context.ops.ai_models.add(
    { workspaceId: path.id, projectId: path.project_id },
    { model: { id: body.model_id }, prompts_count: 0 },
  );
  return $.response[201].json(created);
}
