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

// @ts-check

/**
 * Normalizes a raw `parent_id` into an OPTIONAL-key spread fragment for a tag entity: a non-empty
 * parent yields `{ parent_id }`, an empty/absent one yields `{}` (so the key is omitted entirely —
 * a root tag carries no `parent_id`). Shared by the two tag routes that build entities with an
 * optional parent link (`POST /aio/tags` and `PATCH /aio/tags/{tag_id}`), so the coerce-then-spread
 * idiom lives in one place and can't drift between them — the same single-source-of-truth reasoning
 * as {@link tagId} in tag-id.js. Exposed on the per-request context as `context.parentIdField`
 * (every route reads its lib helpers through `$.context`, never an import — see {@link Context}).
 *
 * NB this is only for building a tag whose parent is optional. It is NOT for the PATCH *store
 * write*, which must set `parent_id` unconditionally (to `''` when promoting a child to a root) so
 * a previous parent is cleared rather than left in place.
 *
 * @param {string | undefined | null} raw the raw `parent_id` (query/body value or a stored field)
 * @returns {{ parent_id?: string }} `{ parent_id }` when non-empty, else `{}`
 */
export const parentIdField = (raw) => {
  const parentId = String(raw ?? '');
  return parentId ? { parent_id: parentId } : {};
};
