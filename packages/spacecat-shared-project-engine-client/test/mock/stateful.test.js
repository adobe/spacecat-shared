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
import {
  STATEFUL_RESOURCES,
  collectionKey,
  createStatefulOps,
} from '../../mock/stateful.js';

describe('stateful — confirmed resource set', () => {
  it('is projects, ai_models, prompts, benchmarks, tags, brand_urls (live-audited surface)', () => {
    expect([...STATEFUL_RESOURCES]).to.deep.equal([
      'projects', 'ai_models', 'prompts', 'benchmarks', 'tags', 'brand_urls',
    ]);
  });
});

describe('stateful — collectionKey scoping', () => {
  it('scopes projects per workspace', () => {
    expect(collectionKey('projects', { workspaceId: 'w1' })).to.equal('projects:w1');
  });

  it('scopes ai_models, prompts, benchmarks and tags per project', () => {
    expect(collectionKey('ai_models', { workspaceId: 'w1', projectId: 'p1' })).to.equal('ai_models:w1:p1');
    expect(collectionKey('prompts', { workspaceId: 'w1', projectId: 'p1' })).to.equal('prompts:w1:p1');
    expect(collectionKey('benchmarks', { workspaceId: 'w1', projectId: 'p1' })).to.equal('benchmarks:w1:p1');
    expect(collectionKey('tags', { workspaceId: 'w1', projectId: 'p1' })).to.equal('tags:w1:p1');
  });

  it('scopes brand_urls per benchmark (within a project)', () => {
    expect(collectionKey('brand_urls', { workspaceId: 'w1', projectId: 'p1', benchmarkId: 'b1' }))
      .to.equal('brand_urls:w1:p1:b1');
  });

  it('keeps two workspaces from sharing project state', () => {
    expect(collectionKey('projects', { workspaceId: 'w1' }))
      .to.not.equal(collectionKey('projects', { workspaceId: 'w2' }));
  });
});

describe('stateful — projects ops', () => {
  const ws = { workspaceId: 'w1' };

  it('creates, lists, gets, updates and removes a project', () => {
    const ops = createStatefulOps(new InMemoryStore()).projects;
    const created = ops.create(ws, { id: 'p1', name: 'A' });
    expect(created).to.include({ id: 'p1', name: 'A' });
    expect(ops.list(ws)).to.have.length(1);
    expect(ops.get(ws, 'p1')?.name).to.equal('A');
    expect(ops.update(ws, 'p1', { name: 'B' })?.name).to.equal('B');
    expect(ops.update(ws, 'missing', { name: 'X' })).to.equal(undefined);
    expect(ops.remove(ws, 'p1')).to.equal(true);
    expect(ops.get(ws, 'p1')).to.equal(undefined);
  });

  it('isolates projects across workspaces', () => {
    const ops = createStatefulOps(new InMemoryStore()).projects;
    ops.create({ workspaceId: 'w1' }, { id: 'p1' });
    expect(ops.list({ workspaceId: 'w2' })).to.have.length(0);
  });
});

describe('stateful — ai_models ops', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1' };

  it('adds, lists and bulk-removes models, reporting the removed count', () => {
    const ops = createStatefulOps(new InMemoryStore()).ai_models;
    ops.add(scope, { id: 'm1', name: 'gpt-4o' });
    ops.add(scope, { id: 'm2', name: 'claude' });
    expect(ops.list(scope)).to.have.length(2);
    expect(ops.removeMany(scope, ['m1', 'missing'])).to.equal(1);
    expect(ops.list(scope)).to.have.length(1);
  });
});

describe('stateful — prompts ops', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1' };

  it('creates many, lists with a predicate and bulk-removes', () => {
    const ops = createStatefulOps(new InMemoryStore()).prompts;
    const created = ops.createMany(scope, [{ text: 'a' }, { text: 'b' }]);
    expect(created).to.have.length(2);
    expect(ops.list(scope)).to.have.length(2);
    expect(ops.list(scope, (e) => e.text === 'a')).to.have.length(1);
    expect(ops.removeMany(scope, [...created.map((e) => e.id), 'missing'])).to.equal(2);
    expect(ops.list(scope)).to.have.length(0);
  });
});

describe('stateful — benchmarks ops', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1' };

  it('creates many, lists, updates in place and bulk-removes', () => {
    const ops = createStatefulOps(new InMemoryStore()).benchmarks;
    const created = ops.createMany(scope, [
      { brand_name: 'Comp A', domain: 'a.example' },
      { brand_name: 'Comp B', domain: 'b.example' },
    ]);
    expect(created).to.have.length(2);
    expect(ops.list(scope)).to.have.length(2);
    expect(ops.update(scope, created[0].id, { brand_aliases: ['A'] })?.brand_aliases).to.deep.equal(['A']);
    expect(ops.update(scope, 'missing', { brand_aliases: ['X'] })).to.equal(undefined);
    expect(ops.removeMany(scope, [created[0].id, 'missing'])).to.equal(1);
    expect(ops.list(scope)).to.have.length(1);
  });

  it('isolates benchmarks across projects', () => {
    const ops = createStatefulOps(new InMemoryStore()).benchmarks;
    ops.createMany({ workspaceId: 'w1', projectId: 'p1' }, [{ domain: 'a.example' }]);
    expect(ops.list({ workspaceId: 'w1', projectId: 'p2' })).to.have.length(0);
  });
});

describe('stateful — tags ops', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1' };

  it('upserts idempotently (reuses an existing id), lists and bulk-removes', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    const created = ops.upsertMany(scope, [
      { id: 'tag-a', name: 'category:A' },
      { id: 'tag-b', name: 'category:B' },
    ]);
    expect(created).to.have.length(2);
    expect(ops.list(scope)).to.have.length(2);
    // a repeated upsert of an existing id reuses the stored tag — no duplicate, no throw
    const again = ops.upsertMany(scope, [
      { id: 'tag-a', name: 'category:A' },
      { id: 'tag-c', name: 'category:C' },
    ]);
    expect(again.map((t) => t.id)).to.deep.equal(['tag-a', 'tag-c']);
    expect(ops.list(scope)).to.have.length(3);
    expect(ops.removeMany(scope, ['tag-a', 'missing'])).to.equal(1);
    expect(ops.list(scope)).to.have.length(2);
  });

  it('isolates tags across projects (the multi-market scoping invariant)', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    ops.upsertMany({ workspaceId: 'w1', projectId: 'p1' }, [{ id: 'tag-a', name: 'category:A' }]);
    expect(ops.list({ workspaceId: 'w1', projectId: 'p2' })).to.have.length(0);
  });

  it('re-parents / renames a tag in place, keeping the id stable', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    ops.upsertMany(scope, [
      { id: 'tag-root', name: 'category:Root' },
      { id: 'tag-child', name: 'Child' },
    ]);
    // re-parent the child under the root
    const parented = ops.update(scope, 'tag-child', { name: 'Child', parent_id: 'tag-root' });
    expect(parented).to.include({ id: 'tag-child', name: 'Child', parent_id: 'tag-root' });
    // promote back to a root (parent_id cleared to '')
    const promoted = ops.update(scope, 'tag-child', { name: 'Child', parent_id: '' });
    expect(promoted).to.include({ id: 'tag-child', parent_id: '' });
  });

  it('returns undefined when updating an unknown tag id', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    expect(ops.update(scope, 'missing', { name: 'x', parent_id: '' })).to.equal(undefined);
  });
});

describe('stateful — brand_urls ops', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1', benchmarkId: 'b1' };

  it('creates many, lists and bulk-removes, scoped per benchmark', () => {
    const ops = createStatefulOps(new InMemoryStore()).brand_urls;
    const created = ops.createMany(scope, [{ url: 'https://x.example', type: 'own' }]);
    expect(created).to.have.length(1);
    expect(ops.list(scope)).to.have.length(1);
    // a different benchmark under the same project does not see these urls
    expect(ops.list({ ...scope, benchmarkId: 'b2' })).to.have.length(0);
    expect(ops.removeMany(scope, [created[0].id, 'missing'])).to.equal(1);
    expect(ops.list(scope)).to.have.length(0);
  });
});
