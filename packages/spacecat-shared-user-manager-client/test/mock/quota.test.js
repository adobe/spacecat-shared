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
import { InMemoryStore } from '../../mock/store.js';
import { createQuota, RESOURCES_COLLECTION, AI_DIMS } from '../../mock/quota.js';

const dim = (used, drafted, total) => ({ used, drafted, total });

function setup() {
  const store = new InMemoryStore();
  return { store, quota: createQuota(store) };
}

describe('mock quota — per-workspace AI resource accounting', () => {
  it('exports the resources collection name and the AI dimensions', () => {
    expect(RESOURCES_COLLECTION).to.equal('workspace_resources');
    expect([...AI_DIMS]).to.deep.equal(['projects', 'prompts']);
  });

  describe('resources', () => {
    it('returns null for an unmetered workspace, the ai record once set', () => {
      const { quota } = setup();
      expect(quota.resources('w')).to.equal(null);
      quota.set('w', { projects: 5, prompts: 100 });
      expect(quota.resources('w')).to.deep.equal({
        projects: dim(0, 0, 5),
        prompts: dim(0, 0, 100),
        weekly_prompts: dim(0, 0, 0),
      });
    });
  });

  describe('set / applyDim', () => {
    it('creates then updates; a bare number sets total, an object sets used/drafted/total', () => {
      const { quota, store } = setup();
      // create branch — bare numbers → total, used/drafted default 0
      quota.set('w', { projects: 3, prompts: 50 });
      expect(store.get(RESOURCES_COLLECTION, 'w').ai.projects).to.deep.equal(dim(0, 0, 3));
      // update branch — object with only `used`; other dims/fields preserved
      quota.set('w', { projects: { used: 1 } });
      expect(quota.resources('w').projects).to.deep.equal(dim(1, 0, 3));
      // object with only `drafted`, and only `total`
      quota.set('w', { projects: { drafted: 2 } });
      expect(quota.resources('w').projects).to.deep.equal(dim(1, 2, 3));
      quota.set('w', { projects: { total: 9 } });
      expect(quota.resources('w').projects).to.deep.equal(dim(1, 2, 9));
      // full object
      quota.set('w', { prompts: { used: 4, drafted: 5, total: 60 } });
      expect(quota.resources('w').prompts).to.deep.equal(dim(4, 5, 60));
      // omitted dimension is left untouched (applyDim null branch)
      quota.set('w', {});
      expect(quota.resources('w')).to.deep.equal({
        projects: dim(1, 2, 9), prompts: dim(4, 5, 60), weekly_prompts: dim(0, 0, 0),
      });
    });
  });

  describe('canCarve (free = total − used, all-or-nothing)', () => {
    it('is unlimited when the master is unset or unmetered', () => {
      const { quota } = setup();
      expect(quota.canCarve(undefined, { projects: 999 })).to.equal(true);
      expect(quota.canCarve('', { prompts: 999 })).to.equal(true);
      expect(quota.canCarve('nope', { projects: 999, prompts: 999 })).to.equal(true);
    });

    it('respects free units per dimension (total − used)', () => {
      const { quota } = setup();
      quota.set('m', { projects: { used: 2, total: 10 }, prompts: { used: 100, total: 800 } });
      expect(quota.canCarve('m', { projects: 8, prompts: 700 })).to.equal(true); // exactly free
      expect(quota.canCarve('m', { projects: 9 })).to.equal(false); // projects short (free 8)
      expect(quota.canCarve('m', { prompts: 701 })).to.equal(false); // prompts short (free 700)
      expect(quota.canCarve('m', {})).to.equal(true); // empty need
    });

    it('ignores `drafted` — free is total − used, so staged units do not reduce headroom', () => {
      const { quota } = setup();
      // drafted is deliberately excluded (live: only published `used` counts against `total`).
      quota.set('m', { projects: { used: 2, drafted: 5, total: 10 } }); // free = 10 − 2 = 8
      expect(quota.canCarve('m', { projects: 8 })).to.equal(true); // drafted:5 does NOT reduce free
      expect(quota.canCarve('m', { projects: 9 })).to.equal(false);
    });
  });

  describe('moveFromMaster', () => {
    it('no-ops (null) for an unset or unmetered master', () => {
      const { quota } = setup();
      expect(quota.moveFromMaster(undefined, { projects: 1 })).to.equal(null);
      expect(quota.moveFromMaster('nope', { projects: 1 })).to.equal(null);
    });

    it('decrements total on a positive delta and returns units on a negative delta', () => {
      const { quota } = setup();
      quota.set('m', { projects: 10, prompts: 800 });
      expect(quota.moveFromMaster('m', { projects: 3, prompts: 300 })).to.deep.equal({
        projects: dim(0, 0, 7), prompts: dim(0, 0, 500), weekly_prompts: dim(0, 0, 0),
      });
      // negative delta gives units back; omitted dim → 0 move
      expect(quota.moveFromMaster('m', { projects: -2 }).projects).to.deep.equal(dim(0, 0, 9));
    });
  });

  describe('applyTransfer (absolute set + master movement)', () => {
    it('carves from the master and sets the child total (fresh child)', () => {
      const { quota } = setup();
      quota.set('m', { projects: 10, prompts: 800 });
      expect(quota.applyTransfer('m', 'c', { projects: 2, prompts: 100 })).to.deep.equal({ ok: true });
      expect(quota.resources('c').projects).to.deep.equal(dim(0, 0, 2));
      expect(quota.resources('m').projects).to.deep.equal(dim(0, 0, 8)); // 10 − 2
      expect(quota.resources('m').prompts).to.deep.equal(dim(0, 0, 700)); // 800 − 100
    });

    it('is idempotent — re-sending the same total moves nothing further', () => {
      const { quota } = setup();
      quota.set('m', { projects: 10 });
      quota.applyTransfer('m', 'c', { projects: 2 });
      quota.applyTransfer('m', 'c', { projects: 2 }); // delta 0
      expect(quota.resources('m').projects.total).to.equal(8);
      expect(quota.resources('c').projects.total).to.equal(2);
    });

    it('lowers the child and returns the surplus to the master (release)', () => {
      const { quota } = setup();
      quota.set('m', { projects: 10 });
      quota.applyTransfer('m', 'c', { projects: 5 }); // master 5
      quota.applyTransfer('m', 'c', { projects: 2 }); // release 3 → master 8
      expect(quota.resources('m').projects.total).to.equal(8);
      expect(quota.resources('c').projects.total).to.equal(2);
    });

    it('releases a dimension all the way to zero (RELEASE_ALLOCATION / decommission)', () => {
      const { quota } = setup();
      quota.set('m', { projects: 10 });
      quota.applyTransfer('m', 'c', { projects: 4 }); // master 6
      expect(quota.applyTransfer('m', 'c', { projects: 0 })).to.deep.equal({ ok: true }); // release all
      expect(quota.resources('c').projects.total).to.equal(0);
      expect(quota.resources('m').projects.total).to.equal(10); // fully returned
    });

    it('rejects (ok:false) and moves nothing when the master cannot cover a raise', () => {
      const { quota } = setup();
      quota.set('m', { projects: { used: 8, total: 10 } }); // free 2
      expect(quota.applyTransfer('m', 'c', { projects: 3 })).to.deep.equal({ ok: false });
      expect(quota.resources('m').projects.total).to.equal(10); // untouched
      expect(quota.resources('c')).to.equal(null); // child never set
    });

    it('only touches dimensions present in the transfer', () => {
      const { quota } = setup();
      quota.set('m', { projects: 10, prompts: 800 });
      quota.applyTransfer('m', 'c', { prompts: 100 }); // projects omitted
      expect(quota.resources('c').prompts.total).to.equal(100);
      expect(quota.resources('c').projects.total).to.equal(0); // untouched
      expect(quota.resources('m').projects.total).to.equal(10); // master projects untouched
    });

    it('sets the child total but leaves the master unmoved when the master is unmetered', () => {
      const { quota } = setup();
      expect(quota.applyTransfer('unmetered', 'c', { projects: 4 })).to.deep.equal({ ok: true });
      expect(quota.resources('c').projects.total).to.equal(4);
      expect(quota.resources('unmetered')).to.equal(null);
    });
  });

  describe('usage', () => {
    it('exposes resources for introspection (null when unmetered)', () => {
      const { quota } = setup();
      expect(quota.usage('nope')).to.deep.equal({ workspaceId: 'nope', resources: null });
      quota.set('w', { projects: 4 });
      expect(quota.usage('w').resources.projects).to.deep.equal(dim(0, 0, 4));
    });
  });
});
