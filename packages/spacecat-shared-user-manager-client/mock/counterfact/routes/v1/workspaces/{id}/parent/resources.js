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
 * Stateful handler for GET /v1/workspaces/{id}/parent/resources — the vendored
 * `workspace-resources-master` op. IMPORTANT (live-verified 2026-07-02, plan Gate 0): despite
 * the "parent" name, the live gateway returns the WORKSPACE'S OWN allocation here, NOT the
 * master pool. A caller wanting the org pool reads the MASTER workspace's own `/resources`
 * instead. This mock mirrors that: it returns the same `NewWorkspaceResources` as `/resources`
 * for `{id}`. A missing workspace is a 403. Materialized by the runner; excluded from coverage.
 */

/** GET — the workspace's own AI resources (live returns self, not the master pool — Gate 0). */
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
