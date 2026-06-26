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
import { createStatefulOps } from '../../mock/stateful.js';
import { createQuota } from '../../mock/quota.js';
import {
  SEEDS,
  DEFAULT_SEED,
  SEED_IDS,
  EMPTY_WORKSPACE,
  buildSeed,
} from '../../mock/seeds.js';
import {
  createProjectAiModelMock, createPromptMock, createBenchmarkMock, createBrandUrlMock,
} from '../../mock/factories.js';

describe('seeds', () => {
  it('exposes named seed sets with a valid default', () => {
    expect(Object.keys(SEEDS)).to.include.members(['empty-workspace', 'workspace-with-data']);
    expect(SEEDS).to.have.property(DEFAULT_SEED);
  });

  it('empty-workspace loads with no projects', () => {
    const store = new InMemoryStore();
    store.load(SEEDS['empty-workspace']);
    const ops = createStatefulOps(store).projects;
    expect(ops.list({ workspaceId: SEED_IDS.workspaceId })).to.have.length(0);
  });

  it('workspace-with-data round-trips through the stateful ops', () => {
    const store = new InMemoryStore();
    store.load(SEEDS['workspace-with-data']);
    const ops = createStatefulOps(store);
    const {
      workspaceId, projectId, benchmarkId,
    } = SEED_IDS;

    expect(ops.projects.list({ workspaceId })).to.have.length(1);
    expect(ops.projects.get({ workspaceId }, projectId)?.name).to.equal('Seeded Project');
    expect(ops.ai_models.list({ workspaceId, projectId })).to.have.length(1);
    expect(ops.prompts.list({ workspaceId, projectId })).to.have.length(1);
    // own-brand benchmark + a brand URL under it
    const benchmarks = ops.benchmarks.list({ workspaceId, projectId });
    expect(benchmarks).to.have.length(1);
    expect(benchmarks[0]).to.include({ id: benchmarkId, main_brand: true });
    expect(ops.brand_urls.list({ workspaceId, projectId, benchmarkId })).to.have.length(1);
  });

  it('reset restores a seed after mutation', () => {
    const store = new InMemoryStore();
    store.load(SEEDS['workspace-with-data']);
    const ops = createStatefulOps(store);
    const { workspaceId, projectId } = SEED_IDS;

    ops.prompts.createMany({ workspaceId, projectId }, [{ text: 'extra' }]);
    expect(ops.prompts.list({ workspaceId, projectId })).to.have.length(2);

    store.reset();
    expect(ops.prompts.list({ workspaceId, projectId })).to.have.length(1);
  });

  it('seed sets are frozen (handed to the store by reference safely)', () => {
    expect(Object.isFrozen(EMPTY_WORKSPACE)).to.equal(true);
    expect(Object.isFrozen(SEEDS)).to.equal(true);
  });
});

describe('buildSeed', () => {
  it('builds a collection-keyed snapshot the stateful ops can read back', () => {
    const workspaceId = 'ws-7';
    const projectId = 'pr-7';
    const snapshot = buildSeed({
      workspaceId,
      projects: [
        {
          id: projectId,
          name: 'Mirror',
          aiModels: [createProjectAiModelMock()],
          prompts: [createPromptMock({ name: 'What is X?' })],
        },
      ],
    });

    const store = new InMemoryStore();
    store.load(snapshot);
    const ops = createStatefulOps(store);
    const scope = { workspaceId, projectId };

    expect(ops.projects.list({ workspaceId })).to.have.length(1);
    // project built via the factory → ProjectResponse shape (id + name, no bogus workspace_id).
    expect(ops.projects.get({ workspaceId }, projectId)?.name).to.equal('Mirror');
    expect(ops.ai_models.list(scope)).to.have.length(1);
    const prompts = ops.prompts.list(scope);
    expect(prompts).to.have.length(1);
    expect(prompts[0].name).to.equal('What is X?');
    expect(prompts[0].tags).to.deep.equal([]); // factory default
  });

  it('seeds benchmarks and brand URLs grouped by benchmark', () => {
    const workspaceId = 'ws-b';
    const projectId = 'pr-b';
    const benchmarkId = 'bm-b';
    const snapshot = buildSeed({
      workspaceId,
      projects: [
        {
          id: projectId,
          name: 'Bench',
          benchmarks: [createBenchmarkMock({ id: benchmarkId, main_brand: true })],
          brandUrls: [
            { benchmarkId, urls: [createBrandUrlMock({ url: 'https://x.example/a' })] },
          ],
        },
      ],
    });

    const store = new InMemoryStore();
    store.load(snapshot);
    const ops = createStatefulOps(store);
    expect(ops.benchmarks.list({ workspaceId, projectId })).to.have.length(1);
    expect(ops.brand_urls.list({ workspaceId, projectId, benchmarkId })).to.have.length(1);
  });

  it('handles an empty workspace (no projects)', () => {
    const snapshot = buildSeed({ workspaceId: 'ws-empty' });
    expect(snapshot).to.deep.equal({ 'projects:ws-empty': [] });
  });

  it('embeds an AI allocation the quota layer reads back', () => {
    const snapshot = buildSeed({ workspaceId: 'ws-q', quota: { projects: 3, prompts: 500 } });
    expect(snapshot.quota).to.deep.equal([{ id: 'ws-q', projects: 3, prompts: 500 }]);
    const store = new InMemoryStore();
    store.load(snapshot);
    const quota = createQuota(store);
    expect(quota.limits('ws-q')).to.deep.equal({ projects: 3, prompts: 500 });
    expect(quota.canCreateProject('ws-q')).to.equal(true);
  });

  it('omits the quota collection when no allocation is given (unlimited default)', () => {
    const snapshot = buildSeed({ workspaceId: 'ws-u' });
    expect(snapshot).to.not.have.property('quota');
  });

  it('defaults an omitted quota dimension to null (unlimited for that dimension)', () => {
    // a present-but-empty quota still creates the record, with both dimensions unlimited
    const snapshot = buildSeed({ workspaceId: 'ws-p', quota: {} });
    expect(snapshot.quota).to.deep.equal([{ id: 'ws-p', projects: null, prompts: null }]);
  });
});
