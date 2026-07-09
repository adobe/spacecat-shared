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
import { InMemoryStore } from '../../mock/store.js';
import { createQuota, QUOTA_COLLECTION } from '../../mock/quota.js';

const WS = 'ws-1';

/**
 * Seeds projects into the workspace + prompts and attached models per project id (ids unique per
 * row). Prompt UNITS are `texts × models` per project, so a project needs BOTH prompts and models
 * seeded to consume units.
 */
function seedUsage(store, { projects = 0, promptsByProject = {}, modelsByProject = {} } = {}) {
  for (let i = 0; i < projects; i += 1) {
    store.create(`projects:${WS}`, { id: globalThis.crypto.randomUUID() });
  }
  for (const [pid, count] of Object.entries(promptsByProject)) {
    for (let i = 0; i < count; i += 1) {
      store.create(`prompts:${WS}:${pid}`, { id: globalThis.crypto.randomUUID() });
    }
  }
  for (const [pid, count] of Object.entries(modelsByProject)) {
    for (let i = 0; i < count; i += 1) {
      store.create(`ai_models:${WS}:${pid}`, { id: globalThis.crypto.randomUUID() });
    }
  }
}

describe('quota — allocation set/get', () => {
  it('set creates a record, and re-set updates it (absolute, not additive)', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    expect(quota.set(WS, { projects: 3, prompts: 100 }))
      .to.deep.equal({ id: WS, projects: 3, prompts: 100 });
    expect(quota.limits(WS)).to.deep.equal({ projects: 3, prompts: 100 });
    // re-set updates the existing record
    quota.set(WS, { projects: 5, prompts: 0 });
    expect(quota.limits(WS)).to.deep.equal({ projects: 5, prompts: 0 });
  });

  it('an omitted/non-number dimension is unlimited (null)', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    quota.set(WS, { projects: 2 });
    expect(quota.limits(WS)).to.deep.equal({ projects: 2, prompts: null });
    quota.set(WS, {});
    expect(quota.limits(WS)).to.deep.equal({ projects: null, prompts: null });
  });

  it('limits() is null for a workspace with no allocation', () => {
    const quota = createQuota(new InMemoryStore());
    expect(quota.limits('unknown')).to.equal(null);
  });
});

describe('quota — usage derived from the store', () => {
  it('prompt usage is Σ_project (texts × models), summed across the workspace projects only', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    // p0: 3 texts × 2 models = 6; p1: 1 text × 3 models = 3 → total 9.
    seedUsage(store, {
      projects: 2, promptsByProject: { p0: 3, p1: 1 }, modelsByProject: { p0: 2, p1: 3 },
    });
    // a prompt under a DIFFERENT workspace must not count
    store.create('prompts:other-ws:p0', { id: 'x' });
    expect(quota.projectsUsed(WS)).to.equal(2);
    expect(quota.modelsUsed(WS, 'p0')).to.equal(2);
    expect(quota.promptsUsed(WS)).to.equal(9);
  });

  it('a project with texts but ZERO models consumes zero prompt units', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    // p0: 5 texts, 0 models → 0 units; p1: 2 texts × 1 model → 2 units.
    seedUsage(store, { promptsByProject: { p0: 5, p1: 2 }, modelsByProject: { p1: 1 } });
    expect(quota.modelsUsed(WS, 'p0')).to.equal(0);
    expect(quota.promptsUsed(WS)).to.equal(2);
  });
});

describe('quota — canCreateProject', () => {
  it('is unlimited without an allocation or with a null projects limit', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    seedUsage(store, { projects: 100 });
    expect(quota.canCreateProject(WS)).to.equal(true); // no allocation
    quota.set(WS, { prompts: 5 }); // projects null
    expect(quota.canCreateProject(WS)).to.equal(true);
  });

  it('allows while used < limit, rejects at the limit', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    quota.set(WS, { projects: 2 });
    expect(quota.canCreateProject(WS)).to.equal(true);
    seedUsage(store, { projects: 1 });
    expect(quota.canCreateProject(WS)).to.equal(true);
    seedUsage(store, { projects: 1 }); // now 2 used
    expect(quota.canCreateProject(WS)).to.equal(false);
  });
});

describe('quota — canCreatePrompts (all-or-nothing, texts × models)', () => {
  it('is unlimited without an allocation or with a null prompts limit', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    expect(quota.canCreatePrompts(WS, 'p0', 1000)).to.equal(true);
    quota.set(WS, { projects: 1 }); // prompts null
    expect(quota.canCreatePrompts(WS, 'p0', 1000)).to.equal(true);
  });

  it('sizes the batch by the project model count: allows what fits, rejects what exceeds', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    quota.set(WS, { prompts: 10 });
    // p0: 2 texts × 2 models = 4 used. Each NEW text costs 2 units (2 models).
    seedUsage(store, { promptsByProject: { p0: 2 }, modelsByProject: { p0: 2 } });
    expect(quota.canCreatePrompts(WS, 'p0', 3)).to.equal(true); // 4 + 3×2 = 10 <= 10
    expect(quota.canCreatePrompts(WS, 'p0', 4)).to.equal(false); // 4 + 4×2 = 12 > 10
  });

  it('texts on a project with zero models are free (never rejected)', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    quota.set(WS, { prompts: 1 });
    // p0 has no models → each text costs 0 units.
    expect(quota.canCreatePrompts(WS, 'p0', 1000)).to.equal(true);
  });
});

describe('quota — canAddModel (attach re-meters existing texts)', () => {
  it('is unlimited without an allocation or with a null prompts limit', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    expect(quota.canAddModel(WS, 'p0')).to.equal(true);
    quota.set(WS, { projects: 1 }); // prompts null
    expect(quota.canAddModel(WS, 'p0')).to.equal(true);
  });

  it('a new model costs the project its text count; 405s when that exceeds the allocation', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    // p0: 3 texts × 1 model = 3 used. Adding a 2nd model re-meters the 3 texts → +3 → 6.
    seedUsage(store, { promptsByProject: { p0: 3 }, modelsByProject: { p0: 1 } });
    quota.set(WS, { prompts: 5 });
    expect(quota.canAddModel(WS, 'p0')).to.equal(false); // 3 + 3 = 6 > 5
    quota.set(WS, { prompts: 6 });
    expect(quota.canAddModel(WS, 'p0')).to.equal(true); // 3 + 3 = 6 <= 6
  });
});

describe('quota — canPublish', () => {
  it('is allowed when unlimited or units > 0, blocked at 0 (empty-units child)', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    expect(quota.canPublish(WS)).to.equal(true); // no allocation
    quota.set(WS, { prompts: 500 });
    expect(quota.canPublish(WS)).to.equal(true);
    quota.set(WS, { prompts: 0 });
    expect(quota.canPublish(WS)).to.equal(false);
  });
});

describe('quota — usage()', () => {
  it('reports limits + live usage (and nulls when unallocated)', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    // p0: 2 texts × 1 model = 2 prompt units.
    seedUsage(store, { projects: 1, promptsByProject: { p0: 2 }, modelsByProject: { p0: 1 } });
    expect(quota.usage(WS)).to.deep.equal({
      workspaceId: WS,
      projects: { limit: null, used: 1 },
      prompts: { limit: null, used: 2 },
    });
    quota.set(WS, { projects: 5, prompts: 10 });
    expect(quota.usage(WS)).to.deep.equal({
      workspaceId: WS,
      projects: { limit: 5, used: 1 },
      prompts: { limit: 10, used: 2 },
    });
  });
});

describe('quota — QUOTA_COLLECTION export', () => {
  it('names the exact store collection quota rows are written to and read from', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    quota.set('ws-z', { projects: 5, prompts: 100 });
    // Proves the constant is wired to the store, not just that it equals a string literal.
    const [row] = store.list(QUOTA_COLLECTION);
    expect(row).to.include({ id: 'ws-z', projects: 5, prompts: 100 });
  });
});
