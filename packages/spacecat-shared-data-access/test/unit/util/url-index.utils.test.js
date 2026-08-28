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
  syncUrlIndex,
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
    upsert: [], clear: [], prune: [], readBack: [], lookup: [],
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
      calls.prune.push({ table: state.table, eqs: state.eqs, urls: state.inFilter.values });
      return Promise.resolve(shiftOr(queues.prune, config.pruneResult ?? noError));
    }
    if (state.op === 'delete') {
      calls.clear.push({ table: state.table, eqs: state.eqs });
      return Promise.resolve(config.clearResult ?? noError);
    }
    if (state.range) {
      calls.readBack.push({ table: state.table, eqs: state.eqs, range: state.range });
      return Promise.resolve(shiftOr(queues.readPages, config.readBackResult ?? noRows));
    }
    calls.lookup.push({
      table: state.table, columns: state.columns, eqs: state.eqs, urls: state.inFilter?.values,
    });
    return Promise.resolve(shiftOr(queues.lookup, config.lookupResult ?? noRows));
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
      const { client, calls } = makeClient();
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
      expect(calls.prune).to.have.length(0);
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
