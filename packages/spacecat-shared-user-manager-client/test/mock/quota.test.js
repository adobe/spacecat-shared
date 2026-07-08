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
import { createQuota, POOL_COLLECTION } from '../../mock/quota.js';

function setup() {
  const store = new InMemoryStore();
  return { store, quota: createQuota(store) };
}

describe('mock quota — parent pool', () => {
  it('exports the pool collection name', () => {
    expect(POOL_COLLECTION).to.equal('workspace_pool');
  });

  describe('set / pool', () => {
    it('sets an absolute pool (create), then replaces it (update)', () => {
      const { quota } = setup();
      expect(quota.set('p', { projects: 5, prompts: 100 }))
        .to.deep.equal({ id: 'p', projects: 5, prompts: 100 });
      expect(quota.pool('p')).to.deep.equal({ projects: 5, prompts: 100 });
      // update branch (record already exists)
      expect(quota.set('p', { projects: 2 }))
        .to.deep.equal({ id: 'p', projects: 2, prompts: null });
      expect(quota.pool('p')).to.deep.equal({ projects: 2, prompts: null });
    });

    it('treats omitted dimensions as unlimited (null)', () => {
      const { quota } = setup();
      expect(quota.set('p')).to.deep.equal({ id: 'p', projects: null, prompts: null });
    });

    it('returns null for a workspace with no pool', () => {
      const { quota } = setup();
      expect(quota.pool('nope')).to.equal(null);
    });
  });

  describe('canAllocate', () => {
    it('unlimited when the owner is unset (e.g. a transfer onto a parent-less workspace)', () => {
      const { quota } = setup();
      expect(quota.canAllocate(undefined, { projects: 999 })).to.equal(true);
      expect(quota.canAllocate('', { projects: 999 })).to.equal(true);
    });

    it('unlimited when no pool record exists', () => {
      const { quota } = setup();
      expect(quota.canAllocate('p', { projects: 999, prompts: 999 })).to.equal(true);
    });

    it('covers a draw within the pool, and a null dimension is unlimited', () => {
      const { quota } = setup();
      quota.set('p', { projects: null, prompts: 100 }); // projects unlimited, prompts finite
      expect(quota.canAllocate('p', { projects: 999, prompts: 100 })).to.equal(true);
      expect(quota.canAllocate('p', { projects: 999, prompts: 101 })).to.equal(false); // prompts short
    });

    it('rejects when the projects dimension is insufficient', () => {
      const { quota } = setup();
      quota.set('p', { projects: 1, prompts: null });
      expect(quota.canAllocate('p', { projects: 2 })).to.equal(false);
      expect(quota.canAllocate('p', {})).to.equal(true); // empty draw → 0 ≤ 1
    });
  });

  describe('draw', () => {
    it('no-ops (null) when the owner is unset or unmetered', () => {
      const { quota } = setup();
      expect(quota.draw(undefined, { projects: 1 })).to.equal(null);
      expect(quota.draw('p', { projects: 1 })).to.equal(null); // no pool
    });

    it('deducts numeric dimensions and leaves null dimensions unlimited (projects metered)', () => {
      const { quota } = setup();
      quota.set('p', { projects: 5, prompts: null });
      expect(quota.draw('p', { projects: 2, prompts: 999 }))
        .to.deep.equal({ projects: 3, prompts: null });
      expect(quota.pool('p')).to.deep.equal({ projects: 3, prompts: null });
      // default-0 draw on an omitted dimension
      expect(quota.draw('p', {})).to.deep.equal({ projects: 3, prompts: null });
    });

    it('deducts the prompts dimension while projects stays unlimited (mirror)', () => {
      const { quota } = setup();
      quota.set('p', { projects: null, prompts: 50 });
      expect(quota.draw('p', { prompts: 10 }))
        .to.deep.equal({ projects: null, prompts: 40 });
      // omitted prompts → 0 deduction
      expect(quota.draw('p', {})).to.deep.equal({ projects: null, prompts: 40 });
    });
  });

  it('usage exposes the pool for introspection', () => {
    const { quota } = setup();
    quota.set('p', { projects: 4, prompts: 80 });
    expect(quota.usage('p')).to.deep.equal({ workspaceId: 'p', pool: { projects: 4, prompts: 80 } });
    expect(quota.usage('nope')).to.deep.equal({ workspaceId: 'nope', pool: null });
  });
});
