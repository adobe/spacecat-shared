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

describe('InMemoryStore — CRUD', () => {
  it('creates with a generated id and reads it back', () => {
    const store = new InMemoryStore();
    const created = store.create('projects', { name: 'A' });
    expect(created.id).to.be.a('string').and.have.length.greaterThan(0);
    expect(store.get('projects', created.id)?.name).to.equal('A');
  });

  it('keeps an explicit id', () => {
    const store = new InMemoryStore();
    store.create('projects', { id: 'fixed', name: 'B' });
    expect(store.get('projects', 'fixed')?.name).to.equal('B');
  });

  it('throws on a duplicate explicit id', () => {
    const store = new InMemoryStore();
    store.create('projects', { id: 'dup', name: 'first' });
    expect(() => store.create('projects', { id: 'dup', name: 'second' }))
      .to.throw('duplicate id dup in collection projects');
  });

  it('returns undefined for an unknown id', () => {
    const store = new InMemoryStore();
    expect(store.get('projects', 'nope')).to.equal(undefined);
  });

  it('lists all and filters', () => {
    const store = new InMemoryStore();
    store.create('projects', { id: 'p1', name: 'A' });
    store.create('projects', { id: 'p2', name: 'B' });
    expect(store.list('projects')).to.have.length(2);
    expect(store.list('projects', (e) => e.name === 'B')).to.have.length(1);
  });

  it('updates by merge and returns undefined for a missing id', () => {
    const store = new InMemoryStore();
    store.create('projects', { id: 'p1', name: 'A' });
    const updated = store.update('projects', 'p1', { name: 'A2', extra: 1 });
    expect(updated).to.include({ id: 'p1', name: 'A2', extra: 1 });
    expect(store.update('projects', 'missing', { name: 'x' })).to.equal(undefined);
  });

  it('deletes, reporting whether anything was removed', () => {
    const store = new InMemoryStore();
    store.create('projects', { id: 'p1', name: 'A' });
    expect(store.delete('projects', 'p1')).to.equal(true);
    expect(store.get('projects', 'p1')).to.equal(undefined);
    expect(store.delete('projects', 'nope')).to.equal(false);
  });
});

describe('InMemoryStore — seed & reset', () => {
  /** @type {import('../../mock/store.js').Snapshot} */
  const snapshot = {
    workspaces: [{ id: 'w1', name: 'WS' }],
    projects: [{ id: 'pr1', name: 'seedproj' }],
  };

  it('loads a seed set', () => {
    const store = new InMemoryStore();
    store.load(snapshot);
    expect(store.get('workspaces', 'w1')?.name).to.equal('WS');
  });

  it('reset with no prior load empties the store', () => {
    const store = new InMemoryStore();
    store.create('projects', { id: 'p1', name: 'A' });
    store.reset();
    expect(store.list('projects')).to.have.length(0);
  });

  it('does not mutate the seed snapshot when the store is changed', () => {
    const store = new InMemoryStore();
    store.load(snapshot);
    store.create('projects', { id: 'pr2', name: 'new' });
    store.delete('projects', 'pr1');
    expect(snapshot.projects).to.have.length(1);
    expect(snapshot.projects[0].id).to.equal('pr1');
  });

  it('reset restores the seed — re-adding deleted, dropping created', () => {
    const store = new InMemoryStore();
    store.load(snapshot);
    store.create('projects', { id: 'pr2', name: 'new' });
    store.delete('projects', 'pr1');
    store.reset();
    expect(store.get('projects', 'pr1')?.name).to.equal('seedproj');
    expect(store.get('projects', 'pr2')).to.equal(undefined);
  });
});

describe('InMemoryStore — snapshot', () => {
  it('exports the current live state (including emptied collections), deep-cloned', () => {
    const store = new InMemoryStore();
    store.load({ projects: [{ id: 'pr1', name: 'seedproj' }] });
    store.create('projects', { id: 'pr2', name: 'new' });
    const out = store.snapshot();
    expect(out.projects.map((p) => p.id)).to.have.members(['pr1', 'pr2']);
    // deep-cloned: mutating the snapshot does not affect the store.
    out.projects[0].name = 'mutated';
    expect(store.get('projects', 'pr1')?.name).to.equal('seedproj');
  });

  it('returns an empty object for a fresh store', () => {
    expect(new InMemoryStore().snapshot()).to.deep.equal({});
  });
});
