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
import * as utils from '@adobe/spacecat-shared-utils';

import { DataAccessError, ValidationError } from '../../../src/errors/index.js';
import {
  SEMANTIC_INDEX_TABLES,
  QUERY_EMBEDDING_TABLE,
  SEMANTIC_SEARCH_RPC,
  OPPORTUNITY_SEMANTIC_SOURCE_TYPES,
  OPPORTUNITY_SEMANTIC_ENTITY_TYPES,
  SEMANTIC_MATCHING_CONFIG,
  normalizeText,
  hashText,
  cleanTopicText,
  serializeVector,
  parseVector,
  syncOpportunitySemantic,
  lookupOpportunitiesByVectors,
  getQueryEmbeddings,
  upsertQueryEmbeddings,
  touchQueryEmbeddings,
} from '../../../src/util/semantic-index.utils.js';

chaiUse(chaiAsPromised);

const SITE_ID = 'site-1';
const ENTITY_ID = 'oppty-1';
const ENTITY_TYPE = 'cited-analysis';
const SOURCE_TYPE = 'topic';
const INVALID_SOURCE_TYPE = 'not-a-source-type';
const INVALID_ENTITY_TYPE = 'not-an-entity-type';
const PGRST202_HINT = 'signature not found (data-service release not deployed, argument names/types drifted, or a stale PostgREST schema cache)';
const { model: MODEL, dims: DIMS } = SEMANTIC_MATCHING_CONFIG.embedding;

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
  const rpcResults = Array.isArray(config.rpcResults) ? [...config.rpcResults] : null;

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
          calls.update.push({
            table, updateVals: state.updateVals, eqs: state.eqs, inFilter: state.inFilter,
          });
          result = config.updateResult ?? { error: null };
        } else {
          calls.select.push({
            table,
            eqs: state.eqs,
            cols: state.cols,
            limited: state.limited,
            order: state.order,
            range: state.range,
            inFilter: state.inFilter,
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
      if (rpcResults && rpcResults.length) {
        return Promise.resolve(rpcResults.shift());
      }
      return Promise.resolve(config.rpcResult ?? { data: [], error: null });
    },
    calls,
  };
}

const src = (text, vector = [0.1, 0.2], extra = {}) => ({
  text, vector, model: MODEL, dims: 2, ...extra,
});

describe('semantic-index.utils', () => {
  describe('pure helpers', () => {
    it('re-exports the source/entity type registries from utils', () => {
      expect(OPPORTUNITY_SEMANTIC_SOURCE_TYPES).to.equal(utils.OPPORTUNITY_SEMANTIC_SOURCE_TYPES);
      expect(OPPORTUNITY_SEMANTIC_ENTITY_TYPES).to.equal(utils.OPPORTUNITY_SEMANTIC_ENTITY_TYPES);
    });

    it('exposes the frozen embedding generation', () => {
      expect(SEMANTIC_MATCHING_CONFIG).to.deep.equal({
        embedding: { model: 'azure/text-embedding-3-small', dims: 1536 },
      });
      expect(Object.isFrozen(SEMANTIC_MATCHING_CONFIG)).to.equal(true);
      expect(Object.isFrozen(SEMANTIC_MATCHING_CONFIG.embedding)).to.equal(true);
    });

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
    });
  });

  describe('syncOpportunitySemantic', () => {
    it('renders a value that neither JSON nor String can print', async () => {
      const unprintable = Object.assign(Object.create(null), { big: 10n });
      await expect(syncOpportunitySemantic(makeClient(), {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, sourceType: unprintable,
      })).to.be.rejectedWith(ValidationError, '(got [unprintable])');
    });

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
        siteId: SITE_ID, entityId: ENTITY_ID, sourceType: SOURCE_TYPE, sources: [src('x')],
      })).to.be.rejectedWith(ValidationError, /^entityType must be one of: .+ \(got undefined\)$/);
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: INVALID_ENTITY_TYPE, sourceType: SOURCE_TYPE, sources: [src('x')],
      })).to.be.rejectedWith(ValidationError, `(got "${INVALID_ENTITY_TYPE}")`);
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      })).to.be.rejectedWith(ValidationError, /^sourceType must be one of: .+ \(got undefined\)$/);
      await expect(syncOpportunitySemantic(client, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        sourceType: INVALID_SOURCE_TYPE,
      })).to.be.rejectedWith(ValidationError, `(got "${INVALID_SOURCE_TYPE}")`);
      expect(client.calls.upsert).to.have.length(0);
      expect(client.calls.delete).to.have.length(0);
    });

    it('clears an entity whose entityType is no longer registered', async () => {
      const client = makeClient();
      const count = await syncOpportunitySemantic(client, {
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: INVALID_ENTITY_TYPE,
        sourceType: SOURCE_TYPE,
        sources: [],
      });
      expect(count).to.equal(0);
      expect(client.calls.delete).to.have.length(1);
      expect(client.calls.upsert).to.have.length(0);
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
      // Full row shape (the write contract).
      expect(row).to.include({
        site_id: SITE_ID,
        entity_id: ENTITY_ID,
        source_type: SOURCE_TYPE,
        entity_type: ENTITY_TYPE,
        model: MODEL,
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

      // model/dims/vector-length violations throw rather than being dropped.
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
        sources: [src('x', [0.1, 0.2], { dims: DIMS })], // vector length 2 != DIMS
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
      // A full page followed by an empty one ends via the empty-page branch.
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

  describe('lookupOpportunitiesByVectors', () => {
    const base = {
      siteId: SITE_ID, sourceTypes: [SOURCE_TYPE], model: MODEL, dims: 2,
    };
    const vecs = (n) => Array.from({ length: n }, () => [0.1, 0.2]);
    const groupSizes = (client) => client.calls.rpc.map((c) => c.params.p_query_embeddings.length);

    it('validates args, vectors, k, and model/dims (generation scope)', async () => {
      const call = (over) => lookupOpportunitiesByVectors(makeClient(), {
        ...base, vectors: [[0.1, 0.2]], ...over,
      });
      await expect(call({ siteId: undefined })).to.be.rejectedWith(ValidationError, 'siteId is required');
      await expect(call({ sourceTypes: undefined })).to.be.rejectedWith(ValidationError, 'sourceTypes must be a non-empty array');
      await expect(call({ sourceTypes: [] })).to.be.rejectedWith(ValidationError, 'sourceTypes must be a non-empty array');
      await expect(call({ sourceTypes: 'topic' })).to.be.rejectedWith(ValidationError, 'sourceTypes must be an array');
      await expect(call({ sourceTypes: ['topic', INVALID_SOURCE_TYPE] })).to.be.rejectedWith(ValidationError, /^sourceTypes must only contain: .+ \(got \["not-a-source-type"\]\)$/);
      await expect(call({ sourceTypes: ['*'] })).to.be.rejectedWith(ValidationError, 'sourceTypes must only contain');
      await expect(call({ entityTypes: 'cited-analysis' })).to.be.rejectedWith(ValidationError, 'entityTypes must be an array');
      await expect(call({ entityTypes: ['cited-analysis', null] })).to.be.rejectedWith(ValidationError, /^entityTypes must only contain: .+ \(got \[null\]\)$/);
      await expect(call({ entityTypes: [INVALID_ENTITY_TYPE] })).to.be.rejectedWith(ValidationError, `(got ["${INVALID_ENTITY_TYPE}"])`);
      // eslint-disable-next-line no-sparse-arrays
      await expect(call({ sourceTypes: [, 'topic'] })).to.be.rejectedWith(ValidationError, /^sourceTypes must only contain: .+ \(got \[undefined\]\)$/);
      await expect(call({ entityTypes: new Array(1) })).to.be.rejectedWith(ValidationError, 'entityTypes must only contain');
      await expect(call({ model: undefined })).to.be.rejectedWith(ValidationError, 'model is required');
      await expect(call({ dims: undefined })).to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(call({ vectors: 'x' })).to.be.rejectedWith(ValidationError, 'vectors must be an array');
      await expect(call({ vectors: [[]] })).to.be.rejectedWith(ValidationError, 'vector must be');
      await expect(call({ vectors: [[0.1]] })).to.be.rejectedWith(ValidationError, 'does not match dims');
      await expect(call({ k: 0 })).to.be.rejectedWith(ValidationError, 'k must be an integer between 1 and 1000');
      await expect(call({ k: 1.5 })).to.be.rejectedWith(ValidationError, 'k must be');
      await expect(call({ k: 1001 })).to.be.rejectedWith(ValidationError, 'k must be');
      await expect(call({ minScore: '0.5' })).to.be.rejectedWith(ValidationError, 'minScore must be a finite number');
      await expect(call({ minScore: NaN })).to.be.rejectedWith(ValidationError, 'minScore must be');
    });

    it('returns [] without calling the RPC for no vectors', async () => {
      const client = makeClient();
      const out = await lookupOpportunitiesByVectors(client, { ...base, vectors: [] });
      expect(out).to.deep.equal([]);
      expect(client.calls.rpc).to.have.length(0);
    });

    it('sends the vectors in one call with defaults and splits rows per query, in input order', async () => {
      const client = makeClient({
        rpcResult: {
          data: [
            {
              query_index: 0, entity_id: 'o1', entity_type: ENTITY_TYPE, score: 0.9,
            },
            {
              query_index: 0, entity_id: 'o2', entity_type: ENTITY_TYPE, score: 0.7,
            },
            {
              query_index: 2, entity_id: 'o3', entity_type: ENTITY_TYPE, score: 0.8,
            },
          ],
          error: null,
        },
      });
      const out = await lookupOpportunitiesByVectors(client, {
        ...base, vectors: [[0.1, 0.2], [0.3, 0.4], [0.5, 0.6]],
      });
      expect(out).to.deep.equal([
        [{ entityId: 'o1', entityType: ENTITY_TYPE, score: 0.9 }, { entityId: 'o2', entityType: ENTITY_TYPE, score: 0.7 }],
        [],
        [{ entityId: 'o3', entityType: ENTITY_TYPE, score: 0.8 }],
      ]);
      expect(client.calls.rpc).to.have.length(1);
      expect(client.calls.rpc[0].name).to.equal(SEMANTIC_SEARCH_RPC);
      expect(client.calls.rpc[0].params).to.deep.equal({
        p_site_id: SITE_ID,
        p_source_types: [SOURCE_TYPE],
        p_entity_types: null,
        p_query_embeddings: ['[0.1,0.2]', '[0.3,0.4]', '[0.5,0.6]'],
        p_model: MODEL,
        p_dims: 2,
        p_limit: 10,
        p_min_score: 0,
      });
    });

    it('dedups type lists; an empty entityTypes sends no entity filter', async () => {
      const client = makeClient({ rpcResult: { data: [], error: null } });
      await lookupOpportunitiesByVectors(client, {
        ...base,
        sourceTypes: [SOURCE_TYPE, SOURCE_TYPE],
        entityTypes: ['reddit-analysis', 'cited-analysis', 'reddit-analysis'],
        vectors: [[0.1, 0.2]],
      });
      await lookupOpportunitiesByVectors(client, {
        ...base, entityTypes: [], vectors: [[0.1, 0.2]],
      });
      await lookupOpportunitiesByVectors(client, {
        ...base, entityTypes: null, vectors: [[0.1, 0.2]],
      });
      expect(client.calls.rpc[0].params.p_source_types).to.deep.equal([SOURCE_TYPE]);
      expect(client.calls.rpc[0].params.p_entity_types).to.deep.equal(['reddit-analysis', 'cited-analysis']);
      expect(client.calls.rpc[1].params.p_entity_types).to.equal(null);
      expect(client.calls.rpc[2].params.p_entity_types).to.equal(null);
    });

    it('sends deduped statuses as p_statuses, and omits p_statuses when none are given', async () => {
      const client = makeClient({ rpcResult: { data: [], error: null } });
      await lookupOpportunitiesByVectors(client, {
        ...base, statuses: ['NEW', 'RESOLVED', 'NEW'], vectors: [[0.1, 0.2]],
      });
      await lookupOpportunitiesByVectors(client, { ...base, statuses: [], vectors: [[0.1, 0.2]] });
      await lookupOpportunitiesByVectors(client, {
        ...base, statuses: null, vectors: [[0.1, 0.2]],
      });
      expect(client.calls.rpc[0].params.p_statuses).to.deep.equal(['NEW', 'RESOLVED']);
      expect(client.calls.rpc[1].params).to.not.have.property('p_statuses');
      expect(client.calls.rpc[2].params).to.not.have.property('p_statuses');
    });

    it('rejects statuses outside Opportunity.STATUSES without calling the RPC', async () => {
      const client = makeClient();
      const call = (statuses) => lookupOpportunitiesByVectors(client, {
        ...base, statuses, vectors: [[0.1, 0.2]],
      });
      await expect(call('NEW')).to.be.rejectedWith(ValidationError, 'statuses must be an array');
      await expect(call(['NEW', 'new', ' NEW'])).to.be.rejectedWith(
        ValidationError,
        'statuses must only contain: NEW, IN_PROGRESS, IGNORED, RESOLVED (got ["new"," NEW"])',
      );
      await expect(call(['NEW', 1])).to.be.rejectedWith(ValidationError, '(got [1])');
      await expect(call(new Array(1))).to.be.rejectedWith(ValidationError, 'statuses must only contain');
      expect(client.calls.rpc).to.be.empty;
    });

    it('renders rejected values safely: unserializable falls back to String, long ones are truncated', async () => {
      const call = (over) => lookupOpportunitiesByVectors(makeClient(), {
        ...base, vectors: [[0.1, 0.2]], ...over,
      });
      const circular = {};
      circular.self = circular;
      await expect(call({ sourceTypes: [10n] })).to.be.rejectedWith(ValidationError, '(got [10])');
      await expect(call({ entityTypes: ['topic', circular] })).to.be.rejectedWith(ValidationError, '(got ["topic",[object Object]])');
      const err = await call({ sourceTypes: ['x'.repeat(500)] }).catch((e) => e);
      expect(err).to.be.instanceOf(ValidationError);
      expect(err.message).to.match(/\(got \["x{198}\.\.\.\)$/);
    });

    it('sanitizes rejected values to printable ASCII so the message is safe for an HTTP header', async () => {
      const call = (over) => lookupOpportunitiesByVectors(makeClient(), {
        ...base, vectors: [[0.1, 0.2]], ...over,
      });
      const printable = /^[\x20-\x7E]*$/;
      const emoji = await call({ sourceTypes: ['\u{1F600}'] }).catch((e) => e);
      expect(emoji.message).to.include('(got ["??"])').and.match(printable);
      const control = await call({ entityTypes: ['a\x7Fb'] }).catch((e) => e);
      expect(control.message).to.include('(got ["a?b"])').and.match(printable);
      // Sanitized before truncating, so a multi-byte value can't leave half a surrogate pair.
      const long = await call({ sourceTypes: ['\u{1F600}'.repeat(300)] }).catch((e) => e);
      expect(long.message).to.match(/\(got \["\?{198}\.\.\.\)$/).and.match(printable);
    });

    it('groups vectors by SEMANTIC_CHUNK_SIZE and offsets each group\'s query_index', async () => {
      const client = makeClient({
        rpcResults: [
          { data: [], error: null },
          {
            data: [{
              query_index: 0, entity_id: 'o21', entity_type: ENTITY_TYPE, score: 0.6,
            }],
            error: null,
          },
        ],
      });
      const out = await lookupOpportunitiesByVectors(client, { ...base, vectors: vecs(25) });
      expect(groupSizes(client)).to.deep.equal([20, 5]);
      expect(out).to.have.length(25);
      expect(out[20]).to.deep.equal([{ entityId: 'o21', entityType: ENTITY_TYPE, score: 0.6 }]);
      expect(out[0]).to.deep.equal([]);
    });

    it('shrinks the group when k is large so group x k stays within max-rows', async () => {
      const client = makeClient();
      await lookupOpportunitiesByVectors(client, { ...base, vectors: vecs(25), k: 100 });
      expect(groupSizes(client)).to.deep.equal([10, 10, 5]);
    });

    it('passes k/minScore and tolerates null data', async () => {
      const client = makeClient({ rpcResult: { data: null, error: null } });
      const out = await lookupOpportunitiesByVectors(client, {
        ...base, vectors: [[0.1, 0.2]], k: 5, minScore: 0.3,
      });
      expect(out).to.deep.equal([[]]);
      expect(client.calls.rpc[0].params).to.include({ p_limit: 5, p_min_score: 0.3 });
    });

    it('wraps an RPC error with the searched type lists', async () => {
      const client = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
      const err = await lookupOpportunitiesByVectors(client, {
        ...base, entityTypes: ['reddit-analysis'], vectors: [[0.1, 0.2]],
      }).catch((e) => e);
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.include('Failed semantic search');
      expect(err.message).to.not.include('signature not found');
      expect(err.details).to.deep.equal({
        siteId: SITE_ID, sourceTypes: [SOURCE_TYPE], entityTypes: ['reddit-analysis'],
      });
      const withStatuses = await lookupOpportunitiesByVectors(client, {
        ...base, statuses: ['NEW'], vectors: [[0.1, 0.2]],
      }).catch((e) => e);
      expect(withStatuses.details).to.deep.equal({
        siteId: SITE_ID, sourceTypes: [SOURCE_TYPE], entityTypes: null, statuses: ['NEW'],
      });
    });

    it('adds a deploy-ordering hint when PostgREST cannot find the RPC signature', async () => {
      const cause = { code: 'PGRST202', message: 'Could not find the function' };
      const client = makeClient({ rpcResult: { data: null, error: cause } });
      const err = await lookupOpportunitiesByVectors(client, {
        ...base, vectors: [[0.1, 0.2]],
      }).catch((e) => e);
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed semantic search for site ${SITE_ID}: ${SEMANTIC_SEARCH_RPC} ${PGRST202_HINT}`);
      expect(err.cause).to.equal(cause);
      expect(err.details).to.deep.equal({
        siteId: SITE_ID, sourceTypes: [SOURCE_TYPE], entityTypes: null,
      });
      const withStatuses = await lookupOpportunitiesByVectors(client, {
        ...base, statuses: ['NEW'], vectors: [[0.1, 0.2]],
      }).catch((e) => e);
      expect(withStatuses.message).to.equal(`Failed semantic search for site ${SITE_ID}: ${SEMANTIC_SEARCH_RPC} ${PGRST202_HINT}`);
      expect(withStatuses.details.statuses).to.deep.equal(['NEW']);
    });

    it('rejects a query_index outside the current group (never spills into another group)', async () => {
      const row = (queryIndex) => ({
        query_index: queryIndex, entity_id: 'o1', entity_type: ENTITY_TYPE, score: 0.5,
      });
      for (const bad of [20, -1, 1.5, null]) {
        const client = makeClient({ rpcResult: { data: [row(bad)], error: null } });
        // eslint-disable-next-line no-await-in-loop
        await expect(lookupOpportunitiesByVectors(client, { ...base, vectors: vecs(25) }))
          .to.be.rejectedWith(DataAccessError, `Unexpected query_index ${bad}`);
      }
      const client = makeClient({ rpcResult: { data: [row(5)], error: null } });
      const err = await lookupOpportunitiesByVectors(client, {
        ...base, statuses: ['NEW'], vectors: [[0.1, 0.2]],
      }).catch((e) => e);
      expect(err.details.statuses).to.deep.equal(['NEW']);
    });
  });

  describe('semantic_query_embedding cache', () => {
    const scope = { model: MODEL, dims: 2 };
    const texts = (n) => Array.from({ length: n }, (_, i) => `topic ${i}`);

    it('getQueryEmbeddings validates its inputs', async () => {
      await expect(getQueryEmbeddings(makeClient(), { texts: ['x'], dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(getQueryEmbeddings(makeClient(), { texts: ['x'], model: MODEL, dims: 1.5 }))
        .to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(getQueryEmbeddings(makeClient(), { texts: 'x', ...scope }))
        .to.be.rejectedWith(ValidationError, 'texts must be an array');
      await expect(getQueryEmbeddings(makeClient(), { texts: ['x', '  '], ...scope }))
        .to.be.rejectedWith(ValidationError, 'text is required');
    });

    it('getQueryEmbeddings returns hits/misses in input order from one deduped read', async () => {
      const hash = hashText(normalizeText('Running Shoes'));
      const corruptHash = hashText(normalizeText('corrupt'));
      const client = makeClient({
        selectPages: [{
          data: [
            { text_hash: hash, embedding: '[0.1,0.2]' },
            { text_hash: corruptHash, embedding: '[0.1,abc]' },
          ],
          error: null,
        }],
      });
      const out = await getQueryEmbeddings(client, {
        texts: ['Running Shoes', 'miss', 'running   SHOES', 'corrupt'], ...scope,
      });
      expect(out).to.deep.equal([
        { vector: [0.1, 0.2], textHash: hash },
        null,
        { vector: [0.1, 0.2], textHash: hash },
        null, // a corrupt cached vector is a miss
      ]);
      expect(client.calls.select).to.have.length(1);
      expect(client.calls.select[0].eqs).to.deep.equal({ model: MODEL, dims: 2 });
      expect(client.calls.select[0].inFilter.column).to.equal('text_hash');
      expect(client.calls.select[0].inFilter.values).to.have.length(3);
    });

    it('getQueryEmbeddings reads in groups of QUERY_HASH_CHUNK_SIZE and makes no call for []', async () => {
      const client = makeClient({ selectPages: [{ data: null, error: null }] });
      const out = await getQueryEmbeddings(client, { texts: texts(51), ...scope });
      expect(out).to.have.length(51);
      expect(out.every((hit) => hit === null)).to.equal(true);
      expect(client.calls.select.map((c) => c.inFilter.values.length)).to.deep.equal([50, 1]);

      const empty = makeClient();
      expect(await getQueryEmbeddings(empty, { texts: [], ...scope })).to.deep.equal([]);
      expect(empty.calls.select).to.have.length(0);
    });

    it('getQueryEmbeddings wraps a read error', async () => {
      const client = makeClient({ selectPages: [{ data: null, error: { message: 'boom' } }] });
      await expect(getQueryEmbeddings(client, { texts: ['x'], ...scope }))
        .to.be.rejectedWith(DataAccessError, 'Failed to read semantic_query_embedding');
    });

    it('upsertQueryEmbeddings validates its inputs', async () => {
      const call = (entries, over = {}) => upsertQueryEmbeddings(makeClient(), {
        entries, ...scope, ...over,
      });
      await expect(call([], { model: undefined })).to.be.rejectedWith(ValidationError, 'model is required');
      await expect(call([], { dims: undefined })).to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(call('x')).to.be.rejectedWith(ValidationError, 'entries must be an array');
      await expect(call([{ text: ' ', vector: [0.1, 0.2] }])).to.be.rejectedWith(ValidationError, 'text is required');
      await expect(call([{ text: 'x' }])).to.be.rejectedWith(ValidationError, 'vector must be');
      await expect(call([{ text: 'x', vector: [0.1] }])).to.be.rejectedWith(ValidationError, 'does not match dims');
    });

    it('upsertQueryEmbeddings writes one row per hash (first wins) and returns each entry\'s hash', async () => {
      const client = makeClient();
      const hashes = await upsertQueryEmbeddings(client, {
        entries: [
          { text: 'Running Shoes', vector: [0.1, 0.2] },
          { text: 'running  shoes', vector: [0.9, 0.9] },
          { text: 'Boots', vector: [0.3, 0.4] },
        ],
        ...scope,
      });
      const shoes = hashText(normalizeText('Running Shoes'));
      expect(hashes).to.deep.equal([shoes, shoes, hashText(normalizeText('Boots'))]);
      expect(client.calls.upsert).to.have.length(1);
      const { rows, options } = client.calls.upsert[0];
      expect(rows).to.have.length(2);
      expect(rows[0]).to.include({
        text_hash: shoes, model: MODEL, dims: 2, normalized_text: 'running shoes', embedding: '[0.1,0.2]',
      });
      expect(rows[0]).to.have.property('last_access_at');
      expect(options).to.deep.equal({ onConflict: 'text_hash,model,dims' });
    });

    it('upsertQueryEmbeddings writes in groups of SEMANTIC_CHUNK_SIZE and makes no call for []', async () => {
      const client = makeClient();
      await upsertQueryEmbeddings(client, {
        entries: texts(21).map((text) => ({ text, vector: [0.1, 0.2] })), ...scope,
      });
      expect(client.calls.upsert.map((c) => c.rows.length)).to.deep.equal([20, 1]);

      const empty = makeClient();
      expect(await upsertQueryEmbeddings(empty, { entries: [], ...scope })).to.deep.equal([]);
      expect(empty.calls.upsert).to.have.length(0);
    });

    it('upsertQueryEmbeddings wraps an error', async () => {
      const client = makeClient({ upsertResult: { error: { message: 'boom' } } });
      await expect(upsertQueryEmbeddings(client, { entries: [{ text: 'x', vector: [0.1, 0.2] }], ...scope }))
        .to.be.rejectedWith(DataAccessError, 'Failed to upsert semantic_query_embedding');
    });

    it('touchQueryEmbeddings validates its inputs', async () => {
      await expect(touchQueryEmbeddings(makeClient(), { textHashes: ['h'], dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(touchQueryEmbeddings(makeClient(), { textHashes: ['h'], model: MODEL, dims: 0 }))
        .to.be.rejectedWith(ValidationError, 'dims must be a positive integer');
      await expect(touchQueryEmbeddings(makeClient(), { textHashes: 'h', ...scope }))
        .to.be.rejectedWith(ValidationError, 'textHashes must be an array');
      await expect(touchQueryEmbeddings(makeClient(), { textHashes: ['h', ''], ...scope }))
        .to.be.rejectedWith(ValidationError, 'textHash is required');
    });

    it('touchQueryEmbeddings updates the distinct hashes in groups of QUERY_HASH_CHUNK_SIZE', async () => {
      const client = makeClient();
      const hashes = texts(51).map((t) => hashText(normalizeText(t)));
      await touchQueryEmbeddings(client, { textHashes: [...hashes, hashes[0]], ...scope });
      expect(client.calls.update.map((c) => c.inFilter.values.length)).to.deep.equal([50, 1]);
      expect(client.calls.update[0].eqs).to.deep.equal({ model: MODEL, dims: 2 });
      expect(client.calls.update[0].inFilter.column).to.equal('text_hash');
      expect(client.calls.update[0].updateVals).to.have.property('last_access_at');

      const empty = makeClient();
      await touchQueryEmbeddings(empty, { textHashes: [], ...scope });
      expect(empty.calls.update).to.have.length(0);
    });

    it('touchQueryEmbeddings wraps an error', async () => {
      const client = makeClient({ updateResult: { error: { message: 'boom' } } });
      await expect(touchQueryEmbeddings(client, { textHashes: ['h'], ...scope }))
        .to.be.rejectedWith(DataAccessError, 'Failed to touch semantic_query_embedding');
    });
  });
});
