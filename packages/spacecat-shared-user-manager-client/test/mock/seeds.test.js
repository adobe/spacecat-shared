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
  SEEDS, DEFAULT_SEED, SEED_IDS, EMPTY_PARENT, PARENT_WITH_CHILD, PARENT_WITH_CHILD_METERED,
  TWO_HIERARCHIES, buildSeed,
} from '../../mock/seeds.js';
import { WORKSPACES, STATUS_CONTROL } from '../../mock/stateful.js';
import { RESOURCES_COLLECTION } from '../../mock/quota.js';

const dim = (used, drafted, total) => ({ used, drafted, total });

describe('mock seeds', () => {
  it('exposes the named seed sets and the default', () => {
    expect(Object.keys(SEEDS))
      .to.have.members(['empty-parent', 'parent-with-child', 'parent-with-child-metered', 'two-hierarchies']);
    expect(DEFAULT_SEED).to.equal('parent-with-child');
    expect(SEEDS[DEFAULT_SEED]).to.equal(PARENT_WITH_CHILD);
  });

  it('PARENT_WITH_CHILD_METERED seeds finite resources on the parent and child', () => {
    expect(PARENT_WITH_CHILD_METERED[WORKSPACES].map((w) => w.id))
      .to.deep.equal([SEED_IDS.parentWorkspaceId, SEED_IDS.childWorkspaceId]);
    const res = PARENT_WITH_CHILD_METERED[RESOURCES_COLLECTION];
    expect(res).to.deep.equal([
      {
        id: SEED_IDS.parentWorkspaceId,
        ai: { projects: dim(0, 0, 11), prompts: dim(0, 0, 700), weekly_prompts: dim(0, 0, 0) },
      },
      {
        id: SEED_IDS.childWorkspaceId,
        ai: { projects: dim(0, 0, 2), prompts: dim(0, 0, 100), weekly_prompts: dim(0, 0, 0) },
      },
    ]);
  });

  it('TWO_HIERARCHIES links two independent parent→child families', () => {
    const ws = TWO_HIERARCHIES[WORKSPACES];
    expect(ws).to.have.length(4);
    const ids = ws.map((w) => w.id);
    expect(ids).to.deep.equal([
      SEED_IDS.parentWorkspaceId, SEED_IDS.childWorkspaceId,
      SEED_IDS.secondParentWorkspaceId, SEED_IDS.secondChildWorkspaceId,
    ]);
    // each child links to its OWN parent (never the other hierarchy's).
    expect(ws[1].parent_id).to.equal(SEED_IDS.parentWorkspaceId);
    expect(ws[3].parent_id).to.equal(SEED_IDS.secondParentWorkspaceId);
    // roots have no parent.
    expect(ws[0].parent_id).to.equal('');
    expect(ws[2].parent_id).to.equal('');
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

  it('SEED_IDS is frozen and exposes both hierarchies ids', () => {
    expect(Object.isFrozen(SEED_IDS)).to.equal(true);
    expect(SEED_IDS).to.have.all.keys('parentWorkspaceId', 'childWorkspaceId', 'secondParentWorkspaceId', 'secondChildWorkspaceId');
  });

  describe('buildSeed', () => {
    it('returns empty collections with no arguments', () => {
      expect(buildSeed()).to.deep.equal({
        [WORKSPACES]: [], [RESOURCES_COLLECTION]: [], [STATUS_CONTROL]: [],
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

    it('builds resources with defaulted (zeroed), bare-number, and object dimensions', () => {
      const seed = buildSeed({
        resources: [
          { workspaceId: 'r1' }, // both dimensions default to a zeroed triple
          { workspaceId: 'r2', projects: 3, prompts: { used: 10, total: 600 } },
        ],
      });
      expect(seed[RESOURCES_COLLECTION]).to.deep.equal([
        { id: 'r1', ai: { projects: dim(0, 0, 0), prompts: dim(0, 0, 0), weekly_prompts: dim(0, 0, 0) } },
        { id: 'r2', ai: { projects: dim(0, 0, 3), prompts: dim(10, 0, 600), weekly_prompts: dim(0, 0, 0) } },
      ]);
    });
  });
});
