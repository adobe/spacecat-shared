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

/* eslint-disable no-unused-vars -- Counterfact passes a single `$` context object to handlers. */

/**
 * Handler for POST /v2/workspaces/{id}/projects/{project_id}/aio/tags — creates project-level
 * AIO tags (the consumer's `createProjectTags`). Request is `TreeNodeListRequest` `{ names }`.
 * The live API returns a TOP-LEVEL ARRAY of `TreeNodeResponse` `[{ id, name, children_count,
 * keyword_count }]` (verified 2026-06-25; overlay CR6 retypes the 201 as an array). A
 * deterministic id per name keeps a repeated create idempotent in the mock's view. Excluded
 * from coverage (materialized handler).
 */

/** Deterministic tag id from a name so repeated creates under the same name share an id. */
const tagId = (name) => `tag-${encodeURIComponent(name)}`;

/** POST — create project tags → 201 array of TreeNodeResponse. */
export function POST($) {
  const { body } = $;
  const names = Array.isArray(body?.names) ? body.names : [];
  const tags = names.map((name) => ({
    id: tagId(name), name, children_count: 0, keyword_count: 0,
  }));
  return $.response[201].json(tags);
}
