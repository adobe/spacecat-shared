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

/**
 * Stateful handlers for /v1/workspaces/{id}/projects/{project_id}/ai_models — list and
 * batch-delete the project's AI models. There is deliberately NO v1 POST (add): the only
 * consumer (`spacecat-api-service` rest-transport `addAiModel`) adds via the v2 route, so a v1
 * add is dead surface. A v1 POST therefore 404s in the mock, matching the consumer-driven floor
 * in docs/mock-statefulness.md. Materialized into `.counterfact/routes/`; excluded from coverage.
 */

/** GET — list the project's AI models. */
export function GET($) {
  const { path, context } = $;
  const items = context.ops.ai_models.list({ workspaceId: path.id, projectId: path.project_id });
  return $.response[200].json({ items, page: 1, total: items.length });
}

/** DELETE — batch-delete AI models (body: { ids }). */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.ai_models.removeMany(
    { workspaceId: path.id, projectId: path.project_id },
    body?.ids ?? [],
  );
  return { status: 204 };
}
