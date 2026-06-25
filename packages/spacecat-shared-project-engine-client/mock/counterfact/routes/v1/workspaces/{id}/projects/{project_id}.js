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

/** PATCH — partially update a project. */
export function PATCH($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id };
  const updated = context.ops.projects.update(scope, path.project_id, { ...body });
  if (!updated) {
    return { status: 404 };
  }
  return $.response[200].json(updated);
}

/** DELETE — remove a project. */
export function DELETE($) {
  const { path, context } = $;
  context.ops.projects.remove({ workspaceId: path.id }, path.project_id);
  return { status: 204 };
}
