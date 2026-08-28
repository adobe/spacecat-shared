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

import {
  URL_INDEX_TABLES,
  syncUrlIndex,
  lookupEntityIdsByUrl,
} from '../../../src/util/url-index.utils.js';

chaiUse(chaiAsPromised);

const TABLE = 'opportunity_urls';
const SITE_ID = 'site-1';
const ENTITY_ID = 'oppty-1';
const ENTITY_TYPE = 'wikipedia-analysis';

/**
 * Builds a fake `@supabase/postgrest-js` client covering the exact chains the helper uses.
 * Its query builders mirror postgrest-js: `.eq(...)` is both awaitable and chainable, so a
 * `.delete().eq(...)` can be awaited directly (clear) or extended with `.in(...)` (prune),
 * and `.select(...).eq(...)` can be awaited (read-back) or extended with `.in(...)` (lookup).
 */
function makeClient(config = {}) {
  const calls = {
    upsert: [], deleteEq: [], deleteIn: [], selectEq: [], selectIn: [],
  };
  const lookupQueue = Array.isArray(config.selectResults) ? [...config.selectResults] : null;

  // A resolved promise (awaitable) that also exposes an `.in(...)` continuation.
  const withIn = (result, onIn) => {
    const promise = Promise.resolve(result);
    promise.in = onIn;
    return promise;
  };

  const client = {
    from(table) {
      return {
        upsert(rows, opts) {
          calls.upsert.push({ table, rows, opts });
          return Promise.resolve(config.upsertResult ?? { error: null });
        },
        delete() {
          return {
            eq(col, val) {
              calls.deleteEq.push({ table, col, val });
              return withIn(config.deleteResult ?? { error: null }, (icol, arr) => {
                calls.deleteIn.push({
                  table, col, val, icol, arr,
                });
                return Promise.resolve(config.pruneResult ?? { error: null });
              });
            },
          };
        },
        select(cols) {
          return {
            eq(scol, sval) {
              calls.selectEq.push({
                table, cols, scol, sval,
              });
              return withIn(config.readBackResult ?? { data: [], error: null }, (icol, arr) => {
                calls.selectIn.push({
                  table, cols, scol, sval, icol, arr,
                });
                const res = lookupQueue
                  ? (lookupQueue.shift() ?? { data: [], error: null })
                  : (config.selectResult ?? { data: [], error: null });
                return Promise.resolve(res);
              });
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

describe('url-index.utils', () => {
  it('exposes the allowed tables', () => {
    expect(URL_INDEX_TABLES).to.deep.equal(['opportunity_urls', 'suggestion_urls']);
  });

  describe('syncUrlIndex', () => {
    it('rejects a missing client', async () => {
      await expect(syncUrlIndex(undefined, { table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID }))
        .to.be.rejectedWith('postgrestClient is required');
    });

    it('rejects a client without a from() method', async () => {
      await expect(syncUrlIndex({}, { table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID }))
        .to.be.rejectedWith('postgrestClient is required');
    });

    it('rejects an unknown table', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, { table: 'nope', siteId: SITE_ID, entityId: ENTITY_ID }))
        .to.be.rejectedWith('Invalid url-index table: nope');
    });

    it('rejects a missing table (no args)', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client)).to.be.rejectedWith('Invalid url-index table: undefined');
    });

    it('rejects a missing siteId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, {
        table: TABLE, entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      })).to.be.rejectedWith('siteId is required');
    });

    it('rejects an empty-string siteId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, {
        table: TABLE, siteId: '', entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      })).to.be.rejectedWith('siteId is required');
    });

    it('rejects a missing entityId', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, { table: TABLE, siteId: SITE_ID, entityType: ENTITY_TYPE }))
        .to.be.rejectedWith('entityId is required');
    });

    it('rejects a missing entityType', async () => {
      const { client } = makeClient();
      await expect(syncUrlIndex(client, { table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID }))
        .to.be.rejectedWith('entityType is required');
    });

    it('upserts the canonical set, de-duplicating and dropping non-string/empty urls', async () => {
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
      expect(calls.upsert[0].opts).to.deep.equal({ onConflict: 'entity_id,url' });
      expect(calls.upsert[0].rows).to.deep.equal([
        {
          site_id: SITE_ID, entity_id: ENTITY_ID, entity_type: ENTITY_TYPE, url: 'example.com/a',
        },
        {
          site_id: SITE_ID, entity_id: ENTITY_ID, entity_type: ENTITY_TYPE, url: 'example.com/b',
        },
      ]);
      expect(calls.selectEq).to.deep.equal([{
        table: TABLE, cols: 'url', scol: 'entity_id', sval: ENTITY_ID,
      }]);
      expect(calls.deleteEq).to.have.length(0);
      expect(calls.deleteIn).to.have.length(0);
    });

    it('prunes rows that are no longer in the current set', async () => {
      const { client, calls } = makeClient({
        readBackResult: {
          data: [
            { url: 'example.com/a' }, // kept
            { url: 'example.com/old' }, // stale -> pruned
            { url: 'example.com/gone' }, // stale -> pruned
          ],
          error: null,
        },
      });
      const written = await syncUrlIndex(client, {
        table: TABLE,
        siteId: SITE_ID,
        entityId: ENTITY_ID,
        entityType: ENTITY_TYPE,
        urls: ['https://example.com/a'],
      });

      expect(written).to.equal(1);
      expect(calls.upsert).to.have.length(1);
      expect(calls.deleteIn).to.have.length(1);
      expect(calls.deleteIn[0]).to.include({
        table: TABLE, col: 'entity_id', val: ENTITY_ID, icol: 'url',
      });
      expect(calls.deleteIn[0].arr).to.deep.equal(['example.com/old', 'example.com/gone']);
    });

    it('does not prune when nothing is stale', async () => {
      const { client, calls } = makeClient({
        readBackResult: { data: [{ url: 'example.com/a' }], error: null },
      });
      await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/a'],
      });
      expect(calls.deleteIn).to.have.length(0);
    });

    it('tolerates a null read-back payload', async () => {
      const { client, calls } = makeClient({
        readBackResult: { data: null, error: null },
      });
      const written = await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/a'],
      });
      expect(written).to.equal(1);
      expect(calls.deleteIn).to.have.length(0);
    });

    it('clears the entity (delete only, no upsert/read-back) when there are no valid urls', async () => {
      const { client, calls } = makeClient();
      const written = await syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      });
      expect(written).to.equal(0);
      expect(calls.deleteEq).to.deep.equal([{ table: TABLE, col: 'entity_id', val: ENTITY_ID }]);
      expect(calls.upsert).to.have.length(0);
      expect(calls.selectEq).to.have.length(0);
    });

    it('throws when the clear (empty-urls) delete fails', async () => {
      const { client } = makeClient({ deleteResult: { error: { message: 'del boom' } } });
      await expect(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE,
      })).to.be.rejectedWith(`Failed to clear ${TABLE} for entity ${ENTITY_ID}: del boom`);
    });

    it('throws when the upsert fails', async () => {
      const { client } = makeClient({ upsertResult: { error: { message: 'ups boom' } } });
      await expect(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://x.com'],
      })).to.be.rejectedWith(`Failed to sync ${TABLE} for entity ${ENTITY_ID}: ups boom`);
    });

    it('throws when the read-back fails', async () => {
      const { client } = makeClient({ readBackResult: { data: null, error: { message: 'read boom' } } });
      await expect(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://x.com'],
      })).to.be.rejectedWith(`Failed to read ${TABLE} for entity ${ENTITY_ID}: read boom`);
    });

    it('throws when the prune delete fails', async () => {
      const { client } = makeClient({
        readBackResult: { data: [{ url: 'example.com/old' }], error: null },
        pruneResult: { error: { message: 'prune boom' } },
      });
      await expect(syncUrlIndex(client, {
        table: TABLE, siteId: SITE_ID, entityId: ENTITY_ID, entityType: ENTITY_TYPE, urls: ['https://example.com/a'],
      })).to.be.rejectedWith(`Failed to prune ${TABLE} for entity ${ENTITY_ID}: prune boom`);
    });
  });

  describe('lookupEntityIdsByUrl', () => {
    it('rejects a missing client', async () => {
      await expect(lookupEntityIdsByUrl(undefined, { table: TABLE, siteId: SITE_ID }))
        .to.be.rejectedWith('postgrestClient is required');
    });

    it('rejects an unknown table', async () => {
      const { client } = makeClient();
      await expect(lookupEntityIdsByUrl(client, { table: 'nope', siteId: SITE_ID }))
        .to.be.rejectedWith('Invalid url-index table: nope');
    });

    it('rejects a missing siteId', async () => {
      const { client } = makeClient();
      await expect(lookupEntityIdsByUrl(client, { table: TABLE, urls: ['https://x.com'] }))
        .to.be.rejectedWith('siteId is required');
    });

    it('returns [] without querying when there are no valid urls', async () => {
      const { client, calls } = makeClient();
      const rows = await lookupEntityIdsByUrl(client, { table: TABLE, siteId: SITE_ID, urls: [null, ''] });
      expect(rows).to.deep.equal([]);
      expect(calls.selectIn).to.have.length(0);
    });

    it('queries by canonical url and returns matched rows', async () => {
      const { client, calls } = makeClient({
        selectResult: { data: [{ entity_id: ENTITY_ID, entity_type: ENTITY_TYPE, url: 'example.com/a' }], error: null },
      });
      const rows = await lookupEntityIdsByUrl(client, {
        table: TABLE, siteId: SITE_ID, urls: ['https://www.Example.com/a/'],
      });
      expect(rows).to.deep.equal([{ entity_id: ENTITY_ID, entity_type: ENTITY_TYPE, url: 'example.com/a' }]);
      expect(calls.selectIn).to.have.length(1);
      expect(calls.selectIn[0]).to.include({
        table: TABLE, cols: 'entity_id, entity_type, url', scol: 'site_id', sval: SITE_ID, icol: 'url',
      });
      expect(calls.selectIn[0].arr).to.deep.equal(['example.com/a']);
    });

    it('tolerates a null data payload', async () => {
      const { client } = makeClient({ selectResult: { data: null, error: null } });
      const rows = await lookupEntityIdsByUrl(client, {
        table: TABLE, siteId: SITE_ID, urls: ['https://x.com'],
      });
      expect(rows).to.deep.equal([]);
    });

    it('chunks the lookup at 50 urls and concatenates results', async () => {
      const urls = Array.from({ length: 51 }, (_, i) => `https://example.com/p${i}`);
      const { client, calls } = makeClient({
        selectResults: [
          { data: [{ entity_id: 'a', entity_type: ENTITY_TYPE, url: 'example.com/p0' }], error: null },
          { data: [{ entity_id: 'b', entity_type: ENTITY_TYPE, url: 'example.com/p50' }], error: null },
        ],
      });
      const rows = await lookupEntityIdsByUrl(client, { table: TABLE, siteId: SITE_ID, urls });
      expect(calls.selectIn).to.have.length(2);
      expect(calls.selectIn[0].arr).to.have.length(50);
      expect(calls.selectIn[1].arr).to.have.length(1);
      expect(rows).to.deep.equal([
        { entity_id: 'a', entity_type: ENTITY_TYPE, url: 'example.com/p0' },
        { entity_id: 'b', entity_type: ENTITY_TYPE, url: 'example.com/p50' },
      ]);
    });

    it('throws when a lookup query fails', async () => {
      const { client } = makeClient({ selectResult: { data: null, error: { message: 'sel boom' } } });
      await expect(lookupEntityIdsByUrl(client, {
        table: TABLE, siteId: SITE_ID, urls: ['https://x.com'],
      })).to.be.rejectedWith(`Failed to look up ${TABLE} for site ${SITE_ID}: sel boom`);
    });
  });
});
