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

import { expect } from 'chai';
import { sortPromptsByMetadata, SORTABLE_FIELDS } from '../../mock/prompt-sort.js';

// The route handler is coverage-excluded, so the `by_tags` ordering is unit-tested here against the
// wire contract captured live 2026-07-29 (LLMO-6666): sort_field / sort_dir are the wire keys,
// sort / order are ignored, metadata.created_at / metadata.updated_at are sortable, and a
// missing sort key sorts last deterministically. `ids` maps a result back to input order so a case
// asserts the reorder, never just that the field survived.
describe('prompt-sort (by_tags sort_field / sort_dir)', () => {
  const ids = (list) => list.map((p) => p.id);

  // Store order is c, a, b — deliberately NOT the created_at order — so an ascending sort reorders.
  const prompts = [
    { id: 'c', metadata: { created_at: '2026-03-01T00:00:00Z', updated_at: '2026-03-09T00:00:00Z' } },
    { id: 'a', metadata: { created_at: '2026-01-01T00:00:00Z', updated_at: '2026-03-05T00:00:00Z' } },
    { id: 'b', metadata: { created_at: '2026-02-01T00:00:00Z', updated_at: '2026-03-01T00:00:00Z' } },
  ];

  it('exposes the two sortable authorship fields', () => {
    expect([...SORTABLE_FIELDS]).to.deep.equal(['metadata.created_at', 'metadata.updated_at']);
  });

  it('sorts by metadata.created_at ascending and descending', () => {
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'metadata.created_at', sortDir: 'asc' })))
      .to.deep.equal(['a', 'b', 'c']);
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'metadata.created_at', sortDir: 'desc' })))
      .to.deep.equal(['c', 'b', 'a']);
  });

  it('sorts by metadata.updated_at ascending and descending (independent of created_at order)', () => {
    // updated_at order (b<a<c) differs from created_at order, so this proves the field selection.
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'metadata.updated_at', sortDir: 'asc' })))
      .to.deep.equal(['b', 'a', 'c']);
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'metadata.updated_at', sortDir: 'desc' })))
      .to.deep.equal(['c', 'a', 'b']);
  });

  it('defaults to ascending when sort_dir is absent or unrecognised', () => {
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'metadata.created_at' })))
      .to.deep.equal(['a', 'b', 'c']);
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'metadata.created_at', sortDir: 'sideways' })))
      .to.deep.equal(['a', 'b', 'c']);
  });

  it('is case-insensitive on sort_dir', () => {
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'metadata.created_at', sortDir: 'DESC' })))
      .to.deep.equal(['c', 'b', 'a']);
  });

  it('returns store order for the WRONG keys (sort / order), making the two shapes distinguishable', () => {
    // The handler only ever passes sort_field / sort_dir; a caller sending the ignored keys lands
    // here with sortField undefined → store order. This is the crux of LLMO-6666.
    expect(ids(sortPromptsByMetadata(prompts, { sort: 'metadata.created_at', order: 'asc' })))
      .to.deep.equal(['c', 'a', 'b']);
    expect(ids(sortPromptsByMetadata(prompts, {}))).to.deep.equal(['c', 'a', 'b']);
  });

  it('returns store order for an unrecognised sort_field (mirrors live: 200 in default order)', () => {
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'metadata.name', sortDir: 'asc' })))
      .to.deep.equal(['c', 'a', 'b']);
    expect(ids(sortPromptsByMetadata(prompts, { sortField: 'name', sortDir: 'asc' })))
      .to.deep.equal(['c', 'a', 'b']);
  });

  it('sorts prompts with an unset sort key LAST in both directions, stable among themselves', () => {
    const mixed = [
      { id: 'stamped-late', metadata: { created_at: '2026-02-01T00:00:00Z' } },
      { id: 'no-metadata' },
      { id: 'stamped-early', metadata: { created_at: '2026-01-01T00:00:00Z' } },
      { id: 'null-metadata', metadata: null },
      { id: 'unset-key', metadata: { updated_at: '2026-05-01T00:00:00Z' } }, // created_at absent
    ];
    // Ascending: stamped ascend, then the three missing keep store order (no-metadata, then
    // null-metadata, then unset-key).
    expect(ids(sortPromptsByMetadata(mixed, { sortField: 'metadata.created_at', sortDir: 'asc' })))
      .to.deep.equal(['stamped-early', 'stamped-late', 'no-metadata', 'null-metadata', 'unset-key']);
    // Descending: stamped descend, missing STILL last (not flipped to the front) and still stable.
    expect(ids(sortPromptsByMetadata(mixed, { sortField: 'metadata.created_at', sortDir: 'desc' })))
      .to.deep.equal(['stamped-late', 'stamped-early', 'no-metadata', 'null-metadata', 'unset-key']);
  });

  it('is a stable sort: equal values keep store order', () => {
    const tied = [
      { id: 'first', metadata: { created_at: '2026-01-01T00:00:00Z' } },
      { id: 'second', metadata: { created_at: '2026-01-01T00:00:00Z' } },
      { id: 'third', metadata: { created_at: '2026-01-01T00:00:00Z' } },
    ];
    expect(ids(sortPromptsByMetadata(tied, { sortField: 'metadata.created_at', sortDir: 'desc' })))
      .to.deep.equal(['first', 'second', 'third']);
  });

  it('does not mutate the input array', () => {
    const input = [...prompts];
    const before = ids(input);
    sortPromptsByMetadata(input, { sortField: 'metadata.created_at', sortDir: 'asc' });
    expect(ids(input)).to.deep.equal(before);
  });

  it('tolerates a non-array input and an empty list', () => {
    expect(sortPromptsByMetadata(undefined, { sortField: 'metadata.created_at' })).to.deep.equal([]);
    expect(sortPromptsByMetadata([], { sortField: 'metadata.created_at' })).to.deep.equal([]);
  });
});
