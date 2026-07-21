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
 * Stateful handler for PATCH
 * /v3/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}/metadata
 * (`aio-patch-prompt-metadata`, LLMO-6288 WP2 rework) — the SINGLE-prompt metadata write the
 * delivered Semrush swagger defines (2026-07-20), described there as "a thin adapter over the
 * batch service method". The mock's equivalent: the body IS `AIOPromptMetadataPatch` directly (no
 * `{ metadata }` wrapper, unlike the combined `PATCH .../{prompt_id}`), so it is passed straight
 * through `stateful.js`'s `patchOne` core as `{ metadata: body }` — the same RFC 7396 merge
 * (absent key = keep, string = set, explicit null = delete a key) `patchMetadataBatch` applies per
 * item. Response 204 No Content. 404 for an unknown prompt id; 400 (`check-violation`) on the
 * author-length CHECK (`created_by`/`updated_by` > 100 chars) — `patchOne`'s OTHER 400 cause
 * (`empty-request`) cannot happen here since `metadata` is always passed. Materialized into
 * `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** PATCH — single-prompt RFC-7396 metadata merge → 204; 404 unknown id; 400 CHECK violation. */
export function PATCH($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };

  const result = context.ops.prompts.patchOne(scope, path.prompt_id, { metadata: body ?? {} });
  if (result.status === 'not-found') {
    return $.response[404].json(context.factories.createBasicResponseMock({ message: 'not found' }));
  }
  if (result.status === 'check-violation') {
    return $.response[400].json(context.factories.createBasicResponseMock({
      message: 'created_by/updated_by must be at most 100 characters',
    }));
  }
  // 'empty-request' / 'conflict' are unreachable here: `metadata` is always passed (never
  // `undefined`, so patchOne never sees "neither field"), and a name collision is only checked
  // when `name` is supplied, which this endpoint never does.
  return { status: 204 };
}
