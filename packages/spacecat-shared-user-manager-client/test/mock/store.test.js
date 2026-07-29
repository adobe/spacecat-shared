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

describe('InMemoryStore — CRUD', () => {
  it('creates with a generated id and reads it back', () => {
    const store = new InMemoryStore();
    const created = store.create('workspaces', { title: 'A' });
    expect(created.id).to.be.a('string').and.have.length.greaterThan(0);
    expect(store.get('workspaces', created.id)?.title).to.equal('A');
  });

  it('keeps an explicit id', () => {
    const store = new InMemoryStore();
    store.create('workspaces', { id: 'fixed', title: 'B' });
    expect(store.get('workspaces', 'fixed')?.title).to.equal('B');
  });

  it('throws on a duplicate explicit id', () => {
    const store = new InMemoryStore();
    store.create('workspaces', { id: 'dup', title: 'first' });
    expect(() => store.create('workspaces', { id: 'dup', title: 'second' }))
      .to.throw('duplicate id dup in collection workspaces');
  });

  it('returns undefined for an unknown id', () => {
    const store = new InMemoryStore();
    expect(store.get('workspaces', 'nope')).to.equal(undefined);
  });

  it('returns deep clones — mutating a create/get result never corrupts the store', () => {
    const store = new InMemoryStore();
    const created = store.create('workspaces', { id: 'w1', title: 'A' });
    created.title = 'mutated';
    expect(store.get('workspaces', 'w1')?.title).to.equal('A');
    const got = store.get('workspaces', 'w1');
    got.title = 'mutated again';
    expect(store.get('workspaces', 'w1')?.title).to.equal('A');
  });

  it('lists all and filters', () => {
    const store = new InMemoryStore();
    store.create('workspaces', { id: 'w1', title: 'A' });
    store.create('workspaces', { id: 'w2', title: 'B' });
    expect(store.list('workspaces')).to.have.length(2);
    expect(store.list('workspaces', (e) => e.title === 'B')).to.have.length(1);
  });

  it('updates by merge and returns undefined for a missing id', () => {
    const store = new InMemoryStore();
    store.create('workspaces', { id: 'w1', title: 'A' });
    const updated = store.update('workspaces', 'w1', { title: 'A2', extra: 1 });
    expect(updated).to.include({ id: 'w1', title: 'A2', extra: 1 });
    expect(store.update('workspaces', 'missing', { title: 'x' })).to.equal(undefined);
  });

  it('deletes, reporting whether anything was removed', () => {
    const store = new InMemoryStore();
    store.create('workspaces', { id: 'w1', title: 'A' });
    expect(store.delete('workspaces', 'w1')).to.equal(true);
    expect(store.get('workspaces', 'w1')).to.equal(undefined);
    expect(store.delete('workspaces', 'nope')).to.equal(false);
  });
});

describe('InMemoryStore — seed & reset', () => {
  /** @type {import('../../mock/store.js').Snapshot} */
  const snapshot = {
    workspaces: [{ id: 'w1', title: 'WS' }],
    workspace_pool: [{ id: 'w1', projects: 5, prompts: 100 }],
  };

  it('loads a seed set', () => {
    const store = new InMemoryStore();
    store.load(snapshot);
    expect(store.get('workspaces', 'w1')?.title).to.equal('WS');
  });

  it('reset with no prior load empties the store', () => {
    const store = new InMemoryStore();
    store.create('workspaces', { id: 'w1', title: 'A' });
    store.reset();
    expect(store.list('workspaces')).to.have.length(0);
  });

  it('does not mutate the seed snapshot when the store is changed', () => {
    const store = new InMemoryStore();
    store.load(snapshot);
    store.create('workspaces', { id: 'w2', title: 'new' });
    store.delete('workspaces', 'w1');
    expect(snapshot.workspaces).to.have.length(1);
    expect(snapshot.workspaces[0].id).to.equal('w1');
  });

  it('reset restores the seed — re-adding deleted, dropping created', () => {
    const store = new InMemoryStore();
    store.load(snapshot);
    store.create('workspaces', { id: 'w2', title: 'new' });
    store.delete('workspaces', 'w1');
    store.reset();
    expect(store.get('workspaces', 'w1')?.title).to.equal('WS');
    expect(store.get('workspaces', 'w2')).to.equal(undefined);
  });
});

describe('InMemoryStore — snapshot', () => {
  it('exports the current live state (including emptied collections), deep-cloned', () => {
    const store = new InMemoryStore();
    store.load({ workspaces: [{ id: 'w1', title: 'seedws' }] });
    store.create('workspaces', { id: 'w2', title: 'new' });
    const out = store.snapshot();
    expect(out.workspaces.map((p) => p.id)).to.have.members(['w1', 'w2']);
    // deep-cloned: mutating the snapshot does not affect the store.
    out.workspaces[0].title = 'mutated';
    expect(store.get('workspaces', 'w1')?.title).to.equal('seedws');
  });

  it('returns an empty object for a fresh store', () => {
    expect(new InMemoryStore().snapshot()).to.deep.equal({});
  });
});

describe('InMemoryStore — keys & size (non-creating)', () => {
  it('keys lists only collections that exist; size counts entities, 0 for unknown', () => {
    const store = new InMemoryStore();
    store.create('a', { id: '1' });
    store.create('a', { id: '2' });
    store.create('b', { id: '1' });
    expect(store.keys()).to.have.members(['a', 'b']);
    expect(store.size('a')).to.equal(2);
    expect(store.size('b')).to.equal(1);
    // size on an unknown collection returns 0 WITHOUT materializing it
    expect(store.size('missing')).to.equal(0);
    expect(store.keys()).to.not.include('missing');
  });
});
