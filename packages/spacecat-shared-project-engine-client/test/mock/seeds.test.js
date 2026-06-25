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
import {
  SEEDS,
  DEFAULT_SEED,
  SEED_IDS,
  EMPTY_WORKSPACE,
} from '../../mock/seeds.js';

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
    const { workspaceId, projectId } = SEED_IDS;

    expect(ops.projects.list({ workspaceId })).to.have.length(1);
    expect(ops.projects.get({ workspaceId }, projectId)?.name).to.equal('Seeded Project');
    expect(ops.ai_models.list({ workspaceId, projectId })).to.have.length(1);
    expect(ops.prompts.list({ workspaceId, projectId })).to.have.length(1);
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
