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
 * Stateful handler for GET /v1/workspaces/{id}/resources — the consumer's `getWorkspaceResources`,
 * read by `ensureAiHeadroom` before a metered op (child headroom) and against the MASTER workspace
 * for the org pool. Returns the live `NewWorkspaceResources` shape
 * (`product_resources.ai.resources.<dim>.{ used, drafted, total }`),
 * built from the workspace's metered record. A workspace with no record is unmetered → a zeroed
 * default (never configured); a missing workspace is a 403 (mirrors status/transfer/delete).
 * Materialized into `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** GET — the workspace's own AI resources (`{ used, drafted, total }` per dimension). */
export function GET($) {
  const { path, context } = $;
  if (!context.ops.workspaces.exists(path.id)) {
    return {
      status: 403,
      body: context.factories.createBasicResponseMock({ message: 'invalid access attempt' }),
      contentType: 'application/json',
    };
  }
  const ai = context.quota.resources(path.id);
  return $.response[200].json(context.factories.createWorkspaceResourcesMock(ai ? {
    projects: ai.projects,
    prompts: ai.prompts,
    weeklyPrompts: ai.weekly_prompts,
  } : {}));
}
