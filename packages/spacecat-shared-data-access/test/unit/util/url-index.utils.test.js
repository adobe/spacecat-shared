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
import { DEFAULT_PAGE_SIZE } from '../../../src/util/postgrest.utils.js';
import {
  URL_INDEX_TABLES,
  URL_CHUNK_SIZE,
  syncUrlIndex,
  syncUrlIndexMany,
  lookupEntityIdsByUrl,
} from '../../../src/util/url-index.utils.js';

chaiUse(chaiAsPromised);

const TABLE = 'opportunity_urls';
const SITE_ID = 'site-1';
const ENTITY_ID = 'oppty-1';
const ENTITY_TYPE = 'opportunity-type';

/**
 * Fake `@supabase/postgrest-js` client whose builder is chainable and awaitable. Each chain is
 * classified at its terminal (upsert / clear / prune / read-back / lookup) and recorded in
 * `calls`; results come from `config` single values or per-call queues (`readPages`, etc.).
 */
function makeClient(config = {}) {
  const calls = {
    upsert: [], clear: [], clearMany: [], prune: [], readBack: [], lookup: [],
  };
  const queues = {
    readPages: Array.isArray(config.readPages) ? [...config.readPages] : null,
    prune: Array.isArray(config.pruneResults) ? [...config.pruneResults] : null,
    lookup: Array.isArray(config.lookupResults) ? [...config.lookupResults] : null,
  };
  const shiftOr = (queue, fallback) => (queue && queue.length ? queue.shift() : fallback);
  const noError = { error: null };
  const noRows = { data: [], error: null };

  function terminal(state) {
    if (state.op === 'upsert') {
      calls.upsert.push({ table: state.table, rows: state.rows, options: state.options });
      return Promise.resolve(config.upsertResult ?? noError);
    }
    if (state.op === 'delete' && state.inFilter) {
      if (state.inFilter.column === 'entity_id') {
        calls.clearMany.push({
          table: state.table, eqs: state.eqs, entityIds: state.inFilter.values,
        });
        return Promise.resolve(config.clearManyResult ?? noError);
      }
      calls.prune.push({ table: state.table, eqs: state.eqs, urls: state.inFilter.values });
      return Promise.resolve(shiftOr(queues.prune, config.pruneResult ?? noError));
    }
    if (state.op === 'delete') {
      calls.clear.push({ table: state.table, eqs: state.eqs });
      return Promise.resolve(config.clearResult ?? noError);
    }
    // Reads (selects). Both read-back and lookup now range-paginate, so classify by the filter
    // column (`in('url')` is the reverse lookup) rather than by the presence of `range`.
    if (state.inFilter?.column === 'url') {
      calls.lookup.push({
        table: state.table,
        columns: state.columns,
        eqs: state.eqs,
        urls: state.inFilter.values,
        orders: state.orders,
        range: state.range,
      });
      return Promise.resolve(shiftOr(queues.lookup, config.lookupResult ?? noRows));
    }
    calls.readBack.push({
      table: state.table,
      columns: state.columns,
      eqs: state.eqs,
      entityIds: state.inFilter?.values,
      orders: state.orders,
      range: state.range,
    });
    return Promise.resolve(shiftOr(queues.readPages, config.readBackResult ?? noRows));
  }

  function makeBuilder(state) {
    const next = (patch) => makeBuilder({ ...state, ...patch });
    return {
      select(columns) {
        return next({ op: 'select', columns });
      },
      delete() {
        return next({ op: 'delete' });
      },
      upsert(rows, options) {
        return terminal({
          ...state, op: 'upsert', rows, options,
        });
      },
      eq(column, value) {
        return next({ eqs: [...state.eqs, { column, value }] });
      },
      in(column, values) {
        return next({ inFilter: { column, values } });
      },
      order(column, options) {
        return next({ orders: [...state.orders, { column, options }] });
      },
      range(from, to) {
        return terminal({ ...state, range: { from, to } });
      },
      then(onFulfilled, onRejected) {
        return terminal(state).then(onFulfilled, onRejected);
      },
    };
  }

  const client = {
    from(table) {
      return makeBuilder({ table, eqs: [], orders: [] });
    },
  };
  return { client, calls };
}

const rowsFor = (list) => list.map((url) => ({ url }));
const catchError = async (promise) => {
  try {
    await promise;
    return null;
  } catch (e) {
    return e;
  }
};

describe('url-index.utils', () => {
  it('exposes the allowed tables', () => {
    expect(URL_INDEX_TABLES).to.deep.equal(['opportunity_urls', 'suggestion_urls']);
  });

  it('exposes the chunk size for consumers that batch manually', () => {
    expect(URL_CHUNK_SIZE).to.be.a('number').that.is.greaterThan(0);
  });

  describe('syncUrlIndex', () => {
    it('rejects a missing client', async () => {
      await expect(syncUrlIndex(undefined, { table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID }))
        .to.be.rejectedWith(ValidationError, 'postgrestClient is required');
    });

    it('rejects a client without a from() method', async () => {
      await expect(syncUrlIndex({}, { table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID }))
        .to.be.rejectedWith(ValidationError, 'postgrestClient is required');
    });

    it('rejects an unknown table', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, { table: 'nope', siteId: SITE_ID, entityId: ENTITY_ID }))
        .to.be.rejectedWith(ValidationError, 'Invalid url-index table: nope');
    });

    it('rejects a missing table (no args)', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client)).to.be.rejectedWith(ValidationError, 'Invalid url-index table: undefined');
    });

    it('rejects a missing siteId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, {
        table: TABLE, entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      })).to.be.rejectedWith(ValidationError, 'siteId is required');
    });

    it('rejects an empty-string siteId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, {
        table: TABLE, siteId: '', entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      })).to.be.rejectedWith(ValidationError, 'siteId is required');
    });

    it('rejects a missing entityId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, { table: TABLE, siteId: SITE_ID, entityType: ENTITY_TYPE }))
        .to.be.rejectedWith(ValidationError, 'entityId is required');
    });

    it('rejects a missing entityType', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, { table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID }))
        .to.be.rejectedWith(ValidationError, 'entityType is required');
    });

    it('throws (does not clear) when a non-empty urls has no valid entries', async () => {
      const { client, calls } = makeClient();
      await expect(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: [null, 42, ''],
      })).to.be.rejectedWith(ValidationError, 'urls contained no valid entries');
      expect(calls.clear).to.have.length(0);
    });

    it('throws when urls is a non-array (e.g. a bare string)', async () => {
      const { client, calls } = makeClient();
      await expect(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: 'https://example.com/a',
      })).to.be.rejectedWith(ValidationError, 'urls contained no valid entries');
      expect(calls.clear).to.have.length(0);
    });

    it('upserts the canonical set (de-duplicated, non-string/empty dropped), scoped by site', async () => {
      // Read-back returns exactly the upserted set, so the no-prune assertion below is meaningful
      // (nothing is stale) rather than vacuously true against an empty index.
      const { client, calls } = makeClient({
        readPages: [{ data: rowsFor(['example.com/a', 'example.com/b']), error: null }],
      });
      const written = await syncUrlIndex(client, {
        table: TABLE,
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        urls: [
          'https://example.com/a',
          'https://www.example.com/a/', // same canonical as above
          '', // canonicalizes to '' -> dropped
          null, // non-string -> dropped
          42, // non-string -> dropped
          'https://example.com/b',
        ],
      });

      expect(written).to.equal(2);
      expect(calls.upsert).to.have.length(1);
      expect(calls.upsert[0].options).to.deep.equal({ onConflict: 'entity_id,url' });
      expect(calls.upsert[0].rows).to.deep.equal([
        {
          site_id: SITE_ID, entity_id: ENTITY_ID, entity_type: ENTITY_TYPE, url: 'example.com/a',
        },
        {
          site_id: SITE_ID, entity_id: ENTITY_ID, entity_type: ENTITY_TYPE, url: 'example.com/b',
        },
      ]);
      expect(calls.readBack).to.have.length(1);
      expect(calls.readBack[0].eqs).to.deep.equal([
        { column: 'site_id', value: SITE_ID },
        { column: 'entity_id', value: ENTITY_ID },
      ]);
      // ordered so `range()` pagination has a stable boundary
      expect(calls.readBack[0].orders).to.deep.equal([{ column: 'url', options: { ascending: true } }]);
      // read-back matched the keep set, so nothing is stale -> no prune (the index was non-empty)
      expect(calls.prune).to.have.length(0);
    });

    it('chunks the upsert at 50 rows', async () => {
      const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/p${i}`);
      const { client, calls } = makeClient();
      const written = await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls,
      });
      expect(written).to.equal(51);
      expect(calls.upsert).to.have.length(2);
      expect(calls.upsert[0].rows).to.have.length(50);
      expect(calls.upsert[1].rows).to.have.length(1);
    });

    it('prunes stale rows, chunked at 50, scoped by site and entity', async () => {
      const stale = Array.from({ length: 51 }, (_, i) => `example.com/old-${i}`);
      const { client, calls } = makeClient({
        readPages: [{ data: rowsFor(['example.com/a', ...stale]), error: null }],
      });
      const written = await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/a'],
      });

      expect(written).to.equal(1);
      expect(calls.prune).to.have.length(2);
      expect(calls.prune[0].urls).to.have.length(50);
      expect(calls.prune[1].urls).to.have.length(1);
      expect(calls.prune[0].eqs).to.deep.equal([
        { column: 'site_id', value: SITE_ID },
        { column: 'entity_id', value: ENTITY_ID },
      ]);
      // exactly the stale set, in read order
      expect([...calls.prune[0].urls, ...calls.prune[1].urls]).to.deep.equal(stale);
    });

    it('prunes exactly 50 stale rows in a single chunk (boundary)', async () => {
      const stale = Array.from({ length: 50 }, (_, i) => `example.com/old-${i}`);
      const { client, calls } = makeClient({
        readPages: [{ data: rowsFor(['example.com/a', ...stale]), error: null }],
      });
      await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/a'],
      });
      expect(calls.prune).to.have.length(1);
      expect(calls.prune[0].urls).to.have.length(50);
    });

    it('paginates the read-back until a short page, then prunes across pages', async () => {
      const page1 = rowsFor(Array.from({ length: DEFAULT_PAGE_SIZE }, () => 'example.com/keep'));
      const { client, calls } = makeClient({
        readPages: [
          { data: page1, error: null }, // full page -> fetch another
          { data: rowsFor(['example.com/stale']), error: null }, // short page -> stop
        ],
      });
      await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/keep'],
      });
      expect(calls.readBack).to.have.length(2);
      expect(calls.readBack[0].range).to.deep.equal({ from: 0, to: DEFAULT_PAGE_SIZE - 1 });
      expect(calls.readBack[1].range).to.deep.equal({
        from: DEFAULT_PAGE_SIZE, to: (2 * DEFAULT_PAGE_SIZE) - 1,
      });
      expect(calls.prune).to.have.length(1);
      expect(calls.prune[0].urls).to.deep.equal(['example.com/stale']);
    });

    it('does not prune when nothing is stale', async () => {
      const { client, calls } = makeClient({
        readPages: [{ data: rowsFor(['example.com/a']), error: null }],
      });
      await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/a'],
      });
      expect(calls.prune).to.have.length(0);
    });

    it('supports the suggestion_urls table', async () => {
      const { client, calls } = makeClient({
        readPages: [{ data: rowsFor(['example.com/a', 'example.com/old']), error: null }],
      });
      await syncUrlIndex(client, {
        table: 'suggestion_urls', siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/a'],
      });
      expect(calls.upsert[0].table).to.equal('suggestion_urls');
      expect(calls.readBack[0].table).to.equal('suggestion_urls');
      expect(calls.prune[0].table).to.equal('suggestion_urls');
    });

    it('clears the entity (delete only, no upsert/read-back), scoped by site, on an empty array', async () => {
      const { client, calls } = makeClient();
      const written = await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: [],
      });
      expect(written).to.equal(0);
      expect(calls.clear).to.deep.equal([{
        table: TABLE,
        eqs: [{ column: 'site_id', value: SITE_ID }, { column: 'entity_id', value: ENTITY_ID }],
      }]);
      expect(calls.upsert).to.have.length(0);
      expect(calls.readBack).to.have.length(0);
    });

    it('clears the entity when urls is omitted (undefined)', async () => {
      const { client, calls } = makeClient();
      const written = await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      });
      expect(written).to.equal(0);
      expect(calls.clear).to.have.length(1);
      expect(calls.upsert).to.have.length(0);
    });

    it('clears the entity when urls is null', async () => {
      const { client, calls } = makeClient();
      const written = await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: null,
      });
      expect(written).to.equal(0);
      expect(calls.clear).to.have.length(1);
      expect(calls.upsert).to.have.length(0);
    });

    it('throws DataAccessError with cause when the clear delete fails', async () => {
      const cause = { message: 'del boom' };
      const { client } = makeClient({ clearResult: { error: cause } });
      const err = await catchError(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: [],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to clear ${TABLE} for entity ${ENTITY_ID}`);
      expect(err.cause).to.equal(cause);
    });

    it('throws DataAccessError with cause when the upsert fails', async () => {
      const cause = { message: 'ups boom' };
      const { client } = makeClient({ upsertResult: { error: cause } });
      const err = await catchError(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://x.com'],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to sync ${TABLE} for entity ${ENTITY_ID}`);
      expect(err.cause).to.equal(cause);
    });

    it('throws DataAccessError with cause when the read-back fails', async () => {
      const cause = { message: 'read boom' };
      const { client } = makeClient({ readPages: [{ data: null, error: cause }] });
      const err = await catchError(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://x.com'],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to read ${TABLE} for entity ${ENTITY_ID}`);
      expect(err.cause).to.equal(cause);
    });

    it('throws DataAccessError with cause when the prune delete fails', async () => {
      const cause = { message: 'prune boom' };
      const { client } = makeClient({
        readPages: [{ data: rowsFor(['example.com/old']), error: null }],
        pruneResults: [{ error: cause }],
      });
      const err = await catchError(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/a'],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to prune ${TABLE} for entity ${ENTITY_ID}`);
      expect(err.cause).to.equal(cause);
    });
  });

  describe('syncUrlIndexMany', () => {
    const entry = (entityId, urls) => ({ entityId, urls });
    const base = { table: TABLE, siteId: SITE_ID, entityType: ENTITY_TYPE };

    it('rejects a missing client', async () => {
      await expect(syncUrlIndexMany(undefined, { ...base, entries: [] }))
        .to.be.rejectedWith(ValidationError, 'postgrestClient is required');
    });

    it('rejects an unknown table', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndexMany(client, { ...base, table: 'nope', entries: [] }))
        .to.be.rejectedWith(ValidationError, 'Invalid url-index table: nope');
    });

    it('rejects a missing siteId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndexMany(client, { table: TABLE, entityType: ENTITY_TYPE, entries: [] }))
        .to.be.rejectedWith(ValidationError, 'siteId is required');
    });

    it('rejects a missing entityType', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndexMany(client, { table: TABLE, siteId: SITE_ID, entries: [] }))
        .to.be.rejectedWith(ValidationError, 'entityType is required');
    });

    it('rejects non-array entries', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndexMany(client, { ...base, entries: 'nope' }))
        .to.be.rejectedWith(ValidationError, 'entries must be an array');
    });

    it('is a no-op for empty entries', async () => {
      const { client, calls } = makeClient();
      const result = await syncUrlIndexMany(client, { ...base, entries: [] });
      expect(result).to.be.instanceOf(Map);
      expect(result.size).to.equal(0);
      expect(calls.upsert).to.have.length(0);
      expect(calls.clearMany).to.have.length(0);
    });

    it('rejects an entry with a missing entityId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndexMany(client, {
        ...base, entries: [{ urls: ['https://x.com'] }],
      })).to.be.rejectedWith(ValidationError, 'entityId is required');
    });

    it('rejects a null entry', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndexMany(client, {
        ...base, entries: [null],
      })).to.be.rejectedWith(ValidationError, 'entityId is required');
    });

    it('rejects duplicate entityId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndexMany(client, {
        ...base,
        entries: [entry('e1', ['https://x.com/a']), entry('e1', ['https://x.com/b'])],
      })).to.be.rejectedWith(ValidationError, 'Duplicate entityId in entries: e1');
    });

    it('throws (does not clear) when an entry has a non-empty urls with no valid entries', async () => {
      const { client, calls } = makeClient();
      await expect(syncUrlIndexMany(client, {
        ...base, entries: [entry('e1', [null, 42, ''])],
      })).to.be.rejectedWith(ValidationError, 'urls contained no valid entries');
      expect(calls.clearMany).to.have.length(0);
      expect(calls.upsert).to.have.length(0);
    });

    it('bulk-upserts across entities in one call, stamping the shared type, and returns per-entity counts', async () => {
      const { client, calls } = makeClient({
        readPages: [{
          data: [
            { entity_id: 'e1', url: 'example.com/a' },
            { entity_id: 'e2', url: 'example.com/b' },
          ],
          error: null,
        }],
      });
      const result = await syncUrlIndexMany(client, {
        table: TABLE,
        siteId: SITE_ID,
        entityType: 'shared-type',
        entries: [
          entry('e1', ['https://example.com/a']),
          entry('e2', ['https://www.example.com/b/']),
        ],
      });

      expect([...result.entries()]).to.deep.equal([['e1', 1], ['e2', 1]]);
      expect(calls.upsert).to.have.length(1);
      expect(calls.upsert[0].options).to.deep.equal({ onConflict: 'entity_id,url' });
      expect(calls.upsert[0].rows).to.deep.equal([
        {
          site_id: SITE_ID, entity_id: 'e1', entity_type: 'shared-type', url: 'example.com/a',
        },
        {
          site_id: SITE_ID, entity_id: 'e2', entity_type: 'shared-type', url: 'example.com/b',
        },
      ]);
      expect(calls.readBack).to.have.length(1);
      expect(calls.readBack[0].entityIds).to.deep.equal(['e1', 'e2']);
      expect(calls.readBack[0].eqs).to.deep.equal([{ column: 'site_id', value: SITE_ID }]);
      expect(calls.readBack[0].orders).to.deep.equal([
        { column: 'entity_id', options: { ascending: true } },
        { column: 'url', options: { ascending: true } },
      ]);
      expect(calls.prune).to.have.length(0);
      expect(calls.clearMany).to.have.length(0);
    });

    it('de-duplicates urls within an entry', async () => {
      const { client, calls } = makeClient();
      const result = await syncUrlIndexMany(client, {
        ...base,
        entries: [entry('e1', ['https://example.com/a', 'https://www.example.com/a/'])],
      });
      expect(result.get('e1')).to.equal(1);
      expect(calls.upsert[0].rows).to.deep.equal([
        {
          site_id: SITE_ID, entity_id: 'e1', entity_type: ENTITY_TYPE, url: 'example.com/a',
        },
      ]);
    });

    it('chunks the bulk upsert at 50 rows', async () => {
      const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/p${i}`);
      const { client, calls } = makeClient();
      await syncUrlIndexMany(client, { ...base, entries: [entry('e1', urls)] });
      expect(calls.upsert).to.have.length(2);
      expect(calls.upsert[0].rows).to.have.length(50);
      expect(calls.upsert[1].rows).to.have.length(1);
    });

    it('prunes stale rows per entity after the batched read-back', async () => {
      const { client, calls } = makeClient({
        readPages: [{
          data: [
            { entity_id: 'e1', url: 'example.com/a' },
            { entity_id: 'e1', url: 'example.com/old' },
            { entity_id: 'e2', url: 'example.com/b' },
          ],
          error: null,
        }],
      });
      await syncUrlIndexMany(client, {
        ...base,
        entries: [entry('e1', ['https://example.com/a']), entry('e2', ['https://example.com/b'])],
      });
      expect(calls.prune).to.have.length(1);
      expect(calls.prune[0].eqs).to.deep.equal([
        { column: 'site_id', value: SITE_ID },
        { column: 'entity_id', value: 'e1' },
      ]);
      expect(calls.prune[0].urls).to.deep.equal(['example.com/old']);
    });

    it('chunks the read-back by entity id and detects stale rows across chunks', async () => {
      const entries = Array.from({ length: 51 }, (_, i) => entry(`e${i}`, [`https://example.com/p${i}`]));
      // Read-back rows span BOTH id-chunks: e0/e1 in the first (50 ids), e50 in the second (1 id),
      // with a stale extra on e0 and e50. This exercises accumulation into `byEntity` across chunks
      // and a prune that must be grouped to the right entity in the second chunk.
      const { client, calls } = makeClient({
        readPages: [
          {
            data: [
              { entity_id: 'e0', url: 'example.com/p0' },
              { entity_id: 'e0', url: 'example.com/old0' }, // stale
              { entity_id: 'e1', url: 'example.com/p1' },
            ],
            error: null,
          },
          {
            data: [
              { entity_id: 'e50', url: 'example.com/p50' },
              { entity_id: 'e50', url: 'example.com/old50' }, // stale
            ],
            error: null,
          },
        ],
      });
      await syncUrlIndexMany(client, { ...base, entries });

      expect(calls.readBack).to.have.length(2);
      expect(calls.readBack[0].entityIds).to.have.length(50);
      expect(calls.readBack[1].entityIds).to.have.length(1);
      // one prune per entity with a stale row, grouped correctly across the two id-chunks
      expect(calls.prune).to.have.length(2);
      expect(calls.prune[0].eqs).to.deep.equal([
        { column: 'site_id', value: SITE_ID },
        { column: 'entity_id', value: 'e0' },
      ]);
      expect(calls.prune[0].urls).to.deep.equal(['example.com/old0']);
      // e50 lives in the SECOND id-chunk -> proves accumulation isn't reset/misgrouped per chunk
      expect(calls.prune[1].eqs).to.deep.equal([
        { column: 'site_id', value: SITE_ID },
        { column: 'entity_id', value: 'e50' },
      ]);
      expect(calls.prune[1].urls).to.deep.equal(['example.com/old50']);
    });

    it('paginates the read-back within a chunk until a short page', async () => {
      const page1 = Array.from(
        { length: DEFAULT_PAGE_SIZE },
        () => ({ entity_id: 'e1', url: 'example.com/keep' }),
      );
      const { client, calls } = makeClient({
        readPages: [
          { data: page1, error: null },
          { data: [{ entity_id: 'e1', url: 'example.com/stale' }], error: null },
        ],
      });
      await syncUrlIndexMany(client, {
        ...base, entries: [entry('e1', ['https://example.com/keep'])],
      });
      expect(calls.readBack).to.have.length(2);
      expect(calls.readBack[0].range).to.deep.equal({ from: 0, to: DEFAULT_PAGE_SIZE - 1 });
      expect(calls.readBack[1].range).to.deep.equal({
        from: DEFAULT_PAGE_SIZE, to: (2 * DEFAULT_PAGE_SIZE) - 1,
      });
      expect(calls.prune[0].urls).to.deep.equal(['example.com/stale']);
    });

    it('clears entries with empty/omitted/null urls in one batched delete', async () => {
      const { client, calls } = makeClient();
      const result = await syncUrlIndexMany(client, {
        ...base,
        entries: [entry('e1', []), entry('e2', undefined), entry('e3', null)],
      });
      expect([...result.entries()]).to.deep.equal([['e1', 0], ['e2', 0], ['e3', 0]]);
      expect(calls.upsert).to.have.length(0);
      expect(calls.readBack).to.have.length(0);
      expect(calls.clearMany).to.have.length(1);
      expect(calls.clearMany[0].entityIds).to.deep.equal(['e1', 'e2', 'e3']);
      expect(calls.clearMany[0].eqs).to.deep.equal([{ column: 'site_id', value: SITE_ID }]);
    });

    it('handles a mix of upsert and clear entries', async () => {
      const { client, calls } = makeClient();
      const result = await syncUrlIndexMany(client, {
        ...base,
        entries: [entry('e1', ['https://x.com/a']), entry('e2', [])],
      });
      expect([...result.entries()]).to.deep.equal([['e1', 1], ['e2', 0]]);
      expect(calls.upsert).to.have.length(1);
      expect(calls.readBack[0].entityIds).to.deep.equal(['e1']);
      expect(calls.clearMany[0].entityIds).to.deep.equal(['e2']);
    });

    it('chunks the batched clear at 50 entity ids', async () => {
      const entries = Array.from({ length: 51 }, (_, i) => entry(`e${i}`, []));
      const { client, calls } = makeClient();
      await syncUrlIndexMany(client, { ...base, entries });
      expect(calls.clearMany).to.have.length(2);
      expect(calls.clearMany[0].entityIds).to.have.length(50);
      expect(calls.clearMany[1].entityIds).to.have.length(1);
    });

    it('supports the suggestion_urls table', async () => {
      const { client, calls } = makeClient();
      await syncUrlIndexMany(client, {
        ...base, table: 'suggestion_urls', entries: [entry('e1', ['https://x.com/a'])],
      });
      expect(calls.upsert[0].table).to.equal('suggestion_urls');
      expect(calls.readBack[0].table).to.equal('suggestion_urls');
    });

    it('throws DataAccessError when the bulk upsert fails', async () => {
      const cause = { message: 'ups boom' };
      const { client } = makeClient({ upsertResult: { error: cause } });
      const err = await catchError(syncUrlIndexMany(client, {
        ...base, entries: [entry('e1', ['https://x.com/a'])],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to sync ${TABLE}`);
      expect(err.cause).to.equal(cause);
    });

    it('throws DataAccessError when the read-back fails', async () => {
      const cause = { message: 'read boom' };
      const { client } = makeClient({ readPages: [{ data: null, error: cause }] });
      const err = await catchError(syncUrlIndexMany(client, {
        ...base, entries: [entry('e1', ['https://x.com/a'])],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to read ${TABLE} for site ${SITE_ID}`);
      expect(err.cause).to.equal(cause);
    });

    it('throws DataAccessError when a prune delete fails', async () => {
      const cause = { message: 'prune boom' };
      const { client } = makeClient({
        readPages: [{ data: [{ entity_id: 'e1', url: 'example.com/old' }], error: null }],
        pruneResults: [{ error: cause }],
      });
      const err = await catchError(syncUrlIndexMany(client, {
        ...base, entries: [entry('e1', ['https://example.com/a'])],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to prune ${TABLE} for entity e1`);
      expect(err.cause).to.equal(cause);
    });

    it('throws DataAccessError when the batched clear fails', async () => {
      const cause = { message: 'clear boom' };
      const { client } = makeClient({ clearManyResult: { error: cause } });
      const err = await catchError(syncUrlIndexMany(client, {
        ...base, entries: [entry('e1', [])],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to clear ${TABLE}`);
      expect(err.cause).to.equal(cause);
    });
  });

  describe('lookupEntityIdsByUrl', () => {
    it('rejects a missing client', async () => {
      await expect(lookupEntityIdsByUrl(undefined, { table: TABLE, siteId: SITE_ID }))
        .to.be.rejectedWith(ValidationError, 'postgrestClient is required');
    });

    it('rejects an unknown table', async () => {
      const { client } = makeClient();
      await expect(lookupEntityIdsByUrl(client, { table: 'nope', siteId: SITE_ID }))
        .to.be.rejectedWith(ValidationError, 'Invalid url-index table: nope');
    });

    it('rejects a missing siteId', async () => {
      const { client } = makeClient();
      await expect(lookupEntityIdsByUrl(client, { table: TABLE, urls: ['https://x.com'] }))
        .to.be.rejectedWith(ValidationError, 'siteId is required');
    });

    it('returns [] without querying when there are no valid urls', async () => {
      const { client, calls } = makeClient();
      const rows = await lookupEntityIdsByUrl(client, { table: TABLE, siteId: SITE_ID, urls: [null, ''] });
      expect(rows).to.deep.equal([]);
      expect(calls.lookup).to.have.length(0);
    });

    it('queries by canonical url, scoped by site, and returns matched rows', async () => {
      const { client, calls } = makeClient({
        lookupResult: { data: [{ entity_id: ENTITY_ID, entity_type: ENTITY_TYPE, url: 'example.com/a' }], error: null },
      });
      const rows = await lookupEntityIdsByUrl(client, {
        table: TABLE, siteId: SITE_ID, urls: ['https://www.Example.com/a/'],
      });
      expect(rows).to.deep.equal([{ entity_id: ENTITY_ID, entity_type: ENTITY_TYPE, url: 'example.com/a' }]);
      expect(calls.lookup).to.have.length(1);
      expect(calls.lookup[0].columns).to.equal('entity_id, entity_type, url');
      expect(calls.lookup[0].eqs).to.deep.equal([{ column: 'site_id', value: SITE_ID }]);
      expect(calls.lookup[0].urls).to.deep.equal(['example.com/a']);
      // (url, entity_id) is unique, so this ordering gives `range()` a stable page boundary
      expect(calls.lookup[0].orders).to.deep.equal([
        { column: 'url', options: { ascending: true } },
        { column: 'entity_id', options: { ascending: true } },
      ]);
    });

    it('tolerates a null data payload', async () => {
      const { client } = makeClient({ lookupResult: { data: null, error: null } });
      const rows = await lookupEntityIdsByUrl(client, {
        table: TABLE, siteId: SITE_ID, urls: ['https://x.com'],
      });
      expect(rows).to.deep.equal([]);
    });

    it('chunks the lookup at 50 urls and concatenates results', async () => {
      const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/p${i}`);
      const { client, calls } = makeClient({
        lookupResults: [
          { data: [{ entity_id: 'a', entity_type: ENTITY_TYPE, url: 'example.com/p0' }], error: null },
          { data: [{ entity_id: 'b', entity_type: ENTITY_TYPE, url: 'example.com/p50' }], error: null },
        ],
      });
      const rows = await lookupEntityIdsByUrl(client, { table: TABLE, siteId: SITE_ID, urls });
      expect(calls.lookup).to.have.length(2);
      expect(calls.lookup[0].urls).to.have.length(50);
      expect(calls.lookup[1].urls).to.have.length(1);
      expect(rows).to.deep.equal([
        { entity_id: 'a', entity_type: ENTITY_TYPE, url: 'example.com/p0' },
        { entity_id: 'b', entity_type: ENTITY_TYPE, url: 'example.com/p50' },
      ]);
    });

    it('sends a single chunk for exactly 50 urls (boundary)', async () => {
      const urls = Array.from({ length: 50 }, (_, i) => `https://example.com/p${i}`);
      const { client, calls } = makeClient();
      await lookupEntityIdsByUrl(client, { table: TABLE, siteId: SITE_ID, urls });
      expect(calls.lookup).to.have.length(1);
      expect(calls.lookup[0].urls).to.have.length(50);
    });

    it('range-paginates within a chunk so a hot URL is not silently truncated', async () => {
      // One URL backed by more entities than the max-rows cap: a full page then a short page.
      const fullPage = Array.from(
        { length: DEFAULT_PAGE_SIZE },
        (_, i) => ({ entity_id: `e${i}`, entity_type: ENTITY_TYPE, url: 'example.com/a' }),
      );
      const { client, calls } = makeClient({
        lookupResults: [
          { data: fullPage, error: null }, // full page -> fetch another
          { data: [{ entity_id: 'last', entity_type: ENTITY_TYPE, url: 'example.com/a' }], error: null }, // short -> stop
        ],
      });
      const rows = await lookupEntityIdsByUrl(client, {
        table: TABLE, siteId: SITE_ID, urls: ['https://example.com/a'],
      });
      expect(calls.lookup).to.have.length(2);
      expect(calls.lookup[0].range).to.deep.equal({ from: 0, to: DEFAULT_PAGE_SIZE - 1 });
      expect(calls.lookup[1].range).to.deep.equal({
        from: DEFAULT_PAGE_SIZE, to: (2 * DEFAULT_PAGE_SIZE) - 1,
      });
      // all matches returned across pages, not truncated at the cap
      expect(rows).to.have.length(DEFAULT_PAGE_SIZE + 1);
      expect(rows[rows.length - 1].entity_id).to.equal('last');
    });

    it('throws DataAccessError with cause when a lookup query fails', async () => {
      const cause = { message: 'sel boom' };
      const { client } = makeClient({ lookupResult: { data: null, error: cause } });
      const err = await catchError(lookupEntityIdsByUrl(client, {
        table: TABLE, siteId: SITE_ID, urls: ['https://x.com'],
      }));
      expect(err).to.be.instanceOf(DataAccessError);
      expect(err.message).to.equal(`Failed to look up ${TABLE} for site ${SITE_ID}`);
      expect(err.cause).to.equal(cause);
    });
  });
});
