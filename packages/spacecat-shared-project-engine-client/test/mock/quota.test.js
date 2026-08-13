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

/** Seeds projects into the workspace + prompts per project id (ids are unique per row). */
function seedUsage(store, { projects = 0, promptsByProject = {} } = {}) {
  for (let i = 0; i < projects; i += 1) {
    store.create(`projects:${WS}`, { id: globalThis.crypto.randomUUID() });
  }
  for (const [pid, count] of Object.entries(promptsByProject)) {
    for (let i = 0; i < count; i += 1) {
      store.create(`prompts:${WS}:${pid}`, { id: globalThis.crypto.randomUUID() });
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
  it('counts projects and prompts across the workspace projects only', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    seedUsage(store, { projects: 2, promptsByProject: { p0: 3, p1: 1 } });
    // a prompt under a DIFFERENT workspace must not count
    store.create('prompts:other-ws:p0', { id: 'x' });
    expect(quota.projectsUsed(WS)).to.equal(2);
    expect(quota.promptsUsed(WS)).to.equal(4);
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

describe('quota — canCreatePrompts (all-or-nothing)', () => {
  it('is unlimited without an allocation or with a null prompts limit', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    expect(quota.canCreatePrompts(WS, 1000)).to.equal(true);
    quota.set(WS, { projects: 1 }); // prompts null
    expect(quota.canCreatePrompts(WS, 1000)).to.equal(true);
  });

  it('allows a batch that fits, rejects one that would exceed', () => {
    const store = new InMemoryStore();
    const quota = createQuota(store);
    quota.set(WS, { prompts: 3 });
    seedUsage(store, { promptsByProject: { p0: 2 } });
    expect(quota.canCreatePrompts(WS, 1)).to.equal(true); // 2 + 1 = 3 <= 3
    expect(quota.canCreatePrompts(WS, 2)).to.equal(false); // 2 + 2 = 4 > 3
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
    seedUsage(store, { projects: 1, promptsByProject: { p0: 2 } });
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
