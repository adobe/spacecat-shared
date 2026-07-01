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
  it('derives a deterministic, url-encoded id from a tag name', () => {
    expect(tagId('brand')).to.equal('tag-brand');
    // the `category:<name>` taxonomy: `:` and spaces are url-encoded so the id is path-safe
    expect(tagId('category:Running Shoes')).to.equal('tag-category%3ARunning%20Shoes');
  });

  it('is stable for the same name (so the two tag-minting routes share one id)', () => {
    expect(tagId('type:branded')).to.equal(tagId('type:branded'));
  });
});
