/*
 * Copyright 2026 Adobe. All rights reserved.
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
  SEEDS, DEFAULT_SEED, SEED_IDS, EMPTY_PARENT, PARENT_WITH_CHILD, buildSeed,
} from '../../mock/seeds.js';
import { WORKSPACES, STATUS_CONTROL } from '../../mock/stateful.js';
import { POOL_COLLECTION } from '../../mock/quota.js';

describe('mock seeds', () => {
  it('exposes the named seed sets and the default', () => {
    expect(Object.keys(SEEDS)).to.have.members(['empty-parent', 'parent-with-child']);
    expect(DEFAULT_SEED).to.equal('parent-with-child');
    expect(SEEDS[DEFAULT_SEED]).to.equal(PARENT_WITH_CHILD);
  });

  it('EMPTY_PARENT has the org parent only', () => {
    expect(EMPTY_PARENT[WORKSPACES]).to.have.length(1);
    expect(EMPTY_PARENT[WORKSPACES][0].id).to.equal(SEED_IDS.parentWorkspaceId);
  });

  it('PARENT_WITH_CHILD links the child to the parent', () => {
    const ids = PARENT_WITH_CHILD[WORKSPACES].map((w) => w.id);
    expect(ids).to.deep.equal([SEED_IDS.parentWorkspaceId, SEED_IDS.childWorkspaceId]);
    const child = PARENT_WITH_CHILD[WORKSPACES][1];
    expect(child.parent_id).to.equal(SEED_IDS.parentWorkspaceId);
    expect(child.status).to.equal('created');
  });

  it('SEED_IDS is frozen and exposes both ids', () => {
    expect(Object.isFrozen(SEED_IDS)).to.equal(true);
    expect(SEED_IDS).to.have.all.keys('parentWorkspaceId', 'childWorkspaceId');
  });

  describe('buildSeed', () => {
    it('returns empty collections with no arguments', () => {
      expect(buildSeed()).to.deep.equal({
        [WORKSPACES]: [], [POOL_COLLECTION]: [], [STATUS_CONTROL]: [],
      });
    });

    it('builds workspaces with defaults and a not-ready budget', () => {
      const seed = buildSeed({
        workspaces: [
          { id: 'w-default' }, // title/parentId/status defaults, no status budget
          {
            id: 'w-full', title: 'Brand', parentId: 'w-default', status: 'created', pendingStatusReads: 2,
          },
        ],
      });
      const [a, b] = seed[WORKSPACES];
      expect(a).to.include({ id: 'w-default', title: 'Workspace w-default', parent_id: '' });
      expect(a.status).to.equal('created');
      expect(b).to.include({ id: 'w-full', title: 'Brand', parent_id: 'w-default' });
      // only the workspace with a positive budget gets a status-control row
      expect(seed[STATUS_CONTROL]).to.deep.equal([{ id: 'w-full', pending: 2 }]);
    });

    it('builds pools with defaulted (unlimited) and explicit dimensions', () => {
      const seed = buildSeed({
        pools: [
          { workspaceId: 'p1' }, // both unlimited
          { workspaceId: 'p2', projects: 3, prompts: 600 },
        ],
      });
      expect(seed[POOL_COLLECTION]).to.deep.equal([
        { id: 'p1', projects: null, prompts: null },
        { id: 'p2', projects: 3, prompts: 600 },
      ]);
    });
  });
});
