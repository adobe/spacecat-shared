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
 * Stateful handler for PATCH /v3/workspaces/{id}/projects/{project_id}/aio/prompts/metadata
 * (`aio-patch-prompts-metadata-batch`, LLMO-6288 WP2 rework) — the BATCH metadata write the
 * delivered Semrush swagger defines (2026-07-20). This SUPERSEDES the mock's previous ADR-shaped
 * `PUT`/`PATCH .../aio/prompts/metadata` overwrite/merge pair (dropped — see git history). Body
 * `PatchAIOPromptsBatchRequest`: `{ items: [{ prompt_id, metadata }] }` — `metadata` is an RFC 7396
 * JSON Merge Patch (`AIOPromptMetadataPatch`): a key ABSENT keeps the stored value, a STRING sets
 * it, an explicit `null` DELETES it (a merge that removes the last surviving key collapses
 * `metadata` to `null`). Response 204 No Content.
 *
 * ONE TRANSACTION: an unknown `prompt_id`, or ANY item's merge violating the live `created_by` /
 * `updated_by` `maxLength: 100` CHECK, rolls the WHOLE batch back — 404 / 400 respectively, nothing
 * written for any item (the delivered contract: "a CHECK-constraint violation on any item rolls
 * the batch back and returns 400"). All resolution + validation happens in
 * `mock/stateful.js`'s `patchMetadataBatch` (unit-tested to 100% branch coverage) BEFORE any
 * write; this handler only maps its result onto the HTTP envelope. Materialized into
 * `.counterfact/routes/` by the mock runner; excluded from coverage.
 */

/** PATCH — batch RFC-7396 metadata merge, one transaction → 204; 404/400 roll back the batch. */
export function PATCH($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const items = (body?.items ?? [])
    .map((item) => ({ id: item.prompt_id, metadata: item.metadata }));

  const outcome = context.ops.prompts.patchMetadataBatch(scope, items);
  if (outcome.status === 'not-found') {
    return $.response[404].json(context.factories.createBasicResponseMock({ message: 'not found' }));
  }
  if (outcome.status === 'bad-request') {
    return $.response[400].json(context.factories.createBasicResponseMock({
      message: 'created_by/updated_by must be at most 100 characters',
    }));
  }
  return { status: 204 };
}
