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
    expect(tagId('category')).to.match(/^tag-[0-9a-f]{16}$/);
    expect(tagId('Running Shoes', 'tag-0123456789abcdef')).to.match(/^tag-[0-9a-f]{16}$/);
  });

  it('is URL-safe: no encoding needed for a path segment or query value', () => {
    // A name with spaces must not need percent-encoding — the whole point of #1760 (the old
    // `tag-${encodeURIComponent(name)}` leaked `%3A`/`%20` into the id). Assert the id is drawn
    // from the URL-safe unreserved set and is a fixed point of encodeURIComponent.
    const id = tagId('Running Shoes', 'tag-0123456789abcdef');
    expect(id).to.match(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(id)).to.equal(id);
  });

  it('is deterministic: the same (parent, name) always yields the same id', () => {
    // Relied on for correlating a standalone tag with the same tag embedded on a prompt (so
    // `by_tags` matches across both).
    expect(tagId('branded', 'tag-type')).to.equal(tagId('branded', 'tag-type'));
    expect(tagId('category')).to.equal(tagId('category'));
  });

  it('maps distinct names under one parent to distinct ids', () => {
    expect(tagId('A', 'tag-root')).to.not.equal(tagId('B', 'tag-root'));
    expect(tagId('brand')).to.not.equal(tagId('Brand'));
  });

  // The reason the id is keyed on the parent at all. Live tag uniqueness is per (project, parent),
  // so two sub-categories named `Pricing` under different categories are two tags. Keying on the
  // name alone would collapse them onto one row and silently corrupt any consumer that trusts the
  // mock — the api-service integration suite among them.
  it('maps the same name under different parents to different ids', () => {
    expect(tagId('Pricing', 'tag-electronics')).to.not.equal(tagId('Pricing', 'tag-furniture'));
  });

  // A sub-category named `human` and the `source` value `human` must coexist on one prompt
  // (model spec §7 gate 4). They share a bare name and differ only by parent.
  it('separates a sub-category from a same-named closed-dimension value', () => {
    expect(tagId('human', 'tag-running-shoes')).to.not.equal(tagId('human', 'tag-source'));
  });

  // Omitting the parent is how a ROOT id is derived — and it is what `POST /aio/prompts/tagged`
  // does, since that endpoint carries names and no parent. An explicit empty parent means the same.
  it('treats an omitted and an empty parent as the same root', () => {
    expect(tagId('category')).to.equal(tagId('category', ''));
  });

  it('distinguishes a root from a child of the same name', () => {
    expect(tagId('human')).to.not.equal(tagId('human', 'tag-source'));
  });

  // The separator makes the preimage unambiguous: without it, ('ab' + '') and ('a' + 'b') would
  // hash identically and two unrelated tags would share an id.
  it('does not let a parent/name boundary shift produce the same id', () => {
    expect(tagId('', 'ab')).to.not.equal(tagId('b', 'a'));
  });
});
