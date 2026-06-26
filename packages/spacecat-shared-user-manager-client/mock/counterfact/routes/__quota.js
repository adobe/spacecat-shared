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
 * Test-only control route for parent-pool metering — this is how a test / the cross-repo harness
 * *provides* a parent workspace's available pool, so child creates / resource transfers that exceed
 * it return the 422 "insufficient available units" (see mock/quota.js).
 *
 *   POST /__quota  { workspaceId, projects?, prompts? }  — set (absolute) the available pool. An
 *     omitted/null dimension is unlimited. Returns the stored record.
 *   GET  /__quota?workspaceId=<ws>                       — read the pool.
 *
 * Not part of the User Manager API; materialized into `.counterfact/routes/` by the mock runner and
 * excluded from coverage.
 */

/** POST /__quota — set a parent workspace's available pool. */
export function POST($) {
  const { body, context } = $;
  if (!body?.workspaceId) {
    return {
      status: 400,
      body: { message: '__quota requires a workspaceId' },
      contentType: 'application/json',
    };
  }
  const record = context.quota.set(body.workspaceId, {
    projects: body?.projects ?? null,
    prompts: body?.prompts ?? null,
  });
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
