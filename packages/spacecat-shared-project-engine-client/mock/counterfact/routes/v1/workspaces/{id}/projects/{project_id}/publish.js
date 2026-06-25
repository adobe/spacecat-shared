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
 * Handler for POST /v1/workspaces/{id}/projects/{project_id}/publish — moves a draft to live
 * (the consumer's `publishProject`). Success is a `202` with an EMPTY body (the swagger declares no
 * 202 schema; the sibling action acks return `content-length: 0` live, verified 2026-06-25).
 * Metered: publish is a metered op, so an empty-units child (an explicit `prompts: 0` allocation)
 * returns the disguised quota 405 — exactly the "publishing an empty-units child 405s" behaviour
 * the consumer's `republishBestEffort` swallows (see mock/quota.js). Excluded from coverage
 * (materialized handler).
 */

/** POST — publish the draft → 202 (empty body); 405 when the workspace has 0 prompt units. */
export function POST($) {
  const { path, context } = $;
  if (!context.quota.canPublish(path.id)) {
    return {
      status: 405,
      body: { message: 'Quota exceeded: cannot publish an empty-units workspace' },
      contentType: 'application/json',
    };
  }
  // Empty body (content-length 0) like live, not Counterfact's default "Accepted" reason.
  return { status: 202, body: '' };
}
