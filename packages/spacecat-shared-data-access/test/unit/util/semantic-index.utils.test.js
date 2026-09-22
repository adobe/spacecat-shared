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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { DataAccessError, ValidationError } from '../../../src/errors/index.js';
import {
  SEMANTIC_INDEX_TABLES,
  QUERY_EMBEDDING_TABLE,
  SEMANTIC_SEARCH_RPC,
  COPY_VECTORS_RPC,
  normalizeText,
  hashText,
  cleanTopicText,
  serializeVector,
  parseVector,
  syncOpportunitySemantic,
  copyEntityVectors,
  lookupOpportunitiesByVector,
  getQueryEmbedding,
  upsertQueryEmbedding,
  touchQueryEmbedding,
} from '../../../src/util/semantic-index.utils.js';

chaiUse(chaiAsPromised);

const SITE_ID = 'site-1';
const ENTITY_ID = 'oppty-1';
const ENTITY_TYPE = 'cited-analysis';
const SOURCE_TYPE = 'topic';

/**
 * Chainable, awaitable fake `@supabase/postgrest-js` client. Each chain is classified at its
 * terminal op (upsert/select/delete/update) and recorded; results come from `config`
 * (single values or the `selectPages` queue for paginated reads). `.rpc()` returns `rpcResult`.
 */
function makeClient(config = {}) {
  const calls = {
    upsert: [], select: [], delete: [], update: [], rpc: [],
  };
  const selectPages = Array.isArray(config.selectPages) ? [...config.selectPages] : null;

  function makeBuilder(table) {
    const state = { table, eqs: {} };
    const builder = {
      upsert(rows, options) {
        state.op = 'upsert';
        state.rows = rows;
        state.options = options;
        return builder;
      },
      select(cols) {
        state.op = 'select';
        state.cols = cols;
        return builder;
      },
      delete() {
        state.op = 'delete';
        return builder;
      },
      update(vals) {
        state.op = 'update';
        state.updateVals = vals;
        return builder;
      },
      eq(col, val) {
        state.eqs[col] = val;
        return builder;
      },
      in(col, values) {
        state.inFilter = { column: col, values };
        return builder;
      },
      order(col, opts) {
        state.order = { col, opts };
        return builder;
      },
      range(from, to) {
        state.range = [from, to];
        return builder;
      },
      limit(n) {
        state.limited = n;
        return builder;
      },
      then(resolve, reject) {
        let result;
        if (state.op === 'upsert') {
          calls.upsert.push({ table, rows: state.rows, options: state.options });
          result = config.upsertResult ?? { error: null };
        } else if (state.op === 'delete') {
          calls.delete.push({ table, eqs: state.eqs, inFilter: state.inFilter });
          result = config.deleteResult ?? { error: null };
        } else if (state.op === 'update') {
          calls.update.push({ table, updateVals: state.updateVals, eqs: state.eqs });
          result = config.updateResult ?? { error: null };
        } else {
          calls.select.push({
            table,
            eqs: state.eqs,
            cols: state.cols,
            limited: state.limited,
            order: state.order,
            range: state.range,
          });
          if (state.limited) {
            result = config.getResult ?? { data: [], error: null };
          } else if (selectPages && selectPages.length) {
            result = selectPages.shift();
          } else {
            result = { data: [], error: null };
          }
        }
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    from: (table) => makeBuilder(table),
    rpc: (name, params) => {
      calls.rpc.push({ name, params });
      return Promise.resolve(config.rpcResult ?? { data: [], error: null });
    },
    calls,
  };
}

const src = (text, vector = [0.1, 0.2], extra = {}) => ({
  text, vector, model: 'azure/text-embedding-3-small', dims: 2, ...extra,
});

describe('semantic-index.utils', () => {
  describe('pure helpers', () => {
    it('normalizeText lowercases, collapses whitespace, trims; non-string -> empty', () => {
      expect(normalizeText('  Running   SHOES ')).to.equal('running shoes');
      expect(normalizeText(42)).to.equal('');
    });

    it('hashText is deterministic', () => {
      expect(hashText('running shoes')).to.equal(hashText('running shoes'));
      expect(hashText('a')).to.not.equal(hashText('b'));
    });

    it('cleanTopicText trims, returns embed text + normalized key, drops junk', () => {
      expect(cleanTopicText('  Running   SHOES ')).to.deep.equal({
        text: 'Running   SHOES',
        key: 'running shoes',
      });
      // non-string / empty / whitespace-only -> null
      expect(cleanTopicText(42)).to.equal(null);
      expect(cleanTopicText('')).to.equal(null);
      expect(cleanTopicText('   ')).to.equal(null);
      // length bound is on the trimmed text; default max is MAX_SOURCE_TEXT_LENGTH (2048)
      expect(cleanTopicText('a'.repeat(2048))).to.not.equal(null);
      expect(cleanTopicText('a'.repeat(2049))).to.equal(null);
      // caller-supplied maxLength
      expect(cleanTopicText('abcd', { maxLength: 3 })).to.equal(null);
      expect(cleanTopicText('abc', { maxLength: 3 })).to.deep.equal({ text: 'abc', key: 'abc' });
    });

    it('serializeVector formats a numeric array; rejects invalid input', () => {
      expect(serializeVector([0.1, 0.2, 0.3])).to.equal('[0.1,0.2,0.3]');
      expect(() => serializeVector([])).to.throw(ValidationError);
      expect(() => serializeVector('nope')).to.throw(ValidationError);
      expect(() => serializeVector([1, NaN])).to.throw(ValidationError);
    });

    it('parseVector handles arrays, strings, empties, and junk', () => {
      expect(parseVector([1, 2])).to.deep.equal([1, 2]);
      expect(parseVector('[1,2,3]')).to.deep.equal([1, 2, 3]);
      expect(parseVector('[]')).to.deep.equal([]);
      expect(parseVector('x')).to.equal(null);
      expect(parseVector(42)).to.equal(null);
    });

    it('parseVector returns null (not a NaN array) for a corrupt vector', () => {
      expect(parseVector('[0.1,abc,0.3]')).to.equal(null);
    });

    it('exposes constants', () => {
      expect(SEMANTIC_INDEX_TABLES).to.deep.equal(['opportunity_semantic_embedding']);
      expect(QUERY_EMBEDDING_TABLE).to.equal('semantic_query_embedding');
      expect(SEMANTIC_SEARCH_RPC).to.equal('rpc_opportunity_semantic_search');
      expect(COPY_VECTORS_RPC).to.equal('wrpc_copy_opportunity_semantic_vectors');
    });
  });

  describe('syncOpportunitySemantic', () => {
    it('validates required args', async () => {
      await expect(syncOpportunitySemantic(null))
        .to.be.rejectedWith(ValidationError, 'postgrestClient is required');
      const client = makeClient();
      await expect(syncOpportunitySemantic(client, {
        entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE,
      })).to.be.rejectedWith(ValidationError, 'siteId is required');
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE,
      })).to.be.rejectedWith(ValidationError, 'entityId is required');
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, sourceType: SOURCE_TYPE,
      })).to.be.rejectedWith(ValidationError, 'entityType is required');
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      })).to.be.rejectedWith(ValidationError, 'sourceType is required');
    });

    it('clears the (entity, sourceType) slice when sources is empty', async () => {
      const client = makeClient();
      const count = await syncOpportunitySemantic(client, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [],
      });
      expect(count).to.equal(0);
      expect(client.calls.delete).to.have.length(1);
      expect(client.calls.delete[0].eqs).to.include({
        site_id: SITE_ID, entity_id: ENTITY_ID, source_type: SOURCE_TYPE,
      });
    });

    it('clears the slice when sources is omitted entirely (undefined)', async () => {
      const client = makeClient();
      const count = await syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE,
      });
      expect(count).to.equal(0);
      expect(client.calls.delete).to.have.length(1);
    });

    it('throws when a non-empty sources input yields no valid rows', async () => {
      const client = makeClient();
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE, sources: [{ text: '   ' }],
      })).to.be.rejectedWith(ValidationError, 'pass [] to clear');
    });

    it('upserts rows, dedupes by hash, and prunes stale rows', async () => {
      // read-back returns one kept hash + one stale hash -> stale gets pruned
      const keptHash = hashText(normalizeText('running shoes'));
      const client = makeClient({
        selectPages: [{ data: [{ source_hash: keptHash }, { source_hash: 'stale-hash' }], error: null }],
      });
      const count = await syncOpportunitySemantic(client, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [src('Running Shoes'), src('running   shoes'), src('Trail Runners')],
      });
      // 3 inputs but two normalize to the same hash -> 2 rows
      expect(count).to.equal(2);
      expect(client.calls.upsert).to.have.length(1);
      expect(client.calls.upsert[0].options).to.deep.equal({ onConflict: 'entity_id,source_type,source_hash' });
      const row = client.calls.upsert[0].rows[0];
      // Full row shape — cross-repo write contract (model/dims/original text/hash/null id).
      expect(row).to.include({
        site_id: SITE_ID,
        entity_id: ENTITY_ID,
        source_type: SOURCE_TYPE,
        entity_type: ENTITY_TYPE,
        model: 'azure/text-embedding-3-small',
        dims: 2,
        source_text: 'Running Shoes', // original case, not normalized
        source_id: null,
      });
      expect(row.embedding).to.equal('[0.1,0.2]');
      expect(row.source_hash).to.equal(hashText(normalizeText('Running Shoes')));
      expect(client.calls.delete).to.have.length(1);
      expect(client.calls.delete[0].inFilter.values).to.deep.equal(['stale-hash']);
    });

    it('passes an explicit sourceId through and validates model/dims/vector length', async () => {
      const client = makeClient({ selectPages: [{ data: [], error: null }] });
      await syncOpportunitySemantic(client, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [src('Running Shoes', [0.1, 0.2], { sourceId: 'sid-1' })],
      });
      expect(client.calls.upsert[0].rows[0].source_id).to.equal('sid-1');

      // model/dims/vector-length are hard contract errors on the authoritative write side.
      await expect(syncOpportunitySemantic(makeClient(), {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [{ text: 'x', vector: [0.1, 0.2], dims: 2 }], // missing model
      })).to.be.rejectedWith(ValidationError, 'model is required');
      await expect(syncOpportunitySemantic(makeClient(), {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [src('x', [0.1, 0.2], { dims: 1536 })], // vector length 2 != dims 1536
      })).to.be.rejectedWith(ValidationError, 'does not match dims');
      await expect(syncOpportunitySemantic(makeClient(), {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [src('x', [0.1, 0.2], { model: 'm'.repeat(129) })], // model over the length cap
      })).to.be.rejectedWith(ValidationError, 'model must be at most 128 characters');
    });

    it('handles an empty read-back (nothing to prune)', async () => {
      const client = makeClient({ selectPages: [{ data: [], error: null }] });
      const count = await syncOpportunitySemantic(client, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [src('running shoes')],
      });
      expect(count).to.equal(1);
      expect(client.calls.delete).to.have.length(0);
    });

    it('does not prune when no stale rows exist', async () => {
      const keptHash = hashText(normalizeText('running shoes'));
      const client = makeClient({
        selectPages: [{ data: [{ source_hash: keptHash }], error: null }],
      });
      await syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE, sources: [src('running shoes')],
      });
      expect(client.calls.delete).to.have.length(0);
    });

    it('wraps a clear error', async () => {
      const client = makeClient({ deleteResult: { error: { message: 'boom' } } });
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [],
      })).to.be.rejectedWith(DataAccessError, 'Failed to clear');
    });

    it('wraps an upsert error', async () => {
      const client = makeClient({ upsertResult: { error: { message: 'boom' } } });
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE, sources: [src('x')],
      })).to.be.rejectedWith(DataAccessError, 'Failed to sync');
    });

    it('wraps a read-back error', async () => {
      const client = makeClient({ selectPages: [{ data: null, error: { message: 'boom' } }] });
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE, sources: [src('x')],
      })).to.be.rejectedWith(DataAccessError, 'Failed to read');
    });

    it('wraps a prune error', async () => {
      const client = makeClient({
        selectPages: [{ data: [{ source_hash: 'stale' }], error: null }],
        deleteResult: { error: { message: 'boom' } },
      });
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE, sources: [src('x')],
      })).to.be.rejectedWith(DataAccessError, 'Failed to prune');
    });

    it('paginates the stale-hash read-back across pages (>DEFAULT_PAGE_SIZE)', async () => {
      const keptHash = hashText(normalizeText('kept'));
      const page1 = Array.from({ length: 1000 }, (_, i) => ({ source_hash: `h${i}` }));
      const client = makeClient({
        selectPages: [
          { data: page1, error: null },
          { data: [{ source_hash: keptHash }], error: null },
        ],
      });
      await syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE, sources: [src('kept')],
      });
      // both page windows fetched, ordered by source_hash asc
      expect(client.calls.select).to.have.length(2);
      expect(client.calls.select[0].range).to.deep.equal([0, 999]);
      expect(client.calls.select[1].range).to.deep.equal([1000, 1999]);
      expect(client.calls.select[0].order).to.deep.equal({ col: 'source_hash', opts: { ascending: true } });
      // stale set spans page 1 (1000 hashes) -> pruned; keptHash (page 2) is retained
      const deleted = client.calls.delete.flatMap((d) => d.inFilter.values);
      expect(deleted).to.have.length(1000);
      expect(deleted).to.not.include(keptHash);
    });

    it('stops paginating when an exactly-full page is followed by an empty page (boundary)', async () => {
      // page 1 returns exactly DEFAULT_PAGE_SIZE (keepGoing stays true) -> a second fetch that
      // returns empty ends the loop via the empty-page branch, not the < PAGE_SIZE branch.
      const keptHash = hashText(normalizeText('kept'));
      const page1 = Array.from({ length: 1000 }, (_, i) => (i === 0 ? { source_hash: keptHash } : { source_hash: `h${i}` }));
      const client = makeClient({
        selectPages: [
          { data: page1, error: null },
          { data: [], error: null },
        ],
      });
      await syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: SOURCE_TYPE, sources: [src('kept')],
      });
      expect(client.calls.select).to.have.length(2);
      expect(client.calls.select[1].range).to.deep.equal([1000, 1999]);
      // 999 stale (page 1 minus keptHash) pruned; keptHash retained
      const deleted = client.calls.delete.flatMap((d) => d.inFilter.values);
      expect(deleted).to.have.length(999);
      expect(deleted).to.not.include(keptHash);
    });

    it('chunks upsert + delete beyond SEMANTIC_CHUNK_SIZE (and single chunk at exactly the size)', async () => {
      // 21 sources -> 2 upsert chunks (20 + 1); read-back has 21 stale -> 2 delete chunks.
      const sources21 = Array.from({ length: 21 }, (_, i) => src(`topic ${i}`));
      const stale21 = Array.from({ length: 21 }, (_, i) => ({ source_hash: `stale-${i}` }));
      const client = makeClient({ selectPages: [{ data: stale21, error: null }] });
      await syncOpportunitySemantic(client, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: sources21,
      });
      expect(client.calls.upsert).to.have.length(2);
      expect(client.calls.delete).to.have.length(2);

      // exactly 20 sources -> a single upsert chunk (boundary).
      const sources20 = Array.from({ length: 20 }, (_, i) => src(`topic ${i}`));
      const client20 = makeClient({ selectPages: [{ data: [], error: null }] });
      await syncOpportunitySemantic(client20, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: sources20,
      });
      expect(client20.calls.upsert).to.have.length(1);
    });
  });

  describe('copyEntityVectors', () => {
    it('validates the client + ids', async () => {
      await expect(copyEntityVectors({}, { siteId: SITE_ID, fromEntityId: 'a', toEntityId: 'b' }))
        .to.be.rejectedWith(ValidationError, 'postgrestClient is required');
      await expect(copyEntityVectors(makeClient(), { fromEntityId: 'a', toEntityId: 'b' }))
        .to.be.rejectedWith(ValidationError, 'siteId is required');
      await expect(copyEntityVectors(makeClient(), { siteId: SITE_ID, toEntityId: 'b' }))
        .to.be.rejectedWith(ValidationError, 'fromEntityId is required');
      await expect(copyEntityVectors(makeClient(), { siteId: SITE_ID, fromEntityId: 'a' }))
        .to.be.rejectedWith(ValidationError, 'toEntityId is required');
    });

    it('calls the copy RPC and returns the inserted count', async () => {
      const client = makeClient({ rpcResult: { data: 3, error: null } });
      const n = await copyEntityVectors(client, {
        siteId: SITE_ID, fromEntityId: 'a', toEntityId: 'b',
      });
      expect(n).to.equal(3);
      expect(client.calls.rpc).to.deep.equal([{
        name: 'wrpc_copy_opportunity_semantic_vectors',
        params: { p_site_id: SITE_ID, p_from_entity_id: 'a', p_to_entity_id: 'b' },
      }]);
    });

    it('returns 0 when the RPC reports no inserted rows (null data)', async () => {
      const client = makeClient({ rpcResult: { data: null, error: null } });
      const n = await copyEntityVectors(client, {
        siteId: SITE_ID, fromEntityId: 'a', toEntityId: 'b',
      });
      expect(n).to.equal(0);
    });

    it('wraps an RPC error', async () => {
      const client = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
      await expect(copyEntityVectors(client, {
        siteId: SITE_ID, fromEntityId: 'a', toEntityId: 'b',
      })).to.be.rejectedWith(DataAccessError, 'Failed to copy semantic vectors');
    });
  });

  describe('lookupOpportunitiesByVector', () => {
    const MODEL = 'azure/text-embedding-3-small';

    it('validates args + vector + model/dims (generation scope)', async () => {
      await expect(lookupOpportunitiesByVector(makeClient(), {
        sourceType: SOURCE_TYPE, vector: [0.1], model: MODEL, dims: 2,
      }))
        .to.be.rejectedWith(ValidationError, 'siteId is required');
      await expect(lookupOpportunitiesByVector(makeClient(), {
        siteId: SITE_ID, vector: [0.1], model: MODEL, dims: 2,
      }))
        .to.be.rejectedWith(ValidationError, 'sourceType is required');
      await expect(lookupOpportunitiesByVector(makeClient(), {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [0.1], dims: 2,
      }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(lookupOpportunitiesByVector(makeClient(), {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [0.1], model: MODEL,
      }))
        .to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(lookupOpportunitiesByVector(makeClient(), {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [], model: MODEL, dims: 2,
      }))
        .to.be.rejectedWith(ValidationError, 'vector must be');
    });

    it('calls the ANN RPC scoped to model/dims and maps rows, using defaults', async () => {
      const client = makeClient({
        rpcResult: { data: [{ entity_id: 'o1', entity_type: ENTITY_TYPE, score: 0.87 }], error: null },
      });
      const out = await lookupOpportunitiesByVector(client, {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [0.1, 0.2], model: MODEL, dims: 2,
      });
      expect(out).to.deep.equal([{ entityId: 'o1', entityType: ENTITY_TYPE, score: 0.87 }]);
      expect(client.calls.rpc[0].name).to.equal(SEMANTIC_SEARCH_RPC);
      expect(client.calls.rpc[0].params).to.deep.equal({
        p_site_id: SITE_ID,
        p_source_type: SOURCE_TYPE,
        p_query_embedding: '[0.1,0.2]',
        p_model: MODEL,
        p_dims: 2,
        p_limit: 10,
        p_min_score: 0,
      });
    });

    it('passes k/minScore and tolerates null data', async () => {
      const client = makeClient({ rpcResult: { data: null, error: null } });
      const out = await lookupOpportunitiesByVector(client, {
        siteId: SITE_ID,
        sourceType: SOURCE_TYPE,
        vector: [0.1, 0.2],
        model: MODEL,
        dims: 2,
        k: 5,
        minScore: 0.3,
      });
      expect(out).to.deep.equal([]);
      expect(client.calls.rpc[0].params).to.include({ p_limit: 5, p_min_score: 0.3 });
    });

    it('wraps an RPC error', async () => {
      const client = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
      await expect(lookupOpportunitiesByVector(client, {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [0.1], model: MODEL, dims: 2,
      })).to.be.rejectedWith(DataAccessError, 'Failed semantic search');
    });
  });

  describe('semantic_query_embedding cache', () => {
    const MODEL = 'azure/text-embedding-3-small';

    it('getQueryEmbedding validates + returns null on miss', async () => {
      await expect(getQueryEmbedding(makeClient(), { text: 'x', dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(getQueryEmbedding(makeClient(), { text: 'x', model: MODEL }))
        .to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(getQueryEmbedding(makeClient(), { text: 'x', model: MODEL, dims: 1.5 }))
        .to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(getQueryEmbedding(makeClient(), { text: '  ', model: MODEL, dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'text is required');
      const miss = await getQueryEmbedding(makeClient({ getResult: { data: [], error: null } }), { text: 'x', model: MODEL, dims: 2 });
      expect(miss).to.equal(null);
    });

    it('getQueryEmbedding returns a parsed vector on hit', async () => {
      const client = makeClient({ getResult: { data: [{ embedding: '[0.1,0.2]' }], error: null } });
      const hit = await getQueryEmbedding(client, { text: 'Running Shoes', model: MODEL, dims: 2 });
      expect(hit.vector).to.deep.equal([0.1, 0.2]);
      expect(hit.textHash).to.equal(hashText(normalizeText('Running Shoes')));
      expect(client.calls.select[0].eqs).to.include({ model: MODEL, dims: 2 });
    });

    it('getQueryEmbedding treats a corrupt cached vector as a miss (null)', async () => {
      const client = makeClient({ getResult: { data: [{ embedding: '[0.1,abc]' }], error: null } });
      const hit = await getQueryEmbedding(client, { text: 'x', model: MODEL, dims: 2 });
      expect(hit).to.equal(null);
    });

    it('getQueryEmbedding wraps a read error', async () => {
      const client = makeClient({ getResult: { data: null, error: { message: 'boom' } } });
      await expect(getQueryEmbedding(client, { text: 'x', model: MODEL, dims: 2 }))
        .to.be.rejectedWith(DataAccessError, 'Failed to read semantic_query_embedding');
    });

    it('upsertQueryEmbedding validates + writes + returns the hash', async () => {
      await expect(upsertQueryEmbedding(makeClient(), { text: 'x', dims: 2, vector: [0.1] }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(upsertQueryEmbedding(makeClient(), { text: 'x', model: MODEL, vector: [0.1] }))
        .to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(upsertQueryEmbedding(makeClient(), {
        text: ' ', model: MODEL, dims: 2, vector: [0.1, 0.2],
      }))
        .to.be.rejectedWith(ValidationError, 'text is required');
      await expect(upsertQueryEmbedding(makeClient(), {
        text: 'x', model: MODEL, dims: 2, vector: [0.1], // length 1 != dims 2
      }))
        .to.be.rejectedWith(ValidationError, 'does not match dims');
      const client = makeClient();
      const h = await upsertQueryEmbedding(client, {
        text: 'Running Shoes', model: MODEL, dims: 2, vector: [0.1, 0.2],
      });
      expect(h).to.equal(hashText(normalizeText('Running Shoes')));
      const row = client.calls.upsert[0].rows;
      expect(row).to.include({
        model: MODEL, dims: 2, normalized_text: 'running shoes', embedding: '[0.1,0.2]',
      });
      expect(client.calls.upsert[0].options).to.deep.equal({ onConflict: 'text_hash,model,dims' });
    });

    it('upsertQueryEmbedding wraps an error', async () => {
      const client = makeClient({ upsertResult: { error: { message: 'boom' } } });
      await expect(upsertQueryEmbedding(client, {
        text: 'x', model: MODEL, dims: 2, vector: [0.1, 0.2],
      })).to.be.rejectedWith(DataAccessError, 'Failed to upsert semantic_query_embedding');
    });

    it('touchQueryEmbedding validates + updates last_access_at', async () => {
      await expect(touchQueryEmbedding(makeClient(), { text: 'x', dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(touchQueryEmbedding(makeClient(), { text: 'x', model: MODEL, dims: 0 }))
        .to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(touchQueryEmbedding(makeClient(), { model: MODEL, dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'text or textHash is required');
      const client = makeClient();
      await touchQueryEmbedding(client, { text: 'Running Shoes', model: MODEL, dims: 2 });
      expect(client.calls.update).to.have.length(1);
      expect(client.calls.update[0].updateVals).to.have.property('last_access_at');
      // derived-hash path keys on hash(normalize(text))
      expect(client.calls.update[0].eqs.text_hash).to.equal(hashText(normalizeText('Running Shoes')));
    });

    it('touchQueryEmbedding uses a provided textHash without re-deriving it', async () => {
      const client = makeClient();
      await touchQueryEmbedding(client, {
        model: MODEL, dims: 2, textHash: 'precomputed-hash',
      });
      expect(client.calls.update).to.have.length(1);
      expect(client.calls.update[0].eqs).to.include({ text_hash: 'precomputed-hash', model: MODEL, dims: 2 });
    });

    it('touchQueryEmbedding wraps an error', async () => {
      const client = makeClient({ updateResult: { error: { message: 'boom' } } });
      await expect(touchQueryEmbedding(client, { text: 'x', model: MODEL, dims: 2 }))
        .to.be.rejectedWith(DataAccessError, 'Failed to touch semantic_query_embedding');
    });
  });
});
