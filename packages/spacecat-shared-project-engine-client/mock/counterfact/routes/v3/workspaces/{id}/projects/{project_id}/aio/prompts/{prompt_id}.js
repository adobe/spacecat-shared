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
 * Stateful handler for PATCH /v3/workspaces/{id}/projects/{project_id}/aio/prompts/{prompt_id}
 * (`aio-patch-prompt`, LLMO-6288 WP2 rework) — the COMBINED name+metadata edit the delivered
 * Semrush swagger defines (2026-07-20). Body `PatchAIOPromptRequest`: `{ name?, metadata? }` —
 * both optional, but the request must supply AT LEAST ONE (the schema marks neither `required`,
 * so this is a handler-level 400, not request validation). `name: null` is rejected by REQUEST
 * VALIDATION before this handler ever runs — the spec keeps `name` a plain, non-nullable string
 * (overlay CR20 only makes `metadata` nullable). `metadata: null` WIPES the entire block (the
 * row's `metadata` collapses to `null`); `metadata: {...}` is an RFC 7396 merge (absent key =
 * keep, string = set, explicit null = delete a key). A `name` equal to a SIBLING prompt's exact
 * text conflicts — `409`, nothing mutated (same rule as the dedicated `/rename` endpoint). An
 * over-length `created_by`/`updated_by` in the metadata patch — `400`, nothing mutated. Response
 * 204 No Content. All of this lives in `mock/stateful.js`'s `patchOne` (unit-tested to 100% branch
 * coverage); this handler only maps its result onto the HTTP envelope. Materialized into
 * `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** PATCH — combined name/metadata merge → 204; 400 (neither field / CHECK); 404; 409 (conflict). */
export function PATCH($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };

  const result = context.ops.prompts.patchOne(scope, path.prompt_id, {
    name: body?.name,
    metadata: body?.metadata,
  });
  if (result.status === 'bad-request') {
    return $.response[400].json(context.factories.createBasicResponseMock({
      message: 'request must include at least one of name or metadata',
    }));
  }
  if (result.status === 'not-found') {
    return $.response[404].json(context.factories.createBasicResponseMock({ message: 'not found' }));
  }
  if (result.status === 'conflict') {
    return $.response[409].json(context.factories.createBasicResponseMock({
      message: `conflict\nprompt with name "${body?.name}" already exists`,
    }));
  }
  return { status: 204 };
}
