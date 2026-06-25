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
 * Stateful handlers for /v1/workspaces/{id}/projects — list + create, backed by the shared
 * store on `$.context`. Project create is metered: when the workspace's `projects` allocation is
 * exhausted it returns the disguised quota 405 (see mock/quota.js). Materialized into
 * `.counterfact/routes/` by the mock runner; never imported by tests, so excluded from coverage.
 */

/** GET — list projects in the workspace. */
export function GET($) {
  const { path, context } = $;
  const items = context.ops.projects.list({ workspaceId: path.id });
  return $.response[200].json({ items, page: 1, total: items.length });
}

/** POST — create a project (metered → 405 when the projects quota is exhausted). */
export function POST($) {
  const { path, body, context } = $;
  if (!context.quota.canCreateProject(path.id)) {
    return {
      status: 405,
      body: { message: 'Quota exceeded: project allocation exhausted' },
      contentType: 'application/json',
    };
  }
  const created = context.ops.projects.create({ workspaceId: path.id }, { ...body });
  return $.response[201].json(created);
}
