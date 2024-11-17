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

import RUMAPIClient from '../src/index.js';

use(chaiAsPromised);

describe('RUMAPIClient', () => {
  const context = {};
  const rumApiClient = RUMAPIClient.createFrom(context);

  it('throws error when unknown query is requested', async () => {
    await expect(rumApiClient.query('unknown-query', {})).to.be.rejectedWith('Unknown query unknown-query');
  });

  it('throws error when query fails', async () => {
    await expect(rumApiClient.query('404', {})).to.be.rejectedWith('Query \'404\' failed. Opts: {}. Reason: Missing required parameters');
  });

  it('runs the query', async () => {
    function constructUrl(domain, date, domainkey) {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');

      return `/${domain}/${year}/${month}/${day}?domainkey=${domainkey}`;
    }

    const queryUrl = `/bundles${constructUrl('space.cat', new Date(), 'some-domain-key')}`;

    nock('https://rum.fastly-aem.page')
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

  it('throws error when a query fails during multi query', async () => {
    await expect(rumApiClient.queryMulti(['404'], {})).to.be.rejectedWith('Multi query failed. Queries: ["404"], Opts: {}. Reason: Missing required parameters');
  });

  it('runs multiple queries', async () => {
    function constructUrl(domain, date, domainkey) {
      const year = date.getUTCFullYear();
      const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
      const day = date.getUTCDate().toString().padStart(2, '0');

      return `/${domain}/${year}/${month}/${day}?domainkey=${domainkey}`;
    }

    const queryUrl = `/bundles${constructUrl('space.cat', new Date(), 'some-domain-key')}`;

    nock('https://rum.fastly-aem.page')
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
