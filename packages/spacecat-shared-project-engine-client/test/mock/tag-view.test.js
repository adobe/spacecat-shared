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

import { buildTagView } from '../../mock/tag-view.js';
import * as factories from '../../mock/factories.js';

// A dimension-root tree: `category` → `Running Shoes` → `human`, plus the `source` value `human`.
// The two `human` tags share a bare name and differ only by parent, which is the collision the
// whole dimension-root model exists to survive.
const CATEGORY_ROOT = 'root-category';
const SOURCE_ROOT = 'root-source';
const RUNNING_SHOES = 'cat-running-shoes';
const SUB_HUMAN = 'sub-human';
const SOURCE_HUMAN = 'source-human';

const tree = () => [
  { id: CATEGORY_ROOT, name: 'category' },
  { id: SOURCE_ROOT, name: 'source' },
  { id: RUNNING_SHOES, name: 'Running Shoes', parent_id: CATEGORY_ROOT },
  { id: SUB_HUMAN, name: 'human', parent_id: RUNNING_SHOES },
  {
    id: SOURCE_HUMAN, name: 'human', parent_id: SOURCE_ROOT, prompts_count: 3,
  },
];

describe('tag-view', () => {
  describe('a ROOT tag', () => {
    it('omits parent_id and path entirely rather than nulling them', () => {
      const { byId } = buildTagView(tree(), factories);
      const root = byId.get(CATEGORY_ROOT);

      expect(root).to.not.have.property('parent_id');
      expect(root).to.not.have.property('path');
      expect(root).to.deep.equal({
        id: CATEGORY_ROOT, name: 'category', children_count: 1, prompts_count: 0,
      });
    });

    it('counts only its DIRECT children', () => {
      const { byId } = buildTagView(tree(), factories);
      // `category` has one direct child (`Running Shoes`), not two — the depth-3
      // `human` hangs off the category, not off the root.
      expect(byId.get(CATEGORY_ROOT).children_count).to.equal(1);
      expect(byId.get(RUNNING_SHOES).children_count).to.equal(1);
      expect(byId.get(SUB_HUMAN).children_count).to.equal(0);
    });
  });

  describe('a DESCENDANT tag', () => {
    it('carries its parent_id and a root-first path excluding itself', () => {
      const { byId } = buildTagView(tree(), factories);
      const depth2 = byId.get(RUNNING_SHOES);

      expect(depth2.parent_id).to.equal(CATEGORY_ROOT);
      expect(depth2.path).to.deep.equal([{ id: CATEGORY_ROOT, name: 'category' }]);
    });

    it('carries the FULL ancestry at depth 3, so path[0] is still the dimension root', () => {
      const { byId } = buildTagView(tree(), factories);
      const depth3 = byId.get(SUB_HUMAN);

      // A breadcrumb truncated to the direct parent would resolve this tag's
      // dimension to `Running Shoes` rather than `category`.
      expect(depth3.path).to.deep.equal([
        { id: CATEGORY_ROOT, name: 'category' },
        { id: RUNNING_SHOES, name: 'Running Shoes', parent_id: CATEGORY_ROOT },
      ]);
      expect(depth3.path[0].name).to.equal('category');
    });

    it('echoes parent_id on every path leaf beyond the root, and on none of the root leaf', () => {
      const { byId } = buildTagView(tree(), factories);
      const [rootLeaf, categoryLeaf] = byId.get(SUB_HUMAN).path;

      expect(rootLeaf).to.not.have.property('parent_id');
      expect(categoryLeaf.parent_id).to.equal(CATEGORY_ROOT);
    });

    it('preserves the stored prompts_count, defaulting to 0', () => {
      const { byId } = buildTagView(tree(), factories);
      expect(byId.get(SOURCE_HUMAN).prompts_count).to.equal(3);
      expect(byId.get(SUB_HUMAN).prompts_count).to.equal(0);
    });
  });

  it('distinguishes two same-named tags by their dimension root', () => {
    const { byId } = buildTagView(tree(), factories);

    expect(byId.get(SUB_HUMAN).name).to.equal(byId.get(SOURCE_HUMAN).name);
    expect(byId.get(SUB_HUMAN).path[0].name).to.equal('category');
    expect(byId.get(SOURCE_HUMAN).path[0].name).to.equal('source');
  });

  it('serialize() answers the same object the byId index holds', () => {
    const stored = tree();
    const { byId, serialize } = buildTagView(stored, factories);
    const subHuman = stored.find((t) => t.id === SUB_HUMAN);

    expect(serialize(subHuman)).to.deep.equal(byId.get(SUB_HUMAN));
  });

  describe('degenerate trees', () => {
    it('treats a tag whose parent is absent from the collection as a root', () => {
      // The parent was deleted between the write and this read; the orphan must
      // still serialize rather than dangle.
      const { byId } = buildTagView([{ id: 'orphan', name: 'Lost', parent_id: 'gone' }], factories);
      const orphan = byId.get('orphan');

      expect(orphan.parent_id).to.equal('gone');
      expect(orphan).to.not.have.property('path');
    });

    // An upstream cycle (a tag reachable as its own ancestor) would otherwise
    // walk the breadcrumb forever.
    it('terminates on a cyclic ancestry rather than looping', () => {
      const { byId } = buildTagView([
        { id: 'a', name: 'A', parent_id: 'b' },
        { id: 'b', name: 'B', parent_id: 'a' },
      ], factories);

      expect(byId.get('a').path).to.deep.equal([{ id: 'b', name: 'B', parent_id: 'a' }]);
    });

    it('returns an empty index for an empty collection', () => {
      const { byId } = buildTagView([], factories);
      expect(byId.size).to.equal(0);
    });
  });
});
