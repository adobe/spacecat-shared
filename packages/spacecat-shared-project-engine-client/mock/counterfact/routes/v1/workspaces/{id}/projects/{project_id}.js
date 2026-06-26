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
 * Stateful handlers for /v1/workspaces/{id}/projects/{project_id} — get, patch, delete.
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** GET — fetch a single project. */
export function GET($) {
  const { path, context } = $;
  const project = context.ops.projects.get({ workspaceId: path.id }, path.project_id);
  if (!project) {
    return { status: 404 };
  }
  return $.response[200].json(project);
}

/**
 * PATCH — partially update a project. The request is a flat `ProjectUpdateRequest`; live reflects
 * the brand-identity fields (`brand_name_display`/`brand_names`) NESTED under `settings.ai`, not at
 * the top level (verified 2026-06-25), so we map through `applyProjectUpdate` rather than spreading
 * the flat body. Returns 200 with the full updated draft `ProjectResponse` (live: 200 + body, NOT a
 * 202 ack — unlike the benchmark/brand-url edits).
 */
export function PATCH($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id };
  const stored = context.ops.projects.get(scope, path.project_id);
  if (!stored) {
    return { status: 404 };
  }
  const updated = context.ops.projects.update(
    scope,
    path.project_id,
    context.factories.applyProjectUpdate(stored, body),
  );
  return $.response[200].json(updated);
}

/** DELETE — remove a project. */
export function DELETE($) {
  const { path, context } = $;
  context.ops.projects.remove({ workspaceId: path.id }, path.project_id);
  return { status: 204 };
}
