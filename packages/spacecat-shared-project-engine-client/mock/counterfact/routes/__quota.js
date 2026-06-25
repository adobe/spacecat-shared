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
 * Test-only control route for AI-unit metering — the project-engine API itself never sets
 * allocations (the user-manager gateway does), so this is how a test / the cross-repo harness
 * *provides* a workspace's allocation, mirroring the units it transferred to that sub-workspace.
 *
 *   POST /__quota  { workspaceId, projects?, prompts? }  — set (absolute) the allocation. An
 *     omitted/null dimension is unlimited; `{ projects: 0, prompts: 0 }` models a released/
 *     empty-units child (its prompt writes + publishes then 405). Returns the stored record.
 *   GET  /__quota?workspaceId=<ws>                       — read limits + live usage.
 *
 * Once set, project create / prompt write / publish on that workspace return the disguised quota
 * 405 when the allocation is exhausted (see mock/quota.js). Not part of the Project Engine API;
 * materialized into `.counterfact/routes/` by the mock runner and excluded from coverage.
 */

/** POST /__quota — set a workspace's AI allocation. */
export function POST($) {
  const { body, context } = $;
  const record = context.quota.set(body?.workspaceId, {
    projects: body?.projects ?? null,
    prompts: body?.prompts ?? null,
  });
  return { status: 200, body: record, contentType: 'application/json' };
}

/** GET /__quota?workspaceId=<ws> — read a workspace's limits + live usage. */
export function GET($) {
  const { query, context } = $;
  return {
    status: 200,
    body: context.quota.usage(query?.workspaceId),
    contentType: 'application/json',
  };
}
