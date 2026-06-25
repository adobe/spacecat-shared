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
 * Stateful handler for DELETE /v2/workspaces/{id}/projects/{project_id}/aio/prompts — the only
 * operation the spec defines on this exact path (`aio-delete-prompt-by-ids-v2`). Prompt *create*
 * lives at `aio/prompts/tagged` and *list* at `aio/prompts/by_tags` — the paths the real
 * consumer (spacecat-api-service `rest-transport.js`) actually calls. Materialized into
 * `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** DELETE — batch-delete prompts (body: { ids }) → 204 No Content. */
export function DELETE($) {
  const { path, body, context } = $;
  context.ops.prompts.removeMany(
    { workspaceId: path.id, projectId: path.project_id },
    body?.ids ?? [],
  );
  return { status: 204 };
}
