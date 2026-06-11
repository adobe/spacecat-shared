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
import { InMemoryStore } from '../../src/mock/store.js';
import {
  STATEFUL_RESOURCES,
  collectionKey,
  createStatefulOps,
} from '../../src/mock/stateful.js';

describe('stateful — confirmed resource set', () => {
  it('is exactly projects, ai_models, prompts (the spike first cut)', () => {
    expect([...STATEFUL_RESOURCES]).to.deep.equal(['projects', 'ai_models', 'prompts']);
  });
});

describe('stateful — collectionKey scoping', () => {
  it('scopes projects per workspace', () => {
    expect(collectionKey('projects', { workspaceId: 'w1' })).to.equal('projects:w1');
  });

  it('scopes ai_models and prompts per project', () => {
    expect(collectionKey('ai_models', { workspaceId: 'w1', projectId: 'p1' })).to.equal('ai_models:w1:p1');
    expect(collectionKey('prompts', { workspaceId: 'w1', projectId: 'p1' })).to.equal('prompts:w1:p1');
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
