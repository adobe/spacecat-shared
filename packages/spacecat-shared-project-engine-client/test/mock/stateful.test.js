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
import { tagId } from '../../mock/tag-id.js';
import {
  STATEFUL_RESOURCES,
  collectionKey,
  createStatefulOps,
} from '../../mock/stateful.js';

describe('stateful — confirmed resource set', () => {
  it('is projects, ai_models, prompts, benchmarks, tags, brand_urls (live-audited surface)', () => {
    expect([...STATEFUL_RESOURCES]).to.deep.equal([
      'projects', 'ai_models', 'prompts', 'benchmarks', 'tags', 'brand_urls',
    ]);
  });
});

describe('stateful — collectionKey scoping', () => {
  it('scopes projects per workspace', () => {
    expect(collectionKey('projects', { workspaceId: 'w1' })).to.equal('projects:w1');
  });

  it('scopes ai_models, prompts, benchmarks and tags per project', () => {
    expect(collectionKey('ai_models', { workspaceId: 'w1', projectId: 'p1' })).to.equal('ai_models:w1:p1');
    expect(collectionKey('prompts', { workspaceId: 'w1', projectId: 'p1' })).to.equal('prompts:w1:p1');
    expect(collectionKey('benchmarks', { workspaceId: 'w1', projectId: 'p1' })).to.equal('benchmarks:w1:p1');
    expect(collectionKey('tags', { workspaceId: 'w1', projectId: 'p1' })).to.equal('tags:w1:p1');
  });

  it('scopes brand_urls per benchmark (within a project)', () => {
    expect(collectionKey('brand_urls', { workspaceId: 'w1', projectId: 'p1', benchmarkId: 'b1' }))
      .to.equal('brand_urls:w1:p1:b1');
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

  it('updates a stored prompt in place; returns undefined for an unknown id', () => {
    const ops = createStatefulOps(new InMemoryStore()).prompts;
    const [created] = ops.createMany(scope, [{ name: 'p', tags: [] }]);
    const updated = ops.update(scope, created.id, { tags: [{ id: 'tag-1', name: 'brand' }] });
    expect(updated.tags).to.deep.equal([{ id: 'tag-1', name: 'brand' }]);
    expect(ops.list(scope)[0].tags).to.deep.equal([{ id: 'tag-1', name: 'brand' }]);
    // unknown id → no-op (the PUT /aio/prompts/tags silent-skip contract)
    expect(ops.update(scope, 'missing', { tags: [] })).to.equal(undefined);
  });
});

describe('stateful — prompts metadata ops (WP2, LLMO-6288)', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1' };
  const freshPrompt = () => {
    const ops = createStatefulOps(new InMemoryStore()).prompts;
    const [created] = ops.createMany(scope, [{ name: 'p', tags: [] }]);
    return { ops, id: created.id };
  };

  it('get reads a stored prompt, undefined for an unknown id', () => {
    const { ops, id } = freshPrompt();
    expect(ops.get(scope, id)?.name).to.equal('p');
    expect(ops.get(scope, 'missing')).to.equal(undefined);
  });

  it('setMetadataMany overwrites metadata wholesale on known prompts', () => {
    const { ops, id } = freshPrompt();
    ops.setMetadataMany(scope, [{ id, metadata: { created_by: 'a@x', created_at: 't0' } }]);
    // A second write REPLACES (not merges) the stored object.
    const { updated, missing } = ops.setMetadataMany(scope, [{ id, metadata: { updated_by: 'b@x' } }]);
    expect(missing).to.deep.equal([]);
    expect(updated[0].metadata).to.deep.equal({ updated_by: 'b@x' });
    expect(ops.get(scope, id).metadata).to.deep.equal({ updated_by: 'b@x' });
  });

  it('setMetadataMany reports unknown and id-less items as missing, writing nothing for them', () => {
    const { ops, id } = freshPrompt();
    const { updated, missing } = ops.setMetadataMany(scope, [
      { id, metadata: 'opaque-text' }, // known → written (text-shaped payload is fine)
      { id: 'missing', metadata: { x: 1 } }, // unknown id
      { metadata: { y: 2 } }, // no id at all
    ]);
    expect(updated).to.have.length(1);
    expect(updated[0].metadata).to.equal('opaque-text');
    expect(missing).to.deep.equal(['missing', undefined]);
  });

  it('mergeMetadataMany shallow-merges two objects (incoming keys win)', () => {
    const { ops, id } = freshPrompt();
    ops.setMetadataMany(scope, [{ id, metadata: { created_by: 'a@x', created_at: 't0' } }]);
    const { updated } = ops.mergeMetadataMany(scope, [{ id, metadata: { updated_by: 'b@x', created_at: 't1' } }]);
    expect(updated[0].metadata).to.deep.equal({ created_by: 'a@x', created_at: 't1', updated_by: 'b@x' });
  });

  it('mergeMetadataMany replaces wholesale when either side is not a plain object', () => {
    // Store `stored` metadata, merge `incoming`, and return the resulting metadata.
    const mergeOnto = (stored, incoming) => {
      const { ops, id } = freshPrompt();
      ops.setMetadataMany(scope, [{ id, metadata: stored }]);
      return ops.mergeMetadataMany(scope, [{ id, metadata: incoming }]).updated[0].metadata;
    };
    // incoming not a plain object → replace (isPlainObject(incoming) false: typeof / null / array)
    expect(mergeOnto({ k: 1 }, 'text')).to.equal('text');
    expect(mergeOnto({ k: 1 }, null)).to.equal(null);
    expect(mergeOnto({ k: 1 }, [1, 2])).to.deep.equal([1, 2]);
    // current not a plain object → replace (isPlainObject(current) false: text, then undefined)
    expect(mergeOnto('old', { k: 9 })).to.deep.equal({ k: 9 });
    expect(mergeOnto(undefined, { first: true })).to.deep.equal({ first: true });
  });

  it('mergeMetadataMany reports unknown and id-less items as missing', () => {
    const { ops } = freshPrompt();
    const { updated, missing } = ops.mergeMetadataMany(scope, [
      { id: 'missing', metadata: { x: 1 } },
      { metadata: { y: 2 } },
    ]);
    expect(updated).to.have.length(0);
    expect(missing).to.deep.equal(['missing', undefined]);
  });
});

describe('stateful — benchmarks ops', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1' };

  it('creates many, lists, updates in place and bulk-removes', () => {
    const ops = createStatefulOps(new InMemoryStore()).benchmarks;
    const created = ops.createMany(scope, [
      { brand_name: 'Comp A', domain: 'a.example' },
      { brand_name: 'Comp B', domain: 'b.example' },
    ]);
    expect(created).to.have.length(2);
    expect(ops.list(scope)).to.have.length(2);
    expect(ops.update(scope, created[0].id, { brand_aliases: ['A'] })?.brand_aliases).to.deep.equal(['A']);
    expect(ops.update(scope, 'missing', { brand_aliases: ['X'] })).to.equal(undefined);
    expect(ops.removeMany(scope, [created[0].id, 'missing'])).to.equal(1);
    expect(ops.list(scope)).to.have.length(1);
  });

  it('isolates benchmarks across projects', () => {
    const ops = createStatefulOps(new InMemoryStore()).benchmarks;
    ops.createMany({ workspaceId: 'w1', projectId: 'p1' }, [{ domain: 'a.example' }]);
    expect(ops.list({ workspaceId: 'w1', projectId: 'p2' })).to.have.length(0);
  });
});

describe('stateful — tags ops', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1' };

  it('creates a clean batch (no collision), lists and bulk-removes', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    const { tags: created, collision } = ops.upsertMany(scope, [
      { id: 'tag-a', name: 'A' },
      { id: 'tag-b', name: 'B' },
    ]);
    expect(collision).to.equal(false);
    expect(created).to.have.length(2);
    expect(ops.list(scope)).to.have.length(2);
    expect(ops.removeMany(scope, ['tag-a', 'missing'])).to.equal(1);
    expect(ops.list(scope)).to.have.length(1);
  });

  // Gate 4 (verified live 2026-07-02): deleting a tag detaches it from every carrying prompt, and a
  // prompt whose only tag was deleted becomes fully unassigned — not orphaned, not still matchable.
  it('detaches a deleted tag from every carrying prompt', () => {
    const store = new InMemoryStore();
    const allOps = createStatefulOps(store);
    allOps.tags.upsertMany(scope, [{ id: 'tag-a', name: 'A' }, { id: 'tag-b', name: 'B' }]);
    allOps.prompts.createMany(scope, [
      { id: 'p1', name: 'both', tags: [{ id: 'tag-a', name: 'A' }, { id: 'tag-b', name: 'B' }] },
      { id: 'p2', name: 'only doomed', tags: [{ id: 'tag-a', name: 'A' }] },
      { id: 'p3', name: 'untagged' },
    ]);

    expect(allOps.tags.removeMany(scope, ['tag-a'])).to.equal(1);

    const byId = new Map(allOps.prompts.list(scope).map((p) => [p.id, p]));
    // the surviving tag stays on the prompt that carried both …
    expect(byId.get('p1').tags.map((t) => t.id)).to.deep.equal(['tag-b']);
    // … the prompt whose ONLY tag was deleted is left fully unassigned, not deleted …
    expect(byId.get('p2').tags).to.deep.equal([]);
    // … and a prompt with no tags at all is untouched.
    expect(byId.get('p3').tags).to.equal(undefined);
    expect(allOps.prompts.list(scope)).to.have.length(3);
  });

  // An id that names no stored tag still detaches from any prompt carrying it (the prompt's tag map
  // is the only place it survives), and it does not count toward the removed total.
  it('detaches an id that is not in the standalone tag collection, without counting it', () => {
    const store = new InMemoryStore();
    const allOps = createStatefulOps(store);
    allOps.prompts.createMany(scope, [
      { id: 'p1', name: 'stale ref', tags: [{ id: 'tag-ghost', name: 'Ghost' }] },
    ]);

    expect(allOps.tags.removeMany(scope, ['tag-ghost'])).to.equal(0);
    expect(allOps.prompts.list(scope)[0].tags).to.deep.equal([]);
  });

  it('rejects a same-name/same-parent collision atomically (gate 7 → the route 500s)', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    ops.upsertMany(scope, [{ id: 'tag-a', name: 'A' }]);
    // re-creating the same id at the same (root) level collides — nothing new is written
    const { tags, collision } = ops.upsertMany(scope, [
      { id: 'tag-a', name: 'A' },
      { id: 'tag-b', name: 'B' },
    ]);
    expect(collision).to.equal(true);
    expect(tags).to.have.length(0);
    // atomic: the non-colliding tag-b was NOT created
    expect(ops.list(scope).map((t) => t.id)).to.deep.equal(['tag-a']);
  });

  it('rejects an intra-batch duplicate (same id+parent twice in one request)', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    const { collision } = ops.upsertMany(scope, [
      { id: 'tag-a', name: 'A' },
      { id: 'tag-a', name: 'A' },
    ]);
    expect(collision).to.equal(true);
    expect(ops.list(scope)).to.have.length(0);
  });

  it('persists a same-name tag under a DIFFERENT parent as its own row', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    // Callers derive the id from `(parent, name)` (see tag-id.js), so the same bare name under two
    // parents arrives as two distinct ids and both persist — the dimension-root model relies on it.
    ops.upsertMany(scope, [{ id: tagId('Pricing', 'root-a'), name: 'Pricing', parent_id: 'root-a' }]);
    const { tags, collision } = ops.upsertMany(
      scope,
      [{ id: tagId('Pricing', 'root-b'), name: 'Pricing', parent_id: 'root-b' }],
    );
    expect(collision).to.equal(false);
    expect(tags[0]).to.include({ parent_id: 'root-b' });
    expect(ops.list(scope)).to.have.length(2);
  });

  it('collides when an id is already stored, whatever parent it now sits under', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    ops.upsertMany(scope, [{ id: 'tag-x', name: 'Trail', parent_id: 'root-a' }]);
    // A PATCH keeps the id stable across a re-parent, so a re-create of the tag's ORIGINAL
    // (parent, name) derives an id the moved tag still occupies. The mock cannot hold two tags at
    // one id, so it fails loudly rather than handing back a tag that now lives elsewhere.
    const { tags, collision } = ops.upsertMany(scope, [{ id: 'tag-x', name: 'Trail', parent_id: 'root-b' }]);
    expect(collision).to.equal(true);
    expect(tags).to.have.length(0);
    expect(ops.list(scope)).to.have.length(1);
    expect(ops.list(scope)[0]).to.include({ id: 'tag-x', parent_id: 'root-a' }); // untouched
  });

  it('isolates tags across projects (the multi-market scoping invariant)', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    ops.upsertMany({ workspaceId: 'w1', projectId: 'p1' }, [{ id: 'tag-a', name: 'A' }]);
    expect(ops.list({ workspaceId: 'w1', projectId: 'p2' })).to.have.length(0);
  });

  it('re-parents / renames a tag in place, keeping the id stable', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    ops.upsertMany(scope, [
      { id: 'tag-root', name: 'category' },
      { id: 'tag-child', name: 'Child' },
    ]);
    // re-parent the child under the root
    const parented = ops.update(scope, 'tag-child', { name: 'Child', parent_id: 'tag-root' });
    expect(parented).to.include({ id: 'tag-child', name: 'Child', parent_id: 'tag-root' });
    // promote back to a root (parent_id cleared to '')
    const promoted = ops.update(scope, 'tag-child', { name: 'Child', parent_id: '' });
    expect(promoted).to.include({ id: 'tag-child', parent_id: '' });
  });

  it('returns undefined when updating an unknown tag id', () => {
    const ops = createStatefulOps(new InMemoryStore()).tags;
    expect(ops.update(scope, 'missing', { name: 'x', parent_id: '' })).to.equal(undefined);
  });
});

describe('stateful — brand_urls ops', () => {
  const scope = { workspaceId: 'w1', projectId: 'p1', benchmarkId: 'b1' };

  it('creates many, lists and bulk-removes, scoped per benchmark', () => {
    const ops = createStatefulOps(new InMemoryStore()).brand_urls;
    const created = ops.createMany(scope, [{ url: 'https://x.example', type: 'own' }]);
    expect(created).to.have.length(1);
    expect(ops.list(scope)).to.have.length(1);
    // a different benchmark under the same project does not see these urls
    expect(ops.list({ ...scope, benchmarkId: 'b2' })).to.have.length(0);
    expect(ops.removeMany(scope, [created[0].id, 'missing'])).to.equal(1);
    expect(ops.list(scope)).to.have.length(0);
  });
});
