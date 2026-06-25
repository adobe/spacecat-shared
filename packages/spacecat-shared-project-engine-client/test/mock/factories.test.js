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
import {
  createBenchmarkMock,
  createBrandUrlMock,
  createLanguageMock,
  createTagNodeMock,
  createBrandTopicMock,
} from '../../mock/factories.js';

// The .ts type-tests under test/types/ enforce that each factory's return is assignable to its
// component schema; these runtime tests cover the factory bodies (defaults + override merge) so
// coverage stays complete and the live-verified shapes are pinned.
describe('factories — live-shaped entities', () => {
  it('createBenchmarkMock defaults to a competitor benchmark with a real uuid id', () => {
    const b = createBenchmarkMock();
    expect(b.id).to.match(/^[0-9a-f-]{36}$/);
    expect(b).to.include({ main_brand: false });
    expect(b.brand_aliases).to.deep.equal([]);
    // overrides win (e.g. the own-brand benchmark)
    expect(createBenchmarkMock({ main_brand: true, domain: 'x.example' }))
      .to.include({ main_brand: true, domain: 'x.example' });
  });

  it('createBrandUrlMock defaults to an own-type url', () => {
    const u = createBrandUrlMock();
    expect(u.id).to.match(/^[0-9a-f-]{36}$/);
    expect(u).to.include({ type: 'own' });
    expect(createBrandUrlMock({ type: 'social' }).type).to.equal('social');
  });

  it('createLanguageMock yields { id, name }', () => {
    const l = createLanguageMock({ name: 'German' });
    expect(l).to.have.keys(['id', 'name']);
    expect(l.name).to.equal('German');
  });

  it('createTagNodeMock yields a TreeNodeResponse', () => {
    const t = createTagNodeMock({ name: 'topic:Probe' });
    expect(t).to.include({ name: 'topic:Probe', children_count: 0, keyword_count: 0 });
  });

  it('createBrandTopicMock yields { topic, volume, prompts }', () => {
    const t = createBrandTopicMock({ topic: 'Hydration', volume: 42, prompts: ['a'] });
    expect(t).to.deep.equal({ topic: 'Hydration', volume: 42, prompts: ['a'] });
  });
});
