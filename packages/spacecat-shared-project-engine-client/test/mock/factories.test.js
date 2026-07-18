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
  createLiveProjectMock,
  createProjectResponseFromRequest,
  applyProjectUpdate,
  createBenchmarkMock,
  createBrandUrlMock,
  createLanguageMock,
  createTagNodeMock,
  createAIOTagMock,
  createAIOTagLeafMock,
  createBrandTopicMock,
  createBasicResponseMock,
  createInitStatusMock,
  createCiCompetitorMock,
  createUrlResolveMock,
  createRenamePromptResponseMock,
} from '../../mock/factories.js';

// The .ts type-tests under test/types/ enforce that each factory's return is assignable to its
// component schema; these runtime tests cover the factory bodies (defaults + override merge) so
// coverage stays complete and the live-verified shapes are pinned.
describe('factories — live-shaped entities', () => {
  it('createAiModelMock defaults to a catalog-valid model (search-gpt) with its icon', () => {
    // The default is the live catalog's ChatGPT/search-gpt entry (id/key/name/icon all from the
    // shared AI_MODEL_CATALOG), so a seeded assignment or add-path fallback is never an
    // unresolvable model chip (#1754 gap 4). `icon` matters — the add path returns name + icon.
    expect(createAiModelMock()).to.include({
      id: 'eab23d14-df70-463f-8779-3f6a4ba770bc', key: 'search-gpt', name: 'ChatGPT', icon: 'openai',
    });
    expect(createAiModelMock({ icon: 'claude' }).icon).to.equal('claude');
  });

  it('createProjectResponseFromRequest nests a full request under settings.ai (live shape)', () => {
    const p = createProjectResponseFromRequest({
      name: 'Adobe · US · en',
      type: 'ai',
      domain: 'adobe.com',
      brand_names: ['Adobe'],
      brand_name_display: 'Adobe',
      language_id: '5a0a33ed-7f5c-4901-befd-a042c0350da1', // catalog "English"
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
    // language.name = ISO code resolved from the catalog id (live read-view shape, #1745), NOT the
    // English display name; country.name = the Intl region name resolved from the code.
    expect(p.settings.ai.language)
      .to.deep.equal({ id: '5a0a33ed-7f5c-4901-befd-a042c0350da1', name: 'en' });
    expect(p.settings.ai.country).to.deep.equal({ code: 'us', name: 'United States' });
    expect(p.settings.ai.location).to.deep.equal({ id: 2840, name: 'United States' });
    expect(p.settings.ai.models_stats).to.deep.equal({ models: [], models_count: 0 });
  });

  it('createProjectResponseFromRequest leaves language/country names empty for an unknown id/code', () => {
    // An unknown language_id (not in the catalog) resolves to '' (id is still echoed). A
    // structurally invalid country code makes Intl.DisplayNames.of throw — caught → ''.
    const p = createProjectResponseFromRequest({ language_id: 'not-a-catalog-id', country_code: 'usa' });
    expect(p.settings.ai.language).to.deep.equal({ id: 'not-a-catalog-id', name: '' });
    expect(p.settings.ai.country).to.deep.equal({ code: 'usa', name: '' });
  });

  it('createProjectResponseFromRequest resolves a non-en catalog language id (e.g. German → de)', () => {
    const p = createProjectResponseFromRequest({
      language_id: 'e5282ae9-83a6-4ea3-b3cf-5e99d8f51eca', // catalog "German"
      country_code: 'de',
    });
    expect(p.settings.ai.language)
      .to.deep.equal({ id: 'e5282ae9-83a6-4ea3-b3cf-5e99d8f51eca', name: 'de' });
    expect(p.settings.ai.country).to.deep.equal({ code: 'de', name: 'Germany' });
  });

  it('createProjectResponseFromRequest falls back to defaults for an empty request', () => {
    const p = createProjectResponseFromRequest();
    expect(p).to.include({ type: 'ai', name: 'Seeded Project', domain: '' });
    // Live echoes null (not [] / '') for an omitted brand_names / location_name (2026-06-29).
    expect(p.settings.ai.brand_names).to.equal(null);
    expect(p.settings.ai.brand_name_display).to.equal('');
    expect(p.settings.ai.language).to.deep.equal({ id: '', name: '' });
    expect(p.settings.ai.country).to.deep.equal({ code: '', name: '' });
    expect(p.settings.ai.location).to.deep.equal({ id: 0, name: null });
    expect(p.settings.ai.primary_url).to.equal('');
  });

  it('createLiveProjectMock defaults to a live, market-less project (no request)', () => {
    const p = createLiveProjectMock();
    expect(p.id).to.match(/^[0-9a-f-]{36}$/);
    // live, not a draft — the seed/default side of #1754 gap 3.
    expect(p).to.include({
      live_id: p.id,
      draft_id: p.id,
      type: 'ai',
      name: 'Seeded Project',
      domain: '',
      // is_draft stays true even when live — the publish route flips only publish_status.
      is_draft: true,
      publish_status: 'live',
      published_at: '2026-01-01T00:00:00Z',
      shared_with: 0,
    });
    // empty request → empty settings.ai, so it has no resolvable geo/lang (caller supplies one).
    expect(p.settings.ai).to.deep.include({ primary_url: '', prompts_count: 0 });
    expect(p.settings.ai.language).to.deep.equal({ id: '', name: '' });
  });

  it('createLiveProjectMock builds a resolvable live market from a request (US/en)', () => {
    const p = createLiveProjectMock({
      id: 'b8c9d0e1-f2a3-4b4c-8d5e-7f8091021324',
      type: 'ai',
      name: 'Seeded Project',
      domain: 'example.com',
      brand_names: ['Seeded Brand'],
      brand_name_display: 'Seeded Brand',
      language_id: '5a0a33ed-7f5c-4901-befd-a042c0350da1', // catalog English → en
      country_code: 'us',
      location_id: 2840,
      location_name: 'United States',
      published_at: '2030-06-01T00:00:00Z',
    });
    expect(p).to.include({
      id: 'b8c9d0e1-f2a3-4b4c-8d5e-7f8091021324',
      live_id: 'b8c9d0e1-f2a3-4b4c-8d5e-7f8091021324',
      publish_status: 'live',
      is_draft: true,
      domain: 'example.com',
      published_at: '2030-06-01T00:00:00Z',
    });
    // geo (location.id) + language.name (ISO) are the load-bearing fields api-service's listMarkets
    // reads to keep the project as an addressable market.
    expect(p.settings.ai.location.id).to.equal(2840);
    expect(p.settings.ai.language).to.deep.equal({ id: '5a0a33ed-7f5c-4901-befd-a042c0350da1', name: 'en' });
    expect(p.settings.ai.country).to.deep.equal({ code: 'us', name: 'United States' });
  });

  it('applyProjectUpdate nests brand fields under settings.ai and keeps name/type/domain top-level', () => {
    const stored = createProjectResponseFromRequest({ name: 'Before', type: 'ai', domain: 'a.com' });
    const updated = applyProjectUpdate(stored, {
      name: 'After',
      type: 'ai',
      domain: 'b.com',
      brand_name_display: 'Acme Renamed',
      brand_names: ['Acme', 'Acme Inc'],
    });
    expect(updated).to.include({ name: 'After', type: 'ai', domain: 'b.com' });
    // brand fields land under settings.ai (live shape), not at the top level.
    expect(updated.settings.ai).to.include({ brand_name_display: 'Acme Renamed' });
    expect(updated.settings.ai.brand_names).to.deep.equal(['Acme', 'Acme Inc']);
    expect(updated).to.not.have.property('brand_name_display');
    expect(updated).to.not.have.property('brand_names');
    // untouched stored counts are preserved.
    expect(updated.settings.ai.prompts_count).to.equal(0);
  });

  it('applyProjectUpdate leaves the stored draft unchanged for an empty patch', () => {
    const stored = createProjectResponseFromRequest({ name: 'Keep', brand_name_display: 'Keep Co' });
    const updated = applyProjectUpdate(stored, {});
    expect(updated.name).to.equal('Keep');
    expect(updated.settings.ai.brand_name_display).to.equal('Keep Co');
  });

  it('applyProjectUpdate tolerates a stored entity with no settings', () => {
    const updated = applyProjectUpdate({ id: 'p1', name: 'No Settings' }, {
      brand_names: ['X'],
    });
    expect(updated.settings.ai.brand_names).to.deep.equal(['X']);
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

  it('createBenchmarkMock carries the live-only fields: project_id + primary_url/root_domain (CR10)', () => {
    // Live always returns these (verified 2026-06-25); primary_url/root_domain mirror the domain.
    const def = createBenchmarkMock();
    expect(def).to.include({ project_id: '', primary_url: 'competitor.example', root_domain: 'competitor.example' });
    // they track the effective domain by default…
    expect(createBenchmarkMock({ domain: 'adobe.com' }))
      .to.include({ primary_url: 'adobe.com', root_domain: 'adobe.com' });
    // …but an explicit override still wins.
    expect(createBenchmarkMock({ domain: 'adobe.com', primary_url: 'www.adobe.com', project_id: 'p1' }))
      .to.include({ primary_url: 'www.adobe.com', root_domain: 'adobe.com', project_id: 'p1' });
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
    const t = createTagNodeMock({ name: 'Probe' });
    expect(t).to.include({ name: 'Probe', children_count: 0, keyword_count: 0 });
  });

  it('createAIOTagMock yields an AIOTag (prompts_count, not keyword_count)', () => {
    const t = createAIOTagMock({ id: 'tag-x', name: 'Probe' });
    expect(t).to.deep.equal({
      id: 'tag-x', name: 'Probe', children_count: 0, prompts_count: 0,
    });
  });

  it('createAIOTagMock omits parent_id/path by default (a root has none)', () => {
    const root = createAIOTagMock();
    expect(root).to.not.have.property('parent_id');
    expect(root).to.not.have.property('path');
  });

  it('createAIOTagMock models a child via parent_id + path override', () => {
    const child = createAIOTagMock({
      id: 'tag-child',
      name: 'Trail',
      parent_id: 'tag-root',
      path: [createAIOTagLeafMock({ id: 'tag-root', name: 'Running Shoes' })],
    });
    expect(child).to.include({ id: 'tag-child', name: 'Trail', parent_id: 'tag-root' });
    // the path leaf is { id, name } — live does not echo parent_id on the breadcrumb
    expect(child.path).to.deep.equal([{ id: 'tag-root', name: 'Running Shoes' }]);
  });

  it('createAIOTagLeafMock yields an AIOTagLeaf { id, name } (no parent_id, matching live)', () => {
    const leaf = createAIOTagLeafMock({ id: 'tag-root', name: 'Running Shoes' });
    expect(leaf).to.deep.equal({ id: 'tag-root', name: 'Running Shoes' });
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

  it('createUrlResolveMock defaults to the live invalid/empty shape, overridable', () => {
    // The default IS the live is_valid:false case (empty domain/primary_url, still HTTP 200); the
    // route handler passes resolveUrl overrides for a valid input and nothing for an invalid one.
    const valid = { domain: 'lovesac.com', primary_url: 'lovesac.com', is_valid: true };
    expect(createUrlResolveMock()).to.deep.equal({ domain: '', primary_url: '', is_valid: false });
    expect(createUrlResolveMock(valid)).to.deep.equal(valid);
  });

  it('createRenamePromptResponseMock yields the id-stable rename result, overridable', () => {
    const r = createRenamePromptResponseMock();
    expect(r.id).to.match(/^[0-9a-f-]{36}$/);
    expect(r).to.include({ name: 'What is the best running shoe?', is_updated: true });
    // The rename handler echoes the stored prompt's UNCHANGED id, and is_updated: false for a
    // no-op rename (unchanged name).
    expect(createRenamePromptResponseMock({ id: 'p1', name: 'Same text', is_updated: false }))
      .to.deep.equal({ id: 'p1', name: 'Same text', is_updated: false });
  });
});
