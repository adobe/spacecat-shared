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
  normalizeText,
  hashText,
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

const TABLE = 'opportunity_semantic_embedding';
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
      order() {
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
            table, eqs: state.eqs, cols: state.cols, limited: state.limited,
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

    it('exposes constants', () => {
      expect(SEMANTIC_INDEX_TABLES).to.deep.equal(['opportunity_semantic_embedding']);
      expect(QUERY_EMBEDDING_TABLE).to.equal('semantic_query_embedding');
      expect(SEMANTIC_SEARCH_RPC).to.equal('rpc_opportunity_semantic_search');
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
      expect(row).to.include({ site_id: SITE_ID, entity_id: ENTITY_ID, source_type: SOURCE_TYPE });
      expect(row.embedding).to.equal('[0.1,0.2]');
      expect(client.calls.delete).to.have.length(1);
      expect(client.calls.delete[0].inFilter.values).to.deep.equal(['stale-hash']);
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
  });

  describe('copyEntityVectors', () => {
    it('validates table + ids', async () => {
      await expect(copyEntityVectors(makeClient(), {
        table: 'nope', siteId: SITE_ID, fromEntityId: 'a', toEntityId: 'b',
      }))
        .to.be.rejectedWith(ValidationError, 'Invalid semantic-index table');
      await expect(copyEntityVectors(makeClient(), { table: TABLE, fromEntityId: 'a', toEntityId: 'b' }))
        .to.be.rejectedWith(ValidationError, 'siteId is required');
    });

    it('returns 0 when the source entity has no rows', async () => {
      const client = makeClient({ selectPages: [{ data: [], error: null }] });
      const n = await copyEntityVectors(client, {
        table: TABLE, siteId: SITE_ID, fromEntityId: 'a', toEntityId: 'b',
      });
      expect(n).to.equal(0);
      expect(client.calls.upsert).to.have.length(0);
    });

    it('copies rows re-pointed to the destination entity', async () => {
      const client = makeClient({
        selectPages: [{
          data: [{
            entity_type: ENTITY_TYPE, source_type: SOURCE_TYPE, source_id: null, source_hash: 'h1', source_text: 't', embedding: '[0.1,0.2]', model: 'm', dims: 2,
          }],
          error: null,
        }],
      });
      const n = await copyEntityVectors(client, {
        table: TABLE, siteId: SITE_ID, fromEntityId: 'a', toEntityId: 'b',
      });
      expect(n).to.equal(1);
      expect(client.calls.upsert[0].rows[0]).to.include({ site_id: SITE_ID, entity_id: 'b', source_hash: 'h1' });
    });

    it('wraps a read error', async () => {
      const client = makeClient({ selectPages: [{ data: null, error: { message: 'boom' } }] });
      await expect(copyEntityVectors(client, {
        table: TABLE, siteId: SITE_ID, fromEntityId: 'a', toEntityId: 'b',
      })).to.be.rejectedWith(DataAccessError, 'Failed to read');
    });
  });

  describe('lookupOpportunitiesByVector', () => {
    it('validates args + vector', async () => {
      await expect(lookupOpportunitiesByVector(makeClient(), {
        sourceType: SOURCE_TYPE, vector: [0.1],
      }))
        .to.be.rejectedWith(ValidationError, 'siteId is required');
      await expect(lookupOpportunitiesByVector(makeClient(), { siteId: SITE_ID, vector: [0.1] }))
        .to.be.rejectedWith(ValidationError, 'sourceType is required');
      await expect(lookupOpportunitiesByVector(makeClient(), {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [],
      }))
        .to.be.rejectedWith(ValidationError, 'vector must be');
    });

    it('calls the ANN RPC and maps rows, using defaults', async () => {
      const client = makeClient({
        rpcResult: { data: [{ entity_id: 'o1', entity_type: ENTITY_TYPE, score: 0.87 }], error: null },
      });
      const out = await lookupOpportunitiesByVector(client, {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [0.1, 0.2],
      });
      expect(out).to.deep.equal([{ entityId: 'o1', entityType: ENTITY_TYPE, score: 0.87 }]);
      expect(client.calls.rpc[0].name).to.equal(SEMANTIC_SEARCH_RPC);
      expect(client.calls.rpc[0].params).to.deep.equal({
        p_site_id: SITE_ID, p_source_type: SOURCE_TYPE, p_query_embedding: '[0.1,0.2]', p_limit: 10, p_min_score: 0,
      });
    });

    it('passes k/minScore and tolerates null data', async () => {
      const client = makeClient({ rpcResult: { data: null, error: null } });
      const out = await lookupOpportunitiesByVector(client, {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [0.1, 0.2], k: 5, minScore: 0.3,
      });
      expect(out).to.deep.equal([]);
      expect(client.calls.rpc[0].params).to.include({ p_limit: 5, p_min_score: 0.3 });
    });

    it('wraps an RPC error', async () => {
      const client = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
      await expect(lookupOpportunitiesByVector(client, {
        siteId: SITE_ID, sourceType: SOURCE_TYPE, vector: [0.1],
      })).to.be.rejectedWith(DataAccessError, 'Failed semantic search');
    });
  });

  describe('semantic_query_embedding cache', () => {
    const MODEL = 'azure/text-embedding-3-small';

    it('getQueryEmbedding validates + returns null on miss', async () => {
      await expect(getQueryEmbedding(makeClient(), { text: 'x', dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'model is required');
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

    it('getQueryEmbedding wraps a read error', async () => {
      const client = makeClient({ getResult: { data: null, error: { message: 'boom' } } });
      await expect(getQueryEmbedding(client, { text: 'x', model: MODEL, dims: 2 }))
        .to.be.rejectedWith(DataAccessError, 'Failed to read semantic_query_embedding');
    });

    it('upsertQueryEmbedding validates + writes + returns the hash', async () => {
      await expect(upsertQueryEmbedding(makeClient(), { text: 'x', dims: 2, vector: [0.1] }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(upsertQueryEmbedding(makeClient(), {
        text: ' ', model: MODEL, dims: 2, vector: [0.1],
      }))
        .to.be.rejectedWith(ValidationError, 'text is required');
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
        text: 'x', model: MODEL, dims: 2, vector: [0.1],
      })).to.be.rejectedWith(DataAccessError, 'Failed to upsert semantic_query_embedding');
    });

    it('touchQueryEmbedding validates + updates last_access_at', async () => {
      await expect(touchQueryEmbedding(makeClient(), { text: 'x', dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(touchQueryEmbedding(makeClient(), { text: '', model: MODEL, dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'text is required');
      const client = makeClient();
      await touchQueryEmbedding(client, { text: 'x', model: MODEL, dims: 2 });
      expect(client.calls.update).to.have.length(1);
      expect(client.calls.update[0].updateVals).to.have.property('last_access_at');
    });

    it('touchQueryEmbedding wraps an error', async () => {
      const client = makeClient({ updateResult: { error: { message: 'boom' } } });
      await expect(touchQueryEmbedding(client, { text: 'x', model: MODEL, dims: 2 }))
        .to.be.rejectedWith(DataAccessError, 'Failed to touch semantic_query_embedding');
    });
  });
});
