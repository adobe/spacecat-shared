/*
 * Copyright 2024 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */
/* eslint-env mocha */

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';

import RUMAPIClient, { RUM_BUNDLER_API_HOST } from '../src/index.js';

use(chaiAsPromised);

describe('RUMAPIClient', () => {
  const context = { env: {} };
  const rumApiClient = RUMAPIClient.createFrom(context);

  it('throws error when unknown query is requested', async () => {
    await expect(rumApiClient.query('unknown-query', {})).to.be.rejectedWith('Unknown query unknown-query');
  });

  it('throws error when query fails', async () => {
    await expect(rumApiClient.query('404', {})).to.be.rejectedWith('Query \'404\' failed. Opts: {}.\n'
      + '--> Reason: You need to provide a \'domainkey\' or set RUM_ADMIN_KEY env variable');
  });

  it('runs the query', async () => {
    function constructUrl(domain, date, domainkey) {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');

      return `/${domain}/${year}/${month}/${day}?domainkey=${domainkey}`;
    }

    const queryUrl = `/bundles${constructUrl('space.cat', new Date(), 'some-domain-key')}`;

    nock(RUM_BUNDLER_API_HOST)
      .get(queryUrl)
      .reply(200, { rumBundles: [] });

    const opts = {
      domain: 'space.cat',
      domainkey: 'some-domain-key',
      interval: 0,
    };
    const result = await rumApiClient.query('404', opts);
    // eslint-disable-next-line no-unused-expressions
    expect(result).to.be.empty;
  });

  it('throws error when unknown query is requested in multi query', async () => {
    await expect(rumApiClient.queryMulti(['unknown-query'], {})).to.be.rejectedWith('Unknown query: unknown-query');
  });

  it('throws error when a query fails during multi query due to missing domainkey/admin key', async () => {
    await expect(rumApiClient.queryMulti(['404'], {})).to.be.rejectedWith('Multi query failed. Queries: ["404"], Opts: {}.\n'
      + '--> Reason: You need to provide a \'domainkey\' or set RUM_ADMIN_KEY env variable');
  });

  it('runs multiple queries', async () => {
    function constructUrl(domain, date, domainkey) {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');

      return `/${domain}/${year}/${month}/${day}?domainkey=${domainkey}`;
    }

    const queryUrl = `/bundles${constructUrl('space.cat', new Date(), 'some-domain-key')}`;

    nock(RUM_BUNDLER_API_HOST)
      .get(queryUrl)
      .reply(200, { rumBundles: [] });

    const opts = {
      domain: 'space.cat',
      domainkey: 'some-domain-key',
      interval: 0,
    };
    const result = await rumApiClient.queryMulti(['404', 'cwv'], opts);

    expect(Object.keys(result)).to.have.members(['404', 'cwv']);
  });

  it('createFrom factory method caches the client', async () => {
    const newClient = RUMAPIClient.createFrom(context);

    expect(newClient).to.equal(rumApiClient);
  });
});

describe('RUMAPIClient with admin key for external domainkey fetch', () => {
  let context;
  let client;
  beforeEach(() => {
    context = { env: { RUM_ADMIN_KEY: 'admin-key' } };
    delete context.rumApiClient;
    client = RUMAPIClient.createFrom(context);
  });

  it('fetches domainkey externally when not provided in opts', async () => {
    nock(RUM_BUNDLER_API_HOST)
      .get('/domainkey/example.com')
      .matchHeader('Authorization', 'Bearer admin-key')
      .reply(200, { domainkey: 'external-domain-key' });

    nock(RUM_BUNDLER_API_HOST)
      .get((uri) => uri.includes('/bundles/'))
      .reply(200, { rumBundles: [] });

    const opts = {
      domain: 'example.com',
      interval: 0,
    };

    const result = await client.query('404', opts);
    expect(result).to.be.empty;
  });

  it('throws error when external domainkey fetch returns non-ok status', async () => {
    nock(RUM_BUNDLER_API_HOST)
      .get('/domainkey/example.com')
      .matchHeader('Authorization', 'Bearer admin-key')
      .reply(500);

    const opts = {
      domain: 'example.com',
      interval: 0,
    };

    await expect(client.query('404', opts))
      .to.be.rejectedWith("Error during fetching domainkey for domain 'example.com using admin key. Status: 500");
  });

  it('throws error when external domainkey fetch returns unexpected response', async () => {
    nock(RUM_BUNDLER_API_HOST)
      .get('/domainkey/example.com')
      .matchHeader('Authorization', 'Bearer admin-key')
      .reply(200, '{"some-key": "some-value"}');

    const opts = {
      domain: 'example.com',
      interval: 0,
    };

    await expect(client.query('404', opts))
      .to.be.rejectedWith("Query '404' failed. Opts: {\"domain\":\"example.com\",\"interval\":0}.\n"
        + "--> Reason: Error during fetching domainkey for domain 'example.com using admin key. Error: Unexpected response: {\"some-key\":\"some-value\"}");
  });

  it('throws error when external domainkey fetch returns invalid JSON', async () => {
    nock(RUM_BUNDLER_API_HOST)
      .get('/domainkey/example.com')
      .matchHeader('Authorization', 'Bearer admin-key')
      .reply(200, 'invalid json');

    const opts = {
      domain: 'example.com',
      interval: 0,
    };

    await expect(client.query('404', opts))
      .to.be.rejectedWith("Error during fetching domainkey for domain 'example.com using admin key. Error:");
  });
});

describe('RUMAPIClient retrieveDomainkey method', () => {
  let context;
  let client;
  beforeEach(() => {
    context = { env: { RUM_ADMIN_KEY: 'admin-key' } };
    delete context.rumApiClient;
    client = RUMAPIClient.createFrom(context);
  });

  it('retrieves and caches the domainkey', async () => {
    const domain = 'example.com';

    const domainKeyScope = nock(RUM_BUNDLER_API_HOST)
      .get(`/domainkey/${domain}`)
      .matchHeader('Authorization', 'Bearer admin-key')
      .reply(200, { domainkey: 'cached-domain-key' });

    // first call triggers an external fetch
    const dk1 = await client.retrieveDomainkey(domain);
    expect(dk1).to.equal('cached-domain-key');
    expect(domainKeyScope.isDone()).to.be.true;

    // second call should return the cached value (no new HTTP request)
    const dk2 = await client.retrieveDomainkey(domain);
    expect(dk2).to.equal('cached-domain-key');
  });
});
