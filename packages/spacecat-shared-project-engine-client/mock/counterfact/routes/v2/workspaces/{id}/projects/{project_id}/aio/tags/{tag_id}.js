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
 * Stateful handler for PATCH /v2/workspaces/{id}/projects/{project_id}/aio/tags/{tag_id}
 * (`aio-update-tag`) — re-parent / rename one tag in the 1-level category tree (see
 * serenity-docs#21). Request is `TreeNodeRequest` `{ name, parent_id? }`; the stored tag's
 * `name` + `parent_id` are updated in place while its id stays stable (Semrush tag ids are opaque
 * and don't move on rename). NB because the mock derives ids from the name, a rename leaves the id
 * keyed to the OLD name — a documented, live-unverified limitation (see the `tags.js` header's
 * "Known limitations": a later create/tag by the new name would mint a duplicate). A non-empty
 * `parent_id` re-parents the tag under that category; an
 * absent/empty `parent_id` promotes it to a root (`parent_id` cleared to `''`, which the read path
 * treats as a root). `children_count`/`path` are derived at read time, so they are not part of the
 * update. Returns 201 `TreeNodeResponse` (the live status for this op, per the spec). An unknown
 * `tag_id` has nothing to update → 500 (live behaviour here is unverified — serenity-docs#21 §7-Q4;
 * the consumer only PATCHes tags it just read). Materialized into `.counterfact/routes/` by the
 * mock runner; excluded from coverage.
 */

/** PATCH — re-parent / rename a tag (body: `{ name, parent_id? }`) → 201 TreeNodeResponse. */
export function PATCH($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  // Empty `parent_id` (or omitted) promotes the tag to a root — clear it to '' so the stored shape
  // reflects "no parent" (the read path treats a falsy parent_id as a root). A degenerate
  // self-referential `parent_id` (== `tag_id`) is NOT guarded: the consumer never parents a
  // category to itself, and live Semrush's handling of it is unverified (serenity-docs#21 §7), so
  // the mock stores it verbatim rather than inventing a rejection — a read would then show a
  // self-loop (path/children_count pointing at the tag itself), an artefact of that degenerate
  // input.
  const parentId = String(body?.parent_id ?? '');
  const updated = context.ops.tags.update(scope, path.tag_id, {
    name: body?.name,
    parent_id: parentId,
  });
  if (!updated) {
    return $.response[500].json(
      context.factories.createBasicResponseMock({ message: `tag ${path.tag_id} not found` }),
    );
  }
  return $.response[201].json(context.factories.createTagNodeMock({
    id: updated.id,
    name: updated.name,
    ...context.parentIdField(updated.parent_id),
  }));
}
