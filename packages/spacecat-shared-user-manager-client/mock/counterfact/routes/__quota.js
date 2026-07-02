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
 * Test-only control route for AI resource accounting — this is how a test / the cross-repo harness
 * *provides* a workspace's finite `{ used, drafted, total }` resources, so it becomes metered and
 * child creates / resource transfers that over-draw it return the 422 "insufficient units"
 * (see mock/quota.js). A workspace with no record stays unmetered (unlimited).
 *
 *   POST /__quota  { workspaceId, projects?, prompts? }  — set (absolute) resources. Each dimension
 *     is a bare `total` number OR a `{ used, drafted, total }` object; an omitted dimension is left
 *     unchanged. Returns the stored `ai` resources.
 *   GET  /__quota?workspaceId=<ws>                       — read a workspace's resources.
 *
 * Not part of the User Manager API; materialized into `.counterfact/routes/` by the mock runner and
 * excluded from coverage.
 */

/** POST /__quota — set a workspace's finite AI resources (makes it metered). */
export function POST($) {
  const { body, context } = $;
  if (!body?.workspaceId) {
    return {
      status: 400,
      body: { message: '__quota requires a workspaceId' },
      contentType: 'application/json',
    };
  }
  const input = {};
  if (body.projects !== undefined && body.projects !== null) {
    input.projects = body.projects;
  }
  if (body.prompts !== undefined && body.prompts !== null) {
    input.prompts = body.prompts;
  }
  const record = context.quota.set(body.workspaceId, input);
  return { status: 200, body: record, contentType: 'application/json' };
}

/** GET /__quota?workspaceId=<ws> — read a workspace's available pool. */
export function GET($) {
  const { query, context } = $;
  return {
    status: 200,
    body: context.quota.usage(query?.workspaceId),
    contentType: 'application/json',
  };
}
