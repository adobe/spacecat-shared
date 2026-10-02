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
  cleanTopicText,
  embedQueries,
  EMBEDDING_BATCH_SIZE,
  MAX_QUERY_TEXTS,
  EmbeddingUnavailableError,
  getQueryEmbeddings,
  hashText,
  indexSemanticTopics,
  lookupOpportunitiesByTopic,
  lookupSuggestionsByTopic,
  MAX_MODEL_LENGTH,
  MAX_TEXT_LENGTH,
  MAX_TYPE_FILTER_ITEMS,
  normalizeText,
  parseVector,
  QUERY_EMBEDDING_TABLE,
  SEMANTIC_CHUNK_SIZE,
  SEMANTIC_INDEX_TABLES,
  SEMANTIC_MATCHING_CONFIG,
  SEMANTIC_SEARCH_RPCS,
  SEMANTIC_TARGETS,
  serializeVector,
  touchQueryEmbeddings,
  upsertQueryEmbeddings,
} from '../../../src/util/semantic-index.utils.js';

chaiUse(chaiAsPromised);

const SITE_ID = '9a1b2c3d-4e5f-4a6b-8c7d-1e2f3a4b5c6d';
const ENTITY_ID = '1b2c3d4e-5f6a-4b7c-8d9e-0f1a2b3c4d5e';
const ENTITY_ID_2 = '2c3d4e5f-6a7b-4c8d-9e0f-1a2b3c4d5e6f';
const ENTITY_TYPE = 'cited-analysis';
const FIELD = 'title';
const TOPIC = 'topic';
const OPP_TABLE = 'opportunity_semantic_embedding';
const SUG_TABLE = 'suggestion_semantic_embedding';
const OPP_RPC = 'rpc_opportunity_semantic_search';
const SUG_RPC = 'rpc_suggestion_semantic_search';
const PGRST202_HINT = 'signature not found (data-service release not deployed, argument names/types drifted, or a stale PostgREST schema cache)';
const { model: MODEL, dims: DIMS } = SEMANTIC_MATCHING_CONFIG.embedding;
const vec = (x) => Array(DIMS).fill(x);

/** Fake embedding client: records each batch; returns `result`, throws `error`, or vectors. */
function makeEmbedder({ result, error } = {}) {
  const calls = [];
  return {
    calls,
    async createEmbeddings(texts) {
      calls.push(texts);
      if (error) {
        throw error;
      }
      return result !== undefined ? result : texts.map(() => vec(0.1));
    },
  };
}

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
          if (config.selectFn) {
            result = config.selectFn(state);
          } else if (state.limited) {
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

describe('semantic-index.utils', () => {
  describe('constants and pure helpers', () => {
    it('exposes match types, targets, tables and RPCs', () => {
      expect(SEMANTIC_TARGETS).to.deep.equal({ OPPORTUNITY: 'opportunity', SUGGESTION: 'suggestion' });
      expect(Object.isFrozen(SEMANTIC_TARGETS)).to.equal(true);
      expect(SEMANTIC_INDEX_TABLES).to.deep.equal([OPP_TABLE, SUG_TABLE]);
      expect(SEMANTIC_SEARCH_RPCS).to.deep.equal({ opportunity: OPP_RPC, suggestion: SUG_RPC });
      expect(QUERY_EMBEDDING_TABLE).to.equal('semantic_query_embedding');
    });

    it('exposes the frozen embedding generation', () => {
      expect(SEMANTIC_MATCHING_CONFIG).to.deep.equal({
        embedding: { model: 'azure/text-embedding-3-small', dims: 1536 },
      });
      expect(Object.isFrozen(SEMANTIC_MATCHING_CONFIG)).to.equal(true);
      expect(Object.isFrozen(SEMANTIC_MATCHING_CONFIG.embedding)).to.equal(true);
    });

    it('EmbeddingUnavailableError carries misses and the cause', () => {
      const cause = new Error('down');
      const err = new EmbeddingUnavailableError('nope', { misses: 3 }, cause);
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.misses).to.equal(3);
      expect(err.cause).to.equal(cause);
      expect(new EmbeddingUnavailableError('nope').misses).to.equal(undefined);
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
      expect(cleanTopicText(42)).to.equal(null);
      expect(cleanTopicText('')).to.equal(null);
      expect(cleanTopicText('   ')).to.equal(null);
      expect(cleanTopicText('a'.repeat(MAX_TEXT_LENGTH))).to.not.equal(null);
      expect(cleanTopicText('a'.repeat(MAX_TEXT_LENGTH + 1))).to.equal(null);
      expect(cleanTopicText('abcd', { maxLength: 3 })).to.equal(null);
      expect(cleanTopicText('abc', { maxLength: 3 })).to.deep.equal({ text: 'abc', key: 'abc' });
      // The limit applies to the normalized key: lowercasing U+0130 yields two code units.
      expect(cleanTopicText('\u0130'.repeat(2), { maxLength: 3 })).to.equal(null);
      expect(cleanTopicText('a  b', { maxLength: 3 })).to.deep.equal({ text: 'a  b', key: 'a b' });
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
      expect(parseVector('[0.1,abc,0.3]')).to.equal(null);
    });
  });

  describe('indexSemanticTopics', () => {
    const entity = (fields, over = {}) => ({
      entityId: ENTITY_ID, entityType: ENTITY_TYPE, fields, ...over,
    });
    const topicEntry = (texts, matchFieldType = FIELD) => ({ matchFieldType, texts });
    const run = (client, over = {}, embedder = makeEmbedder()) => indexSemanticTopics(
      client,
      embedder,
      {
        target: SEMANTIC_TARGETS.OPPORTUNITY, siteId: SITE_ID, entities: [], ...over,
      },
    );
    const storedRow = (text, over = {}) => ({
      id: `id-${text}`,
      entity_id: ENTITY_ID,
      match_type: TOPIC,
      match_field_type: FIELD,
      text_hash: hashText(normalizeText(text)),
      model: MODEL,
      dims: DIMS,
      ...over,
    });
    // fetchStoredRows reads the index table; getQueryEmbeddings reads the cache table.
    const byTable = ({ stored = [], cached = [] } = {}) => ({
      selectFn: (state) => (state.table === QUERY_EMBEDDING_TABLE
        ? { data: cached, error: null }
        : { data: stored, error: null }),
    });

    it('validates its arguments', async () => {
      const embedder = makeEmbedder();
      await expect(indexSemanticTopics(null, embedder, {}))
        .to.be.rejectedWith(ValidationError, 'postgrestClient is required');
      await expect(indexSemanticTopics(makeClient(), {}, {}))
        .to.be.rejectedWith(ValidationError, 'embeddingClient with createEmbeddings() is required');
      await expect(indexSemanticTopics(makeClient(), embedder))
        .to.be.rejectedWith(ValidationError, 'target must be one of: opportunity, suggestion (got undefined)');
      await expect(run(makeClient(), { target: 'toString' }))
        .to.be.rejectedWith(ValidationError, 'target must be one of');
      await expect(run(makeClient(), { siteId: '' }))
        .to.be.rejectedWith(ValidationError, 'siteId must be a valid UUID (got "")');
      await expect(run(makeClient(), { entities: 'x' }))
        .to.be.rejectedWith(ValidationError, 'entities must be an array');
      await expect(run(makeClient(), { entities: [null] }))
        .to.be.rejectedWith(ValidationError, 'fields must be an array (entity undefined)');
      await expect(run(makeClient(), { entities: [{ entityId: ENTITY_ID }] }))
        .to.be.rejectedWith(ValidationError, `fields must be an array (entity "${ENTITY_ID}")`);
      await expect(run(makeClient(), { entities: [entity([topicEntry(['a'])], { entityId: '' })] }))
        .to.be.rejectedWith(ValidationError, 'entityId must be a valid UUID (got "")');
      await expect(run(makeClient(), { entities: [entity([topicEntry(['a'])], { entityId: 'oppty-1' })] }))
        .to.be.rejectedWith(ValidationError, 'entityId must be a valid UUID (got "oppty-1")');
      await expect(run(makeClient(), { entities: [entity([topicEntry(['a'], '')])] }))
        .to.be.rejectedWith(ValidationError, 'matchFieldType must be a non-empty string of at most 64 characters');
      await expect(run(makeClient(), { entities: [entity([topicEntry(['a'], 'x'.repeat(65))])] }))
        .to.be.rejectedWith(ValidationError, 'matchFieldType must be');
      await expect(run(makeClient(), { entities: [entity([topicEntry('a')])] }))
        .to.be.rejectedWith(ValidationError, `texts must be an array (entity ${ENTITY_ID}, field ${FIELD})`);
      await expect(run(makeClient(), { entities: [entity([topicEntry(['  ', 42])])] }))
        .to.be.rejectedWith(ValidationError, `texts contained no valid entries; pass [] to clear field ${FIELD}`);
      await expect(run(makeClient(), { entities: [entity([topicEntry(['a'])], { entityType: undefined })] }))
        .to.be.rejectedWith(ValidationError, 'entityType must be a non-empty string of at most 255 characters');
      await expect(run(makeClient(), {
        entities: [entity([topicEntry(['a']), topicEntry(['b'])])],
      })).to.be.rejectedWith(ValidationError, `duplicate matchFieldType ${FIELD} for entity ${ENTITY_ID}`);
    });

    it('renders unprintable, circular and long values safely in messages', async () => {
      const unprintable = Object.assign(Object.create(null), { big: 10n });
      await expect(run(makeClient(), { target: unprintable }))
        .to.be.rejectedWith(ValidationError, '(got [unprintable])');
      await expect(run(makeClient(), { target: 10n }))
        .to.be.rejectedWith(ValidationError, '(got 10)');
      const long = await run(makeClient(), { target: '\u{1F600}'.repeat(300) }).catch((e) => e);
      expect(long.message).to.match(/\(got "\?{199}\.\.\.\)$/).and.match(/^[\x20-\x7E]*$/);
    });

    it('returns an empty result without any call when there is nothing to sync', async () => {
      const client = makeClient();
      const embedder = makeEmbedder();
      expect(await run(client, { entities: [entity([])] }, embedder))
        .to.deep.equal({ entities: [], embedded: 0, cacheHits: 0 });
      expect(client.calls.select).to.have.length(0);
      expect(embedder.calls).to.have.length(0);
    });

    it('inserts new texts with normalized text, hash and the configured generation', async () => {
      const client = makeClient();
      const embedder = makeEmbedder();
      const out = await run(client, {
        target: SEMANTIC_TARGETS.SUGGESTION,
        entities: [entity([topicEntry(['  Running   SHOES ', 'running shoes', 'Boots', null])])],
      }, embedder);

      expect(out).to.deep.equal({
        entities: [{
          entityId: ENTITY_ID,
          fields: [{
            matchFieldType: FIELD,
            submitted: 4,
            rejected: 1,
            inserted: 2,
            deleted: 0,
            unchanged: 0,
          }],
        }],
        embedded: 2,
        cacheHits: 0,
      });
      expect(embedder.calls).to.deep.equal([['running shoes', 'boots']]);
      const [read] = client.calls.select;
      expect(read).to.include({ table: SUG_TABLE, cols: 'id, entity_id, match_type, match_field_type, text_hash, model, dims' });
      expect(read.eqs).to.deep.equal({ site_id: SITE_ID });
      expect(read.inFilter).to.deep.equal({ column: 'entity_id', values: [ENTITY_ID] });
      expect(read.range).to.deep.equal([0, 999]);
      const [write] = client.calls.upsert;
      expect(write.table).to.equal(SUG_TABLE);
      expect(write.options).to.deep.equal({ onConflict: 'entity_id,match_type,match_field_type,text_hash' });
      expect(write.rows[0]).to.deep.equal({
        site_id: SITE_ID,
        entity_id: ENTITY_ID,
        entity_type: ENTITY_TYPE,
        match_type: TOPIC,
        match_field_type: FIELD,
        text: 'running shoes',
        text_hash: hashText('running shoes'),
        embedding: serializeVector(vec(0.1)),
        model: MODEL,
        dims: DIMS,
      });
      expect(client.calls.delete).to.have.length(0);
    });

    it('keeps unchanged texts, deletes stale ones, and leaves other groups alone', async () => {
      const client = makeClient(byTable({
        stored: [
          storedRow('running shoes'),
          storedRow('old topic'),
          storedRow('other field', { match_field_type: 'other' }),
          storedRow('a claim', { match_type: 'claim' }),
        ],
      }));
      const embedder = makeEmbedder();
      const out = await run(client, { entities: [entity([topicEntry(['Running Shoes', 'boots'])])] }, embedder);

      expect(out.entities[0].fields[0]).to.include({ inserted: 1, deleted: 1, unchanged: 1 });
      expect(embedder.calls).to.deep.equal([['boots']]);
      expect(client.calls.upsert[0].rows.map((r) => r.text)).to.deep.equal(['boots']);
      expect(client.calls.delete).to.deep.equal([{
        table: OPP_TABLE, eqs: { site_id: SITE_ID }, inFilter: { column: 'id', values: ['id-old topic'] },
      }]);
    });

    it('clears a group with texts: [] and makes no embedding call', async () => {
      const client = makeClient(byTable({ stored: [storedRow('a'), storedRow('b')] }));
      const embedder = makeEmbedder();
      const entities = [
        entity([topicEntry([])]),
        entity([topicEntry(null)], { entityId: ENTITY_ID_2 }),
      ];
      const out = await run(client, { entities }, embedder);
      expect(out.entities.map((e) => e.fields[0].deleted)).to.deep.equal([2, 0]);
      expect(out.entities[1].fields[0].submitted).to.equal(0);
      expect(embedder.calls).to.have.length(0);
      expect(client.calls.upsert).to.have.length(0);
      const cacheReads = client.calls.select.filter((c) => c.table === QUERY_EMBEDDING_TABLE);
      expect(cacheReads).to.have.length(0);
      expect(client.calls.delete[0].inFilter.values).to.deep.equal(['id-a', 'id-b']);
    });

    it('is a no-op write when everything is unchanged', async () => {
      const client = makeClient(byTable({ stored: [storedRow('a')] }));
      const out = await run(client, { entities: [entity([topicEntry(['A'])])] });
      expect(out.entities[0].fields[0]).to.include({ inserted: 0, deleted: 0, unchanged: 1 });
      expect(client.calls.upsert).to.have.length(0);
      expect(client.calls.delete).to.have.length(0);
    });

    it('re-embeds rows from another model or dims in place instead of keeping them', async () => {
      const client = makeClient(byTable({
        stored: [storedRow('a', { model: 'azure/old-model' }), storedRow('b', { dims: 3072 })],
      }));
      const embedder = makeEmbedder();
      const out = await run(client, { entities: [entity([topicEntry(['a', 'b'])])] }, embedder);
      expect(out.entities[0].fields[0]).to.include({ inserted: 2, deleted: 0, unchanged: 0 });
      expect(embedder.calls).to.deep.equal([['a', 'b']]);
      expect(client.calls.upsert[0].rows.map((r) => [r.text, r.model, r.dims]))
        .to.deep.equal([['a', MODEL, DIMS], ['b', MODEL, DIMS]]);
      expect(client.calls.delete).to.have.length(0);
    });

    it('deletes an old-generation row whose text is no longer submitted', async () => {
      const client = makeClient(byTable({
        stored: [storedRow('a'), storedRow('gone', { model: 'azure/old-model' })],
      }));
      const out = await run(client, { entities: [entity([topicEntry(['a'])])] });
      expect(out.entities[0].fields[0]).to.include({ inserted: 0, deleted: 1, unchanged: 1 });
      expect(client.calls.upsert).to.have.length(0);
      expect(client.calls.delete).to.deep.equal([{
        table: OPP_TABLE, eqs: { site_id: SITE_ID }, inFilter: { column: 'id', values: ['id-gone'] },
      }]);
    });

    it('dedupes texts across entities and reuses cached query embeddings', async () => {
      const cachedVector = vec(0.5);
      const client = makeClient(byTable({
        cached: [
          { text_hash: hashText('shared'), embedding: serializeVector(cachedVector) },
          { text_hash: hashText('short'), embedding: '[0.1,0.2]' },
        ],
      }));
      const embedder = makeEmbedder();
      const out = await run(client, {
        entities: [
          entity([topicEntry(['Shared', 'short'])]),
          entity([topicEntry(['shared']), { matchFieldType: 'quote', texts: ['fresh'] }], { entityId: ENTITY_ID_2 }),
        ],
      }, embedder);

      expect(out.cacheHits).to.equal(1);
      expect(out.embedded).to.equal(2);
      expect(embedder.calls).to.deep.equal([['short', 'fresh']]);
      const cacheRead = client.calls.select.find((c) => c.table === QUERY_EMBEDDING_TABLE);
      expect(cacheRead.inFilter.values).to.have.length(3);
      const rows = client.calls.upsert.flatMap((c) => c.rows);
      expect(rows).to.have.length(4);
      expect(rows.filter((r) => r.text === 'shared').map((r) => r.embedding))
        .to.deep.equal([serializeVector(cachedVector), serializeVector(cachedVector)]);
      expect(out.entities.map((e) => e.fields.length)).to.deep.equal([1, 2]);
      // The writer never writes the query cache.
      expect(client.calls.upsert.every((c) => c.table === OPP_TABLE)).to.equal(true);
    });

    it('falls back to embedding everything when the cache read fails', async () => {
      const client = makeClient({
        selectFn: (state) => (state.table === QUERY_EMBEDDING_TABLE
          ? { data: null, error: { message: 'cache down' } }
          : { data: null, error: null }),
      });
      const embedder = makeEmbedder();
      const out = await run(client, { entities: [entity([topicEntry(['a'])])] }, embedder);
      expect(out.cacheError).to.be.instanceOf(DataAccessError);
      expect(out.embedded).to.equal(1);
    });

    it('embeds misses in batches of EMBEDDING_BATCH_SIZE', async () => {
      const client = makeClient();
      const embedder = makeEmbedder();
      const texts = Array.from({ length: EMBEDDING_BATCH_SIZE + 1 }, (_, i) => `topic ${i}`);
      const out = await run(client, { entities: [entity([topicEntry(texts)])] }, embedder);
      expect(embedder.calls.map((c) => c.length)).to.deep.equal([EMBEDDING_BATCH_SIZE, 1]);
      expect(out.embedded).to.equal(EMBEDDING_BATCH_SIZE + 1);
      expect(client.calls.upsert.map((c) => c.rows.length))
        .to.deep.equal([...Array(12).fill(SEMANTIC_CHUNK_SIZE), 17]);
    });

    it('pages stored rows and chunks entity ids and deletes', async () => {
      const page = Array.from({ length: 1000 }, (_, i) => storedRow(`t${i}`));
      const pages = [
        { data: page, error: null }, { data: null, error: null }, { data: [], error: null },
      ];
      const client = makeClient({ selectFn: () => pages.shift() });
      const entities = [entity([topicEntry([])]), ...Array.from({ length: 50 }, (_, i) => entity([topicEntry([])], { entityId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` }))];
      const out = await run(client, { entities });
      expect(client.calls.select.map((c) => [c.inFilter.values.length, c.range[0]]))
        .to.deep.equal([[50, 0], [50, 1000], [1, 0]]);
      expect(out.entities[0].fields[0].deleted).to.equal(1000);
      const deleteSizes = client.calls.delete.map((c) => c.inFilter.values.length);
      expect(deleteSizes).to.deep.equal(Array(20).fill(50));
    });

    it('wraps read, write and prune errors', async () => {
      const failingRead = makeClient({ selectFn: () => ({ data: null, error: { message: 'x' } }) });
      await expect(run(failingRead, { entities: [entity([topicEntry([])])] }))
        .to.be.rejectedWith(DataAccessError, `Failed to read ${OPP_TABLE}`);
      const failingWrite = makeClient({ upsertResult: { error: { message: 'x' } } });
      const writeErr = await run(failingWrite, { entities: [entity([topicEntry(['a'])])] }).catch((e) => e);
      expect(writeErr).to.be.instanceOf(DataAccessError);
      expect(writeErr.message).to.equal(`Failed to write ${OPP_TABLE}`);
      expect(writeErr.details).to.deep.equal({ table: OPP_TABLE, siteId: SITE_ID });
      const failingPrune = makeClient({ ...byTable({ stored: [storedRow('a')] }), deleteResult: { error: { message: 'x' } } });
      await expect(run(failingPrune, { entities: [entity([topicEntry([])])] }))
        .to.be.rejectedWith(DataAccessError, `Failed to prune ${OPP_TABLE}`);
    });

    it('raises EmbeddingUnavailableError on a failed or malformed embedding response', async () => {
      const input = { entities: [entity([topicEntry(['a', 'b'])])] };
      const thrown = await run(makeClient(), input, makeEmbedder({ error: new Error('429') })).catch((e) => e);
      expect(thrown).to.be.instanceOf(EmbeddingUnavailableError);
      expect(thrown.message).to.equal('Embedding call failed: 429');
      expect(thrown.misses).to.equal(2);
      await expect(run(makeClient(), input, makeEmbedder({ result: [vec(0.1)] })))
        .to.be.rejectedWith(EmbeddingUnavailableError, 'Embedding response length mismatch: expected 2, got 1');
      await expect(run(makeClient(), input, makeEmbedder({ result: null })))
        .to.be.rejectedWith(EmbeddingUnavailableError, 'expected 2, got undefined');
      await expect(run(makeClient(), input, makeEmbedder({ result: [vec(0.1), [0.1]] })))
        .to.be.rejectedWith(EmbeddingUnavailableError, `Embedding dimension mismatch: expected ${DIMS}, got 1`);
      await expect(run(makeClient(), input, makeEmbedder({ result: [vec(0.1), null] })))
        .to.be.rejectedWith(EmbeddingUnavailableError, 'got undefined');
    });
  });

  describe('embedQueries', () => {
    it('validates its arguments', async () => {
      await expect(embedQueries(null, makeEmbedder(), []))
        .to.be.rejectedWith(ValidationError, 'postgrestClient is required');
      await expect(embedQueries(makeClient(), null, []))
        .to.be.rejectedWith(ValidationError, 'embeddingClient with createEmbeddings() is required');
      await expect(embedQueries(makeClient(), makeEmbedder(), 'x'))
        .to.be.rejectedWith(ValidationError, 'texts must be an array');
      await expect(embedQueries(makeClient(), makeEmbedder(), ['ok', ' ']))
        .to.be.rejectedWith(ValidationError, 'texts[1] must be a non-empty string of at most 2048 characters');
      await expect(embedQueries(makeClient(), makeEmbedder(), ['x'.repeat(MAX_TEXT_LENGTH + 1)]))
        .to.be.rejectedWith(ValidationError, 'texts[0] must be a non-empty string');
      const tooMany = Array.from({ length: MAX_QUERY_TEXTS + 1 }, (_, i) => `t${i}`);
      await expect(embedQueries(makeClient(), makeEmbedder(), tooMany))
        .to.be.rejectedWith(ValidationError, `texts must have at most ${MAX_QUERY_TEXTS} entries (got ${MAX_QUERY_TEXTS + 1})`);
      // Repeats count too: each entry gets its own vector and search.
      await expect(embedQueries(makeClient(), makeEmbedder(), Array(MAX_QUERY_TEXTS + 1).fill('same')))
        .to.be.rejectedWith(ValidationError, `texts must have at most ${MAX_QUERY_TEXTS} entries`);
      for (const timeoutMs of [0, -1, NaN, Infinity, '10']) {
        // eslint-disable-next-line no-await-in-loop
        await expect(embedQueries(makeClient(), makeEmbedder(), ['a'], { timeoutMs }))
          .to.be.rejectedWith(ValidationError, 'timeoutMs must be a positive finite number');
      }
    });

    it('accepts MAX_QUERY_TEXTS texts in one embed call and dedupes repeats', async () => {
      const calls = [];
      const embedder = {
        createEmbeddings: async (texts) => {
          calls.push(texts);
          return texts.map((text) => vec(text === 'a' ? 0.1 : 0.2));
        },
      };
      const out = await embedQueries(makeClient(), embedder, ['A', 'b', ' a ', 'b']);
      expect(calls).to.deep.equal([['a', 'b']]);
      expect(out.vectors).to.deep.equal([vec(0.1), vec(0.2), vec(0.1), vec(0.2)]);
      expect(out).to.include({ hits: 0, misses: 2 });
      await out.cacheWrites;

      const max = Array.from({ length: MAX_QUERY_TEXTS }, (_, i) => `t${i}`);
      const embedder2 = makeEmbedder();
      const full = await embedQueries(makeClient(), embedder2, max);
      expect(full.vectors).to.have.length(MAX_QUERY_TEXTS);
      expect(full.misses).to.equal(MAX_QUERY_TEXTS);
      expect(embedder2.calls).to.have.length(1);
      expect(embedder2.calls[0]).to.have.length(MAX_QUERY_TEXTS);
      expect(full).to.not.have.property('cacheError');
    });

    it('serves repeated cache hits once and fans the vectors back out', async () => {
      const hit = vec(0.7);
      const client = makeClient({
        selectFn: () => ({ data: [{ text_hash: hashText('cached'), embedding: serializeVector(hit) }], error: null }),
      });
      const embedder = makeEmbedder();
      const out = await embedQueries(client, embedder, ['Cached', 'cached ', 'fresh']);
      expect(out.vectors).to.deep.equal([hit, hit, vec(0.1)]);
      expect(out).to.include({ hits: 1, misses: 1 });
      expect(embedder.calls).to.deep.equal([['fresh']]);
      await out.cacheWrites;
      expect(client.calls.update).to.have.length(1);
      expect(client.calls.update[0].inFilter.values).to.deep.equal([hashText('cached')]);
      expect(client.calls.upsert[0].rows.map((r) => r.text)).to.deep.equal(['fresh']);
    });

    it('serves hits from the cache, embeds misses, and writes the cache in the background', async () => {
      const hit = vec(0.7);
      const client = makeClient({
        selectFn: () => ({
          data: [
            { text_hash: hashText('cached'), embedding: serializeVector(hit) },
            { text_hash: hashText('wrong dims'), embedding: '[0.1,0.2]' },
          ],
          error: null,
        }),
      });
      const embedder = makeEmbedder();
      const out = await embedQueries(client, embedder, ['Cached', 'fresh', 'Wrong  Dims']);

      expect(out.vectors).to.deep.equal([hit, vec(0.1), vec(0.1)]);
      expect(out).to.include({ hits: 1, misses: 2 });
      expect(embedder.calls).to.deep.equal([['fresh', 'wrong dims']]);
      await out.cacheWrites;
      expect(client.calls.update[0].inFilter.values).to.deep.equal([hashText('cached')]);
      expect(client.calls.upsert[0].rows.map((r) => r.text)).to.deep.equal(['fresh', 'wrong dims']);
    });

    it('makes no embedding call when everything is cached', async () => {
      const client = makeClient({
        selectFn: () => ({ data: [{ text_hash: hashText('a'), embedding: serializeVector(vec(0.2)) }], error: null }),
      });
      const embedder = makeEmbedder();
      const out = await embedQueries(client, embedder, ['a']);
      expect(out).to.include({ hits: 1, misses: 0 });
      expect(embedder.calls).to.have.length(0);
      await out.cacheWrites;
      expect(client.calls.upsert).to.have.length(0);
    });

    it('embeds everything and logs when the cache read fails', async () => {
      const client = makeClient({ selectFn: () => ({ data: null, error: { message: 'x' } }) });
      const embedder = makeEmbedder();
      const warnings = [];
      const out = await embedQueries(client, embedder, ['a', 'b'], { log: { warn: (m) => warnings.push(m) } });
      expect(out.vectors).to.deep.equal([vec(0.1), vec(0.1)]);
      expect(out).to.include({ hits: 0, misses: 2 });
      expect(embedder.calls).to.deep.equal([['a', 'b']]);
      expect(warnings).to.deep.equal([
        '[semantic-index] getQueryEmbeddings failed (non-fatal): Failed to read semantic_query_embedding',
      ]);
      expect(out.cacheError).to.be.instanceOf(DataAccessError);
      expect(out.cacheError.message).to.equal('Failed to read semantic_query_embedding');
      await out.cacheWrites;
    });

    it('raises EmbeddingUnavailableError on failure, timeout, or a malformed response', async () => {
      const failed = await embedQueries(makeClient(), makeEmbedder({ error: new Error('boom') }), ['a', 'b'])
        .catch((e) => e);
      expect(failed).to.be.instanceOf(EmbeddingUnavailableError);
      expect(failed.message).to.equal('Embedding call failed: boom');
      expect(failed.misses).to.equal(2);

      const hanging = { createEmbeddings: () => new Promise(() => {}) };
      await expect(embedQueries(makeClient(), hanging, ['a'], { timeoutMs: 5 }))
        .to.be.rejectedWith(EmbeddingUnavailableError, 'Embedding call failed: timed out after 5 ms');

      await expect(embedQueries(makeClient(), makeEmbedder({ result: [] }), ['a']))
        .to.be.rejectedWith(EmbeddingUnavailableError, 'length mismatch');
      await expect(embedQueries(makeClient(), makeEmbedder({ result: [[0.1]] }), ['a']))
        .to.be.rejectedWith(EmbeddingUnavailableError, 'dimension mismatch');
    });

    it('swallows cache write failures and logs them when a logger is given', async () => {
      const client = makeClient({
        selectFn: () => ({ data: [{ text_hash: hashText('a'), embedding: serializeVector(vec(0.2)) }], error: null }),
        upsertResult: { error: { message: 'x' } },
        updateResult: { error: { message: 'y' } },
      });
      const warnings = [];
      const out = await embedQueries(client, makeEmbedder(), ['a', 'b'], { log: { warn: (m) => warnings.push(m) } });
      await out.cacheWrites;
      expect(warnings).to.deep.equal([
        '[semantic-index] touchQueryEmbeddings failed (non-fatal): Failed to touch semantic_query_embedding',
        '[semantic-index] upsertQueryEmbeddings failed (non-fatal): Failed to upsert semantic_query_embedding',
      ]);
      const silent = await embedQueries(client, makeEmbedder(), ['a', 'b']);
      await silent.cacheWrites;
      const noWarn = await embedQueries(client, makeEmbedder(), ['a', 'b'], { log: {} });
      await noWarn.cacheWrites;
    });
  });

  const lookups = [
    {
      name: 'lookupOpportunitiesByTopic', fn: lookupOpportunitiesByTopic, target: 'opportunity', rpc: OPP_RPC,
    },
    {
      name: 'lookupSuggestionsByTopic', fn: lookupSuggestionsByTopic, target: 'suggestion', rpc: SUG_RPC,
    },
  ];

  lookups.forEach(({
    name, fn, target, rpc,
  }) => {
    describe(name, () => {
      const base = { siteId: SITE_ID };
      const vecs = (n) => Array.from({ length: n }, () => vec(0.1));
      const call = (over) => fn(makeClient(), { ...base, vectors: vecs(1), ...over });
      const groupSizes = (client) => client.calls.rpc
        .map((c) => c.params.p_query_embeddings.length);

      it('validates args, filters, vectors, k and minScore', async () => {
        await expect(fn(null, base)).to.be.rejectedWith(ValidationError, 'postgrestClient is required');
        await expect(fn(makeClient())).to.be.rejectedWith(ValidationError, 'siteId must be a valid UUID (got undefined)');
        await expect(call({ siteId: 'site-1' })).to.be.rejectedWith(ValidationError, 'siteId must be a valid UUID (got "site-1")');
        await expect(call({ matchFieldTypes: 'question' })).to.be.rejectedWith(ValidationError, 'matchFieldTypes must be an array');
        await expect(call({ matchFieldTypes: [''] })).to.be.rejectedWith(ValidationError, 'each matchFieldTypes value must be a non-empty string of at most 64');
        await expect(call({ entityTypes: [42] })).to.be.rejectedWith(ValidationError, 'each entityTypes value must be a non-empty string of at most 255 characters (got 42)');
        await expect(call({ entityTypes: Array.from({ length: MAX_TYPE_FILTER_ITEMS + 1 }, (_, i) => `t${i}`) }))
          .to.be.rejectedWith(ValidationError, 'entityTypes must have at most 100 values (got 101)');
        await expect(call({ statuses: 'NEW' })).to.be.rejectedWith(ValidationError, 'statuses must be an array');
        await expect(call({ statuses: ['NEW', 'nope'] })).to.be.rejectedWith(ValidationError, /^statuses must only contain: .+ \(got \["nope"\]\)$/);
        await expect(call({ vectors: 'x' })).to.be.rejectedWith(ValidationError, 'vectors must be an array');
        await expect(call({ vectors: [[]] })).to.be.rejectedWith(ValidationError, 'vector must be');
        await expect(call({ vectors: [[0.1]] })).to.be.rejectedWith(ValidationError, 'does not match dims');
        await expect(call({ k: 0 })).to.be.rejectedWith(ValidationError, 'k must be an integer between 1 and 1000');
        await expect(call({ k: 1.5 })).to.be.rejectedWith(ValidationError, 'k must be');
        await expect(call({ k: 1001 })).to.be.rejectedWith(ValidationError, 'k must be');
        await expect(call({ minScore: '0.5' })).to.be.rejectedWith(ValidationError, 'minScore must be a finite number');
        await expect(call({ minScore: NaN })).to.be.rejectedWith(ValidationError, 'minScore must be');
      });

      it('searches the configured generation, ignoring a caller-supplied model/dims', async () => {
        const client = makeClient();
        await fn(client, {
          ...base, vectors: vecs(1), model: 'other', dims: 2,
        });
        expect(client.calls.rpc[0].params).to.include({ p_model: MODEL, p_dims: DIMS });
      });

      it('returns [] without calling the RPC for no vectors', async () => {
        const client = makeClient();
        expect(await fn(client, { ...base, vectors: [] })).to.deep.equal([]);
        expect(client.calls.rpc).to.have.length(0);
      });

      it('sends the params with defaults and splits rows per query, in input order', async () => {
        const client = makeClient({
          rpcResult: {
            data: [
              {
                query_index: 1, entity_id: 'e2', entity_type: ENTITY_TYPE, score: 0.7,
              },
              {
                query_index: 0, entity_id: 'e1', entity_type: ENTITY_TYPE, score: 0.9,
              },
            ],
            error: null,
          },
        });
        const out = await fn(client, { ...base, vectors: vecs(2) });
        expect(out).to.deep.equal([
          [{ entityId: 'e1', entityType: ENTITY_TYPE, score: 0.9 }],
          [{ entityId: 'e2', entityType: ENTITY_TYPE, score: 0.7 }],
        ]);
        const [{ name: rpcName, params }] = client.calls.rpc;
        expect(rpcName).to.equal(rpc);
        expect(params).to.include({
          p_site_id: SITE_ID,
          p_match_type: TOPIC,
          p_match_field_types: null,
          p_entity_types: null,
          p_model: MODEL,
          p_dims: DIMS,
          p_limit: 10,
          p_min_score: 0,
          p_statuses: null,
        });
        expect(params.p_query_embeddings).to.deep.equal(vecs(2).map(serializeVector));
      });

      it('dedupes filter lists and treats empty lists as no filter', async () => {
        const client = makeClient();
        await fn(client, {
          ...base,
          vectors: vecs(1),
          matchFieldTypes: ['question', 'question', 'title'],
          entityTypes: [],
          statuses: ['NEW', 'NEW'],
        });
        expect(client.calls.rpc[0].params).to.include({ p_entity_types: null });
        expect(client.calls.rpc[0].params.p_match_field_types).to.deep.equal(['question', 'title']);
        expect(client.calls.rpc[0].params.p_statuses).to.deep.equal(['NEW']);
      });

      it('groups vectors by SEMANTIC_CHUNK_SIZE and offsets each group\'s query_index', async () => {
        const client = makeClient({
          rpcResults: [
            { data: [], error: null },
            {
              data: [{
                query_index: 0, entity_id: 'e21', entity_type: ENTITY_TYPE, score: 0.6,
              }],
              error: null,
            },
          ],
        });
        const out = await fn(client, { ...base, vectors: vecs(25) });
        expect(groupSizes(client)).to.deep.equal([20, 5]);
        expect(out[20]).to.deep.equal([{ entityId: 'e21', entityType: ENTITY_TYPE, score: 0.6 }]);
        expect(out[0]).to.deep.equal([]);
      });

      it('shrinks the group when k is large so group x k stays within max-rows', async () => {
        const client = makeClient();
        await fn(client, { ...base, vectors: vecs(25), k: 100 });
        expect(groupSizes(client)).to.deep.equal([10, 10, 5]);
      });

      it('passes k/minScore and tolerates null data', async () => {
        const client = makeClient({ rpcResult: { data: null, error: null } });
        expect(await fn(client, {
          ...base, vectors: vecs(1), k: 5, minScore: 0.3,
        })).to.deep.equal([[]]);
        expect(client.calls.rpc[0].params).to.include({ p_limit: 5, p_min_score: 0.3 });
      });

      it('wraps an RPC error, with a deploy-ordering hint for PGRST202', async () => {
        const client = makeClient({ rpcResult: { data: null, error: { message: 'boom' } } });
        const err = await fn(client, {
          ...base, matchFieldTypes: ['question'], vectors: vecs(1),
        }).catch((e) => e);
        expect(err).to.be.instanceOf(DataAccessError);
        expect(err.message).to.equal(`Failed ${target} semantic search for site ${SITE_ID}`);
        expect(err.details).to.deep.equal({
          siteId: SITE_ID, matchType: TOPIC, matchFieldTypes: ['question'], entityTypes: null,
        });

        const cause = { code: 'PGRST202', message: 'Could not find the function' };
        const missing = await fn(makeClient({ rpcResult: { data: null, error: cause } }), {
          ...base, vectors: vecs(1),
        }).catch((e) => e);
        expect(missing.message).to.equal(`Failed ${target} semantic search for site ${SITE_ID}: ${rpc} ${PGRST202_HINT}`);
        expect(missing.cause).to.equal(cause);
      });

      it('rejects a query_index outside the current group', async () => {
        const row = (queryIndex) => ({
          query_index: queryIndex, entity_id: 'e1', entity_type: ENTITY_TYPE, score: 0.5,
        });
        for (const bad of [20, -1, 1.5, null]) {
          const client = makeClient({ rpcResult: { data: [row(bad)], error: null } });
          // eslint-disable-next-line no-await-in-loop
          await expect(fn(client, { ...base, vectors: vecs(25) }))
            .to.be.rejectedWith(DataAccessError, `Unexpected query_index ${bad} from ${rpc}`);
        }
      });
    });
  });

  describe('lookupSuggestionsByTopic status filters', () => {
    const base = { siteId: SITE_ID, vectors: [vec(0.1)] };

    it('validates statuses against Suggestion and opportunityStatuses against Opportunity', async () => {
      const client = makeClient();
      await lookupSuggestionsByTopic(client, {
        ...base, statuses: ['APPROVED', 'NEW'], opportunityStatuses: ['NEW', 'NEW'],
      });
      expect(client.calls.rpc[0].params).to.deep.include({
        p_statuses: ['APPROVED', 'NEW'], p_opportunity_statuses: ['NEW'],
      });
      await expect(lookupOpportunitiesByTopic(makeClient(), { ...base, statuses: ['APPROVED'] }))
        .to.be.rejectedWith(ValidationError, 'statuses must only contain');
      await expect(lookupSuggestionsByTopic(makeClient(), { ...base, opportunityStatuses: ['APPROVED'] }))
        .to.be.rejectedWith(ValidationError, 'opportunityStatuses must only contain');
    });

    it('omits both status filters when not given', async () => {
      const client = makeClient();
      await lookupSuggestionsByTopic(client, base);
      expect(client.calls.rpc[0].params)
        .to.include({ p_statuses: null, p_opportunity_statuses: null });
      expect(client.calls.rpc[0].params.p_match_type).to.equal(TOPIC);
    });

    it('does not send p_opportunity_statuses for opportunities', async () => {
      const client = makeClient();
      await lookupOpportunitiesByTopic(client, base);
      expect(client.calls.rpc[0].params).to.not.have.property('p_opportunity_statuses');
    });
  });

  describe('semantic_query_embedding cache', () => {
    const scope = { model: MODEL, dims: 2 };
    const texts = (n) => Array.from({ length: n }, (_, i) => `topic ${i}`);

    it('getQueryEmbeddings validates its inputs', async () => {
      await expect(getQueryEmbeddings(makeClient(), { texts: ['x'], dims: 2 }))
        .to.be.rejectedWith(ValidationError, 'model is required');
      await expect(getQueryEmbeddings(makeClient(), { texts: ['x'], model: 'm'.repeat(MAX_MODEL_LENGTH + 1), dims: 2 }))
        .to.be.rejectedWith(ValidationError, `model must be at most ${MAX_MODEL_LENGTH} characters`);
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
        text_hash: shoes, model: MODEL, dims: 2, text: 'running shoes', embedding: '[0.1,0.2]',
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
