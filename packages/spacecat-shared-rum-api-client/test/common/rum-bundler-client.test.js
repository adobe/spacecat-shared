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

  // Start and End Date Tests
  describe('startTime and endTime functionality', () => {
    it('should fetch bundles for specific date range with daily granularity', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-03T23:59:59Z';
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      // Expected dates: 2024-01-01, 2024-01-02, 2024-01-03
      const expectedDates = [
        ['2024', '01', '01'],
        ['2024', '01', '02'],
        ['2024', '01', '03'],
      ];

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      for (const date of expectedDates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(expectedDates.length);
      const containsCorrectData = result.every((item) => item.events.length === 1 && item.events[0].checkpoint === 'good');
      // eslint-disable-next-line no-unused-expressions
      expect(containsCorrectData).to.be.true;
    });

    it('should fetch bundles for specific date range with hourly granularity', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-01T02:59:59Z';
      const granularity = 'HOURLY';
      const allCheckpoints = ['good', 'bad'];

      // Expected dates: 2024-01-01 00:00, 2024-01-01 01:00, 2024-01-01 02:00
      const expectedDates = [
        ['2024', '01', '01', '00'],
        ['2024', '01', '01', '01'],
        ['2024', '01', '01', '02'],
      ];

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      for (const date of expectedDates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}/${date[3]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(expectedDates.length);
      const containsCorrectData = result.every((item) => item.events.length === 1 && item.events[0].checkpoint === 'good');
      // eslint-disable-next-line no-unused-expressions
      expect(containsCorrectData).to.be.true;
    });

    it('should handle single day range correctly', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-15T00:00:00Z';
      const endTime = '2024-01-15T23:59:59Z';
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      // Expected date: 2024-01-15
      const expectedDates = [['2024', '01', '15']];
      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      // Use .join() to match the key
      nock(BASE_URL)
        .get(`/bundles/${domain}/2024/01/15?domainkey=${domainkey}`)
        .reply(200, rumBundles[expectedDates[0].join()]);

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(1);
      expect(result[0].events[0].checkpoint).to.equal('good');
    });

    it('should handle single hour range correctly', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-15T10:00:00Z';
      const endTime = '2024-01-15T10:59:59Z';
      const granularity = 'HOURLY';
      const allCheckpoints = ['good', 'bad'];

      // Expected date: 2024-01-15 10:00
      const expectedDates = [['2024', '01', '15', '10']];

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      nock(BASE_URL)
        .get(`/bundles/${domain}/2024/01/15/10?domainkey=${domainkey}`)
        .reply(200, rumBundles[expectedDates[0].join()]);

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(1);
      expect(result[0].events[0].checkpoint).to.equal('good');
    });

    it('should prioritize startTime/endTime over interval when both are provided', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-02T23:59:59Z';
      const interval = 30; // This should be ignored
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      // Expected dates: 2024-01-01, 2024-01-02 (not 30 days)
      const expectedDates = [
        ['2024', '01', '01'],
        ['2024', '01', '02'],
      ];

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      for (const date of expectedDates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        interval, // This should be ignored
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(2); // Only 2 days, not 30
    });

    it('should fall back to interval-based logic when startTime/endTime are not provided', async () => {
      const domain = 'some-domain.com';
      const domainkey = 'testkey';
      const granularity = 'DAILY';
      const interval = 3;
      const allCheckpoints = ['good', 'bad'];

      const dates = generateDailyDates(3);
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
        // No startTime/endTime provided
      }, console);

      expect(result.length).to.equal(dates.length);
    });
  });

  describe('startTime and endTime validation', () => {
    it('should throw error when startTime is after endTime', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-07T00:00:00Z';
      const endTime = '2024-01-01T00:00:00Z';

      await expect(fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
      }, console)).to.be.rejectedWith('startTime must be before endTime');
    });

    it('should throw error when startTime equals endTime', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-01T00:00:00Z';

      await expect(fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
      }, console)).to.be.rejectedWith('startTime must be before endTime');
    });

    it('should throw error when startTime has invalid format', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = 'invalid-date';
      const endTime = '2024-01-07T00:00:00Z';

      await expect(fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
      }, console)).to.be.rejectedWith('Invalid startTime or endTime format. Use ISO 8601 format (e.g., "2024-01-01T00:00:00Z")');
    });

    it('should throw error when endTime has invalid format', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = 'invalid-date';

      await expect(fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
      }, console)).to.be.rejectedWith('Invalid startTime or endTime format. Use ISO 8601 format (e.g., "2024-01-01T00:00:00Z")');
    });

    it('should accept valid ISO 8601 date formats', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-01T00:00:00.000Z';
      const endTime = '2024-01-02T23:59:59.999Z';
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      const expectedDates = [
        ['2024', '01', '01'],
        ['2024', '01', '02'],
      ];

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      for (const date of expectedDates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(expectedDates.length);
    });

    it('should handle partial startTime/endTime (only one provided)', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-01T00:00:00Z';
      // No endTime provided

      // Should fall back to interval-based logic
      const interval = 7;
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      const dates = generateDailyDates(7);
      const rumBundles = generateRumBundles(dates, allCheckpoints);

      for (const date of dates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime, // Only startTime provided
        granularity,
        interval,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(dates.length);
    });
  });

  describe('startTime and endTime with different scenarios', () => {
    it('should handle cross-month date ranges', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-30T00:00:00Z';
      const endTime = '2024-02-02T23:59:59Z';
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      // Expected dates: 2024-01-30, 2024-01-31, 2024-02-01, 2024-02-02
      const expectedDates = [
        ['2024', '01', '30'],
        ['2024', '01', '31'],
        ['2024', '02', '01'],
        ['2024', '02', '02'],
      ];

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      for (const date of expectedDates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(expectedDates.length);
    });

    it('should handle cross-year date ranges', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2023-12-30T00:00:00Z';
      const endTime = '2024-01-02T23:59:59Z';
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      // Expected dates: 2023-12-30, 2023-12-31, 2024-01-01, 2024-01-02
      const expectedDates = [
        ['2023', '12', '30'],
        ['2023', '12', '31'],
        ['2024', '01', '01'],
        ['2024', '01', '02'],
      ];

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      for (const date of expectedDates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(expectedDates.length);
    });

    it('should handle leap year dates correctly', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-02-28T00:00:00Z';
      const endTime = '2024-03-01T23:59:59Z';
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      // Expected dates: 2024-02-28, 2024-02-29 (leap day), 2024-03-01
      const expectedDates = [
        ['2024', '02', '28'],
        ['2024', '02', '29'],
        ['2024', '03', '01'],
      ];

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      for (const date of expectedDates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(expectedDates.length);
    });

    it('should handle large date ranges efficiently', async () => {
      const domain = 'test-domain.com';
      const domainkey = 'testkey';
      const startTime = '2024-01-01T00:00:00Z';
      const endTime = '2024-01-31T23:59:59Z';
      const granularity = 'DAILY';
      const allCheckpoints = ['good', 'bad'];

      // Generate 31 dates for January
      const expectedDates = [];
      for (let day = 1; day <= 31; day += 1) {
        expectedDates.push(['2024', '01', day.toString().padStart(2, '0')]);
      }

      const rumBundles = generateRumBundles(expectedDates, allCheckpoints);

      for (const date of expectedDates) {
        nock(BASE_URL)
          .get(`/bundles/${domain}/${date[0]}/${date[1]}/${date[2]}?domainkey=${domainkey}`)
          .reply(200, rumBundles[date.join()]);
      }

      const result = await fetchBundles({
        domain,
        domainkey,
        startTime,
        endTime,
        granularity,
        checkpoints: ['good'],
      }, console);

      expect(result.length).to.equal(31);
    });
  });
});
