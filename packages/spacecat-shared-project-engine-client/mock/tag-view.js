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

// @ts-check

import { parentIdField } from './parent-id.js';

/**
 * The single tag serializer, shared by every endpoint that returns a tag.
 *
 * Live has exactly one: a tag object is BYTE-IDENTICAL whether it is embedded on
 * a prompt (`POST /aio/prompts/by_tags` → `items[].tags[]`) or listed by the tree
 * read (`GET /aio/tags`). Fetching the same id both ways and comparing the two
 * objects yields equality (verified 2026-07-10 against prod). What varies is the
 * tag's DEPTH, not the endpoint it came back from:
 *
 * - a ROOT tag is `{ children_count, id, name, prompts_count }` — the `parent_id`
 *   and `path` keys are ABSENT, not null;
 * - a DESCENDANT adds `parent_id` and a root-first `path[]`.
 *
 * A consumer therefore reads a prompt tag's dimension straight off `path[0]`, and
 * a tag with no `path` is a root whose own name is its dimension. Two serializers
 * — one for the tree, a narrower one for prompts — would let a consumer pass
 * against the mock and read `undefined` in production, so there is only this one.
 *
 * `children_count` and `path` are DERIVED here from the stored collection, never
 * stored, so a re-parent or a rename is reflected on the next read of any
 * endpoint rather than leaving a stale copy embedded on a prompt.
 */

/**
 * @typedef {{ id: string, name: string, parent_id?: string, prompts_count?: number }} StoredTag
 */

/**
 * Indexes a project's stored tags and returns the canonical read view of each.
 *
 * @param {StoredTag[]} stored the project's tag collection, exactly as persisted.
 * @param {typeof import('./factories.js')} factories the typed entity factories.
 * @returns {{ byId: Map<string, object>, serialize: (tag: StoredTag) => object }}
 */
export function buildTagView(stored, factories) {
  const byStoredId = new Map(stored.map((t) => [t.id, t]));

  // One O(n) pass, so serializing the whole collection stays O(n) rather than
  // re-scanning `stored` inside every item.
  const childCounts = new Map();
  for (const t of stored) {
    if (t.parent_id) {
      childCounts.set(t.parent_id, (childCounts.get(t.parent_id) ?? 0) + 1);
    }
  }

  /**
   * The full ancestry breadcrumb, ROOT-FIRST, excluding the tag itself. A depth-2
   * tag yields one leaf (its dimension root); a depth-3 tag yields two. Consumers
   * key a tag's dimension off `path[0]`, so a breadcrumb truncated to the direct
   * parent would resolve a sub-category's dimension to its category. Each leaf
   * beyond the root echoes its own `parent_id`; the root leaf carries none.
   * A root tag has no ancestors, so it gets no `path` key at all.
   */
  /** @param {StoredTag} tag */
  const ancestryOf = (tag) => {
    const leaves = [];
    const guard = new Set([tag.id]);
    let cursor = tag.parent_id ? byStoredId.get(tag.parent_id) : undefined;
    while (cursor && !guard.has(cursor.id)) {
      guard.add(cursor.id);
      leaves.unshift(factories.createAIOTagLeafMock({
        id: cursor.id,
        name: cursor.name,
        ...parentIdField(cursor.parent_id),
      }));
      cursor = cursor.parent_id ? byStoredId.get(cursor.parent_id) : undefined;
    }
    return leaves;
  };

  /** @param {StoredTag} tag */
  const serialize = (tag) => {
    const path = ancestryOf(tag);
    return factories.createAIOTagMock({
      id: tag.id,
      name: tag.name,
      prompts_count: tag.prompts_count ?? 0,
      children_count: childCounts.get(tag.id) ?? 0,
      ...parentIdField(tag.parent_id),
      // Omitted, not null: live leaves the key off a root entirely.
      ...(path.length > 0 ? { path } : {}),
    });
  };

  const byId = new Map(stored.map((t) => [t.id, serialize(t)]));
  return { byId, serialize };
}
