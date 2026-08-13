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
import { AI_MODEL_CATALOG, findCatalogEntryByKey } from '../../mock/ai-model-catalog.js';

describe('ai-model-catalog', () => {
  it('findCatalogEntryByKey returns the matching catalog entry', () => {
    const entry = findCatalogEntryByKey('search-gpt');
    expect(entry).to.deep.equal({
      id: 'eab23d14-df70-463f-8779-3f6a4ba770bc',
      name: 'ChatGPT',
      key: 'search-gpt',
      icon: 'openai',
    });
    // it returns the actual frozen catalog entry (single source of truth), not a copy.
    expect(entry).to.equal(AI_MODEL_CATALOG.find((m) => m.key === 'search-gpt'));
  });

  it('findCatalogEntryByKey throws loudly on an unknown key (fail-fast, no silent default)', () => {
    expect(() => findCatalogEntryByKey('gpt-4o')).to.throw('Unknown AI model catalog key: gpt-4o');
  });
});
