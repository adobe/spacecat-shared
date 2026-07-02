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

import { expect } from 'chai';
import { tagId } from '../../mock/tag-id.js';

describe('tag-id', () => {
  it('derives an opaque `tag-<16 hex>` id from a tag name', () => {
    // Shape only — the id is an opaque sha256-derived token, not a readable encoding of the name.
    expect(tagId('brand')).to.match(/^tag-[0-9a-f]{16}$/);
    expect(tagId('category:Running Shoes')).to.match(/^tag-[0-9a-f]{16}$/);
  });

  it('is URL-safe: no encoding needed for a path segment or query value', () => {
    // A `category:<name>` with a colon + spaces must not need percent-encoding — the whole point of
    // #1760 (the old `tag-${encodeURIComponent(name)}` leaked `%3A`/`%20` into the id). Assert the
    // id is drawn from the URL-safe unreserved set and is a fixed point of encodeURIComponent.
    const id = tagId('category:Running Shoes');
    expect(id).to.match(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(id)).to.equal(id);
  });

  it('is deterministic: the same name always yields the same id', () => {
    // Relied on for `ops.tags.upsertMany` idempotency-by-name and for correlating a standalone tag
    // with the same tag embedded on a prompt (so `by_tags` matches across both).
    expect(tagId('type:branded')).to.equal(tagId('type:branded'));
    expect(tagId('category:Running Shoes')).to.equal(tagId('category:Running Shoes'));
  });

  it('maps distinct names to distinct ids', () => {
    expect(tagId('category:A')).to.not.equal(tagId('category:B'));
    expect(tagId('brand')).to.not.equal(tagId('Brand'));
  });
});
