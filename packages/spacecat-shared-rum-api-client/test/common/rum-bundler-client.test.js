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
import sinon from 'sinon';
import nock from 'nock';
import { fetchBundles } from '../../src/common/rum-bundler-client.js';
import { generateDailyDates, generateHourlyDates, generateRumBundles } from '../fixtures/rum-bundler-urls.js';

use(chaiAsPromised);

const BASE_URL = 'https://bundles.aem.page';
describe('Rum bundler client', () => {
  let sandbox;

  before('setup', function () {
    const mockDate = '2024-06-02T12:30:01.124Z';
    sandbox = sinon.createSandbox();
    this.clock = sandbox.useFakeTimers({
      now: new Date(mockDate).getTime(),
    });
  });

  after('clean', function () {
    this.clock.uninstall();
  });

  afterEach(() => {
    sandbox.restore();
    nock.cleanAll();
  });

  it('should throw an error if required parameters are missing', async () => {
    await expect(fetchBundles({}, console)).to.be.rejectedWith('Missing required parameters');
  });

  it('should fetch correct hourly bundles and filter by checkpoint', async () => {
    const domain = 'some-domain.com';
    const domainkey = 'testkey';
    const granularity = 'HOURLY';
    const interval = 7;
    const allCheckpoints = ['good', 'bad'];

    const dates = generateHourlyDates(7);
    const rumBundles = generateRumBundles(dates, allCheckpoints);

    for (const date of dates) {
      nock(BASE_URL)
        .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}/${date[3]}?domainkey=${domainkey}`)
        .reply(200, rumBundles[date.join()]);
    }

    const result = await fetchBundles({
      domain,
      domainkey,
      granularity,
      interval,
      checkpoints: ['good'],
    }, console);

    const containsCorrectData = result.every((item) => item.events.length === 1 && item.events[0].checkpoint === 'good');

    expect(result.length).to.equal(dates.length);
    // eslint-disable-next-line no-unused-expressions
    expect(containsCorrectData).to.be.true;
  });

  it('should filter bot traffic by default', async () => {
    const domain = 'some-domain.com';
    const domainkey = 'testkey';
    const granularity = 'HOURLY';
    const interval = 7;
    const allCheckpoints = ['good', 'bad'];

    const dates = generateHourlyDates(7);
    const rumBundles = generateRumBundles(dates, allCheckpoints);
    // make the first bundle a bot traffic
    rumBundles[Object.keys(rumBundles)[0]].rumBundles[0].userAgent = 'bot';

    for (const date of dates) {
      nock(BASE_URL)
        .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}/${date[3]}?domainkey=${domainkey}`)
        .reply(200, rumBundles[date.join()]);
    }

    const result = await fetchBundles({
      domain,
      domainkey,
      granularity,
      interval,
      checkpoints: ['good'],
    }, console);

    expect(result.length).to.equal(dates.length - 1);
  });

  it('should not filter bot traffic when disabled', async () => {
    const domain = 'some-domain.com';
    const domainkey = 'testkey';
    const granularity = 'HOURLY';
    const interval = 7;
    const allCheckpoints = ['good', 'bad'];

    const dates = generateHourlyDates(7);
    const rumBundles = generateRumBundles(dates, allCheckpoints);
    // make the first bundle a bot traffic
    rumBundles[Object.keys(rumBundles)[0]].rumBundles[0].userAgent = 'bot';

    for (const date of dates) {
      nock(BASE_URL)
        .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}/${date[3]}?domainkey=${domainkey}`)
        .reply(200, rumBundles[date.join()]);
    }

    const result = await fetchBundles({
      domain,
      domainkey,
      granularity,
      interval,
      checkpoints: ['good'],
      filterBotTraffic: false,
    }, console);

    expect(result.length).to.equal(dates.length);
  });

  it('should fetch correct daily bundles and filter by checkpoint', async () => {
    const domain = 'some-domain.com';
    const domainkey = 'testkey';
    const granularity = 'DAILY';
    const interval = 21;
    const allCheckpoints = ['good', 'bad'];

    const dates = generateDailyDates(21);
    const rumBundles = generateRumBundles(dates, allCheckpoints);

    for (const date of dates) {
      nock(BASE_URL)
        .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
        .reply(200, rumBundles[date.join()]);
    }

    const result = await fetchBundles({
      domain,
      domainkey,
      granularity,
      interval,
      checkpoints: ['good'],
    }, console);

    const containsCorrectData = result.every((item) => item.events.length === 1 && item.events[0].checkpoint === 'good');

    expect(result.length).to.equal(dates.length);
    // eslint-disable-next-line no-unused-expressions
    expect(containsCorrectData).to.be.true;
  });

  it('should fetch correct daily bundles and do not filter by checkpoint', async () => {
    const domain = 'some-domain.com';
    const domainkey = 'testkey';
    const granularity = 'DAILY';
    const interval = 21;
    const allCheckpoints = ['good', 'bad'];

    const dates = generateDailyDates(21);
    const rumBundles = generateRumBundles(dates, allCheckpoints);

    for (const date of dates) {
      nock(BASE_URL)
        .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
        .reply(200, rumBundles[date.join()]);
    }

    const result = await fetchBundles({
      domain,
      domainkey,
      granularity,
      interval,
      // no checkpoints param
    }, console);

    const containsCorrectData = result.every((item) => item.events.length === 2);

    expect(result.length).to.equal(dates.length);
    // eslint-disable-next-line no-unused-expressions
    expect(containsCorrectData).to.be.true;
  });

  it('should return failedUrls for failed responses and log them', async () => {
    const domain = 'some-domain.com';
    const domainkey = 'testkey';
    const granularity = 'DAILY';
    const interval = 3;
    const allCheckpoints = ['good', 'bad'];

    const dates = generateDailyDates(interval);
    const rumBundles = generateRumBundles(dates, allCheckpoints);

    // First two succeed, last one fails
    for (let i = 0; i < dates.length; i += 1) {
      const date = dates[i];
      if (i < 2) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      } else {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(500, 'Internal Server Error');
      }
    }

    const log = { warn: sinon.spy(), info: sinon.spy() };
    const opts = {
      domain,
      domainkey,
      granularity,
      interval,
      checkpoints: ['good'],
    };

    const bundles = await fetchBundles(opts, log);

    expect(bundles.length).to.equal(2);
    expect(opts.failedUrls.length).to.equal(2);
    expect(opts.failedUrls[0]).to.include(`/bundles/${domain}/`);
  });
});
