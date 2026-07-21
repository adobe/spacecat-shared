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

describe('stateful — prompts metadata ops (WP2, LLMO-6288 v3 rework)', () => {
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

  describe('hasOversizedAuthor', () => {
    it('is false when every item is absent metadata / within the 100-char limit', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      expect(ops.hasOversizedAuthor([{}, { metadata: undefined }, { metadata: { created_by: 'a@x' } }]))
        .to.equal(false);
    });

    it('is true when any item\'s created_by or updated_by exceeds 100 chars', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const long = 'x'.repeat(101);
      expect(ops.hasOversizedAuthor([{ metadata: { created_by: long } }])).to.equal(true);
      expect(ops.hasOversizedAuthor([{ metadata: { updated_by: long } }])).to.equal(true);
      // exactly 100 chars is within the limit
      expect(ops.hasOversizedAuthor([{ metadata: { created_by: 'x'.repeat(100) } }])).to.equal(false);
    });
  });

  describe('createManyWithMetadata', () => {
    it('creates new prompts with supplied metadata + tags, is_new: true', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const tags = [{ id: 'tag-a', name: 'A' }];
      const { ok, results, existingCount } = ops.createManyWithMetadata(scope, [
        { name: 'What is X?', metadata: { created_by: 'a@x', created_at: 't0' }, tags },
      ]);
      expect(ok).to.equal(true);
      expect(existingCount).to.equal(0);
      expect(results).to.have.length(1);
      expect(results[0]).to.include({ name: 'What is X?', is_new: true });
      expect(results[0].metadata).to.deep.equal({ created_by: 'a@x', created_at: 't0' });
      expect(ops.get(scope, results[0].id).tags).to.deep.equal(tags);
    });

    it('creates a prompt with no metadata at all (metadata stays undefined)', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const { results } = ops.createManyWithMetadata(scope, [{ name: 'No metadata' }]);
      expect(results[0].metadata).to.equal(undefined);
    });

    it('a dedupe hit (existing stored name) preserves stored metadata, is_new: false', () => {
      const { ops, id } = freshPrompt();
      ops.patchOne(scope, id, { metadata: { created_by: 'orig@x' } });
      const { results, existingCount } = ops.createManyWithMetadata(scope, [
        { name: 'p', metadata: { created_by: 'ignored@x' }, tags: [{ id: 'tag-z', name: 'Z' }] },
      ]);
      expect(existingCount).to.equal(1);
      expect(results[0]).to.deep.equal({
        id, name: 'p', is_new: false, metadata: { created_by: 'orig@x' },
      });
      // the existing prompt's tags are untouched by the dedupe hit's (discarded) request tags
      expect(ops.get(scope, id).tags).to.deep.equal([]);
    });

    it('dedupes a repeated name WITHIN the same batch (second occurrence is a hit too)', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const { results, existingCount } = ops.createManyWithMetadata(scope, [
        { name: 'dup', metadata: { created_by: 'first@x' } },
        { name: 'dup', metadata: { created_by: 'second@x' } },
      ]);
      expect(existingCount).to.equal(1);
      expect(results[0].is_new).to.equal(true);
      expect(results[1]).to.deep.equal({
        id: results[0].id, name: 'dup', is_new: false, metadata: { created_by: 'first@x' },
      });
      expect(ops.list(scope)).to.have.length(1);
    });

    it('is atomic on the author-length CHECK: nothing is created when any item violates it', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const long = 'x'.repeat(101);
      const { ok } = ops.createManyWithMetadata(scope, [
        { name: 'fine' },
        { name: 'bad', metadata: { updated_by: long } },
      ]);
      expect(ok).to.equal(false);
      expect(ops.list(scope)).to.have.length(0);
    });
  });

  describe('patchOne (combined name/metadata PATCH)', () => {
    it('400s when neither name nor metadata is supplied', () => {
      const { ops, id } = freshPrompt();
      expect(ops.patchOne(scope, id, {})).to.deep.equal({ status: 'bad-request' });
      expect(ops.patchOne(scope, id, { name: undefined, metadata: undefined }))
        .to.deep.equal({ status: 'bad-request' });
    });

    it('404s for an unknown prompt id', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      expect(ops.patchOne(scope, 'missing', { name: 'x' })).to.deep.equal({ status: 'not-found' });
    });

    it('renames in place; a name equal to a sibling prompt 409s with nothing mutated', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const [a, b] = ops.createMany(scope, [{ name: 'a', tags: [] }, { name: 'b', tags: [] }]);
      const ok = ops.patchOne(scope, a.id, { name: 'renamed' });
      expect(ok.status).to.equal('ok');
      expect(ok.entity.name).to.equal('renamed');

      const conflict = ops.patchOne(scope, b.id, { name: 'renamed' });
      expect(conflict).to.deep.equal({ status: 'conflict' });
      expect(ops.get(scope, b.id).name).to.equal('b'); // nothing mutated
    });

    it('renaming a prompt onto its OWN current name is not a conflict', () => {
      const { ops, id } = freshPrompt();
      const result = ops.patchOne(scope, id, { name: 'p' });
      expect(result.status).to.equal('ok');
    });

    it('metadata: null WIPES the whole block (collapses to undefined)', () => {
      const { ops, id } = freshPrompt();
      ops.patchOne(scope, id, { metadata: { created_by: 'a@x' } });
      const result = ops.patchOne(scope, id, { metadata: null });
      expect(result.status).to.equal('ok');
      expect(result.entity.metadata).to.equal(undefined);
    });

    it('metadata object merges via RFC 7396 (absent = keep, string = set, null = delete)', () => {
      const { ops, id } = freshPrompt();
      ops.patchOne(scope, id, {
        metadata: { created_by: 'a@x', created_at: 't0', updated_by: 'a@x' },
      });
      const result = ops.patchOne(scope, id, {
        metadata: { updated_by: 'b@x', updated_at: 't1', created_by: null },
      });
      expect(result.entity.metadata).to.deep.equal({
        created_at: 't0', updated_by: 'b@x', updated_at: 't1',
      });
    });

    it('a merge that removes the LAST surviving key collapses metadata to undefined', () => {
      const { ops, id } = freshPrompt();
      ops.patchOne(scope, id, { metadata: { created_by: 'a@x' } });
      const result = ops.patchOne(scope, id, { metadata: { created_by: null } });
      expect(result.entity.metadata).to.equal(undefined);
    });

    it('name-only patch leaves metadata untouched (absent metadata key)', () => {
      const { ops, id } = freshPrompt();
      ops.patchOne(scope, id, { metadata: { created_by: 'a@x' } });
      const result = ops.patchOne(scope, id, { name: 'renamed only' });
      expect(result.entity.metadata).to.deep.equal({ created_by: 'a@x' });
      expect(result.entity.name).to.equal('renamed only');
    });

    it('400s (nothing mutated) when the metadata merge violates the 100-char author CHECK', () => {
      const { ops, id } = freshPrompt();
      const long = 'x'.repeat(101);
      const result = ops.patchOne(scope, id, { metadata: { created_by: long } });
      expect(result).to.deep.equal({ status: 'bad-request' });
      expect(ops.get(scope, id).metadata).to.equal(undefined);
    });
  });

  describe('patchMetadataBatch', () => {
    it('applies an RFC 7396 merge to every item, one transaction', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const [a, b] = ops.createMany(scope, [{ name: 'a', tags: [] }, { name: 'b', tags: [] }]);
      ops.patchOne(scope, a.id, { metadata: { created_by: 'a@x' } });

      const result = ops.patchMetadataBatch(scope, [
        { id: a.id, metadata: { updated_by: 'edit@x' } },
        { id: b.id, metadata: { created_by: 'b@x' } },
      ]);
      expect(result).to.deep.equal({ status: 'ok' });
      expect(ops.get(scope, a.id).metadata).to.deep.equal({ created_by: 'a@x', updated_by: 'edit@x' });
      expect(ops.get(scope, b.id).metadata).to.deep.equal({ created_by: 'b@x' });
    });

    it('is atomic on an unknown prompt id: 404s and writes NOTHING in the batch', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const [a] = ops.createMany(scope, [{ name: 'a', tags: [] }]);
      const result = ops.patchMetadataBatch(scope, [
        { id: a.id, metadata: { created_by: 'a@x' } },
        { id: 'missing', metadata: { created_by: 'b@x' } },
      ]);
      expect(result).to.deep.equal({ status: 'not-found' });
      expect(ops.get(scope, a.id).metadata).to.equal(undefined); // untouched
    });

    it('is atomic on the author-length CHECK: 400s and writes NOTHING in the batch', () => {
      const ops = createStatefulOps(new InMemoryStore()).prompts;
      const [a, b] = ops.createMany(scope, [{ name: 'a', tags: [] }, { name: 'b', tags: [] }]);
      const long = 'x'.repeat(101);
      const result = ops.patchMetadataBatch(scope, [
        { id: a.id, metadata: { created_by: 'fine@x' } },
        { id: b.id, metadata: { updated_by: long } },
      ]);
      expect(result).to.deep.equal({ status: 'bad-request' });
      expect(ops.get(scope, a.id).metadata).to.equal(undefined); // rolled back too
    });
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
