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
 * "Known limitations": a later create/tag by the new name would mint a duplicate).
 *
 * `parent_id` is a live-verified 3-way switch (serenity-docs#24 §3.1 gate 1, verified 2026-07-02
 * against prod), NOT a simple presence check: an OMITTED `parent_id` key preserves the tag's
 * current parent (a rename-only call must not silently un-parent the tag); an explicit JSON
 * `null` promotes the tag to a root (`parent_id` cleared to `''`, which the read path treats as a
 * root); a non-empty string re-parents it under that id. CR15 marks `TreeNodeRequest.parent_id`
 * nullable in the overlay so a literal `null` passes Counterfact's request validation. `
 * children_count`/`path` are derived at read time, so they are not part of the update. Returns
 * 200 `TreeNodeResponse` and 404 `{ message: 'not found' }` for an unknown `tag_id` — both
 * verified 2026-07-01 against prod (`adobe-hackathon.semrush.com`); the vendored swagger's
 * 201/no-404 is corrected by overlay CR11/CR12. Materialized into `.counterfact/routes/` by the
 * mock runner; excluded from coverage.
 */

/** PATCH — re-parent / rename a tag (body: `{ name, parent_id? }`) → 200 TreeNodeResponse. */
export function PATCH($) {
  const { path, body, context } = $;
  const scope = { workspaceId: path.id, projectId: path.project_id };
  const patch = { name: body?.name };
  // A degenerate self-referential `parent_id` (== `tag_id`) is NOT guarded: the consumer never
  // parents a category to itself, and live Semrush's handling of it is unverified
  // (serenity-docs#21 §7), so the mock stores it verbatim rather than inventing a rejection — a
  // read would then show a self-loop (path/children_count pointing at the tag itself), an
  // artefact of that degenerate input.
  if (Object.prototype.hasOwnProperty.call(body ?? {}, 'parent_id')) {
    // Explicit null -> promote to root (cleared to ''); a non-null value -> re-parent verbatim.
    patch.parent_id = body.parent_id === null ? '' : String(body.parent_id);
  }
  // No `parent_id` key at all -> omit it from the patch so store.update's shallow merge leaves
  // the tag's current parent untouched (a rename-only call must not un-parent it).
  const updated = context.ops.tags.update(scope, path.tag_id, patch);
  if (!updated) {
    // Live returns `404 {"message":"not found"}` for an unknown tag id (verified 2026-07-01 against
    // prod — CR12 declares the 404 so response validation accepts it).
    return $.response[404].json(context.factories.createBasicResponseMock({ message: 'not found' }));
  }
  // Live responds 200 (not 201) to aio-update-tag (verified 2026-07-01 against prod — CR11).
  return $.response[200].json(context.factories.createTagNodeMock({
    id: updated.id,
    name: updated.name,
    ...context.parentIdField(updated.parent_id),
  }));
}
