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
  createAiModelMock,
  createProjectResponseFromRequest,
  createBenchmarkMock,
  createBrandUrlMock,
  createLanguageMock,
  createTagNodeMock,
  createBrandTopicMock,
  createBasicResponseMock,
  createInitStatusMock,
  createCiCompetitorMock,
} from '../../mock/factories.js';

// The .ts type-tests under test/types/ enforce that each factory's return is assignable to its
// component schema; these runtime tests cover the factory bodies (defaults + override merge) so
// coverage stays complete and the live-verified shapes are pinned.
describe('factories — live-shaped entities', () => {
  it('createAiModelMock carries an icon (the live add path returns name + icon)', () => {
    expect(createAiModelMock()).to.include({ key: 'gpt-4o', name: 'GPT-4o', icon: 'openai' });
    expect(createAiModelMock({ icon: 'claude' }).icon).to.equal('claude');
  });

  it('createProjectResponseFromRequest nests a full request under settings.ai (live shape)', () => {
    const p = createProjectResponseFromRequest({
      name: 'Adobe · US · en',
      type: 'ai',
      domain: 'adobe.com',
      brand_names: ['Adobe'],
      brand_name_display: 'Adobe',
      language_id: 'lang-uuid',
      country_code: 'us',
      location_id: 2840,
      location_name: 'United States',
    });
    // identity + draft fields the live API adds (not echoed request fields).
    expect(p.id).to.match(/^[0-9a-f-]{36}$/);
    expect(p).to.include({
      live_id: p.id,
      draft_id: p.id,
      type: 'ai',
      name: 'Adobe · US · en',
      domain: 'adobe.com',
      is_draft: true,
      publish_status: 'draft',
      shared_with: 0,
    });
    // the flat request fields land under settings.ai, NOT at the top level.
    expect(p).to.not.have.any.keys('country_code', 'language_id', 'location_id', 'location_name');
    expect(p.settings.ai).to.deep.include({
      brand_names: ['Adobe'],
      brand_name_display: 'Adobe',
      primary_url: 'adobe.com',
      prompts_count: 0,
      segments_count: 0,
      benchmarks_count: 0,
      products_count: 0,
    });
    expect(p.settings.ai.language).to.deep.equal({ id: 'lang-uuid', name: '' });
    expect(p.settings.ai.country).to.deep.equal({ code: 'us', name: '' });
    expect(p.settings.ai.location).to.deep.equal({ id: 2840, name: 'United States' });
    expect(p.settings.ai.models_stats).to.deep.equal({ models: [], models_count: 0 });
  });

  it('createProjectResponseFromRequest falls back to defaults for an empty request', () => {
    const p = createProjectResponseFromRequest();
    expect(p).to.include({ type: 'ai', name: 'Seeded Project', domain: '' });
    expect(p.settings.ai.brand_names).to.deep.equal([]);
    expect(p.settings.ai.brand_name_display).to.equal('');
    expect(p.settings.ai.language).to.deep.equal({ id: '', name: '' });
    expect(p.settings.ai.country).to.deep.equal({ code: '', name: '' });
    expect(p.settings.ai.location).to.deep.equal({ id: 0, name: '' });
    expect(p.settings.ai.primary_url).to.equal('');
  });

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

  it('createBasicResponseMock defaults to an empty message, overridable', () => {
    expect(createBasicResponseMock()).to.deep.equal({ message: '' });
    expect(createBasicResponseMock({ message: 'done' })).to.deep.equal({ message: 'done' });
  });

  it('createInitStatusMock defaults to not-initialized, overridable', () => {
    expect(createInitStatusMock()).to.deep.equal({ initialized: false });
    expect(createInitStatusMock({ initialized: true })).to.deep.equal({ initialized: true });
  });

  it('createCiCompetitorMock yields a CICompetitor with a real uuid id', () => {
    const c = createCiCompetitorMock();
    expect(c.id).to.match(/^[0-9a-f-]{36}$/);
    expect(c).to.include({ domain: 'competitor.example', color: '' });
    expect(createCiCompetitorMock({ domain: 'x.example', project_id: 'p1' }))
      .to.include({ domain: 'x.example', project_id: 'p1' });
  });
});
