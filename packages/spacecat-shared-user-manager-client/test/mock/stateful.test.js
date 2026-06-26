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
import {
  createStatefulOps, STATEFUL_RESOURCES, WORKSPACES, STATUS_CONTROL,
} from '../../mock/stateful.js';
import { POOL_COLLECTION } from '../../mock/quota.js';

/** A store + ops pair, seeded with the given workspace entities. */
function setup(workspaces = []) {
  const store = new InMemoryStore();
  store.load({ [WORKSPACES]: workspaces });
  return { store, ops: createStatefulOps(store).workspaces };
}

describe('mock stateful — workspaces', () => {
  it('exports the resource constants', () => {
    expect(STATEFUL_RESOURCES).to.deep.equal(['workspaces']);
    expect(WORKSPACES).to.equal('workspaces');
    expect(STATUS_CONTROL).to.equal('workspace_status');
    expect(Object.isFrozen(STATEFUL_RESOURCES)).to.equal(true);
  });

  describe('create / get / exists / list', () => {
    it('creates a workspace and reads it back', () => {
      const { ops } = setup();
      const created = ops.create({
        id: 'w1', title: 'Child', parent_id: 'p1', status: 'created',
      });
      expect(created).to.include({ id: 'w1', title: 'Child', parent_id: 'p1' });
      expect(ops.get('w1')?.title).to.equal('Child');
    });

    it('exists reports presence', () => {
      const { ops } = setup([{ id: 'w1', title: 'A', parent_id: '' }]);
      expect(ops.exists('w1')).to.equal(true);
      expect(ops.exists('nope')).to.equal(false);
      expect(ops.get('nope')).to.equal(undefined);
    });

    it('lists all workspaces', () => {
      const { ops } = setup([
        { id: 'w1', title: 'A', parent_id: '' },
        { id: 'w2', title: 'B', parent_id: 'w1' },
      ]);
      expect(ops.list().map((w) => w.id)).to.have.members(['w1', 'w2']);
    });
  });

  describe('listFamily', () => {
    it('returns the parent plus its (nested) descendants', () => {
      const { ops } = setup([
        { id: 'p', title: 'Parent', parent_id: '' },
        { id: 'c1', title: 'Child 1', parent_id: 'p' },
        { id: 'c2', title: 'Child 2', parent_id: 'p' },
        { id: 'g1', title: 'Grandchild', parent_id: 'c1' },
        { id: 'other', title: 'Unrelated', parent_id: '' },
      ]);
      const ids = ops.listFamily('p').map((w) => w.id);
      expect(ids).to.have.members(['p', 'c1', 'c2', 'g1']);
      expect(ids).to.not.include('other');
    });

    it('returns an empty array for an unknown workspace', () => {
      const { ops } = setup([{ id: 'p', title: 'P', parent_id: '' }]);
      expect(ops.listFamily('nope')).to.deep.equal([]);
    });

    it('tolerates a workspace with no parent_id field (treated as a root)', () => {
      const { ops } = setup([
        { id: 'root', title: 'Root' }, // no parent_id at all → coerced to ''
        { id: 'child', title: 'Child', parent_id: 'root' },
      ]);
      expect(ops.listFamily('root').map((w) => w.id)).to.have.members(['root', 'child']);
    });

    it('terminates on a cycle (never loops forever)', () => {
      const { ops } = setup([
        { id: 'a', title: 'A', parent_id: 'b' },
        { id: 'b', title: 'B', parent_id: 'a' },
      ]);
      expect(ops.listFamily('a').map((w) => w.id)).to.have.members(['a', 'b']);
    });
  });

  describe('remove (cascade)', () => {
    it('removes the workspace and every descendant, returning the removed ids', () => {
      const { ops, store } = setup([
        { id: 'p', title: 'Parent', parent_id: '' },
        { id: 'c1', title: 'Child', parent_id: 'p' },
        { id: 'g1', title: 'Grandchild', parent_id: 'c1' },
      ]);
      store.create(STATUS_CONTROL, { id: 'c1', pending: 1 });
      store.create(POOL_COLLECTION, { id: 'p', projects: 5, prompts: 100 });
      const removed = ops.remove('p');
      expect(removed).to.have.members(['p', 'c1', 'g1']);
      expect(ops.list()).to.have.length(0);
      // the cascade also drops the descendant's status budget and the parent's pool record
      expect(store.get(STATUS_CONTROL, 'c1')).to.equal(undefined);
      expect(store.get(POOL_COLLECTION, 'p')).to.equal(undefined);
    });

    it('returns an empty array for an unknown workspace', () => {
      const { ops } = setup([{ id: 'p', title: 'P', parent_id: '' }]);
      expect(ops.remove('nope')).to.deep.equal([]);
      expect(ops.exists('p')).to.equal(true);
    });
  });

  describe('status budget (setPendingStatus / readStatus)', () => {
    it('reads the settled status when no budget is set', () => {
      const { ops } = setup([{
        id: 'w1', title: 'A', parent_id: '', status: 'created',
      }]);
      expect(ops.readStatus('w1')).to.equal('created');
    });

    it('defaults to created when the workspace has no status field', () => {
      const { ops } = setup([{ id: 'w1', title: 'A', parent_id: '' }]);
      expect(ops.readStatus('w1')).to.equal('created');
    });

    it('defaults to created for an unknown workspace (defensive — handler checks existence first)', () => {
      const { ops } = setup();
      expect(ops.readStatus('ghost')).to.equal('created');
    });

    it('burns down a not-ready budget one read at a time, then settles', () => {
      const { ops } = setup([{
        id: 'w1', title: 'A', parent_id: '', status: 'created',
      }]);
      ops.setPendingStatus('w1', 2);
      expect(ops.readStatus('w1')).to.equal('not ready');
      expect(ops.readStatus('w1')).to.equal('not ready');
      expect(ops.readStatus('w1')).to.equal('created');
    });

    it('setPendingStatus creates then updates the budget record, clamping below 0', () => {
      const { ops } = setup([{ id: 'w1', title: 'A', parent_id: '' }]);
      expect(ops.setPendingStatus('w1', 3)).to.deep.equal({ id: 'w1', pending: 3 });
      // update branch (record already exists)
      expect(ops.setPendingStatus('w1', 1)).to.deep.equal({ id: 'w1', pending: 1 });
      // clamp: negative / NaN → 0
      expect(ops.setPendingStatus('w1', -5)).to.deep.equal({ id: 'w1', pending: 0 });
      expect(ops.setPendingStatus('w1', 'x')).to.deep.equal({ id: 'w1', pending: 0 });
    });
  });
});
