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

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import RUMAPIClient from '../src/index.js';

chai.use(chaiAsPromised);
const { expect } = chai;

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
    const opts = {
      domain: 'space.cat',
      domainkey: 'some-domain-key',
      interval: 0,
    };
    const result = await rumApiClient.query('404', opts);

    expect(result).to.be.empty;
  });

  it('createFrom factory method caches the client', async () => {
    const newClient = RUMAPIClient.createFrom(context);

    expect(newClient).to.equal(rumApiClient);
  });
});
