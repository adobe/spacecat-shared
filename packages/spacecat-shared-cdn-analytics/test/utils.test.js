/*
 * Copyright 2025 Adobe. All rights reserved.
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

import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';
import * as utils from '../src/utils.js';
import { COUNTRY_PATTERNS } from '../src/constants.js';
import { createMockSite } from './test-helpers.js';

function extractCC(url) {
  for (const { regex } of COUNTRY_PATTERNS) {
    const pattern = new RegExp(regex, 'i');
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1].toLowerCase();
    }
  }
  return null;
}

const {
  extractCustomerDomain,
  getAnalysisBucket,
  getS3Config,
  formatDateString,
  getWeekRange,
  createDateRange,
  generatePeriodIdentifier,
  generateReportingPeriods,
  validateCountryCode,
  buildSiteFilters,
} = utils;

describe('CDN Analytics Utils', () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Domain and Bucket Operations', () => {
    const domainTestCases = [
      { input: 'https://test.example-site.com', expected: 'test_example_site_com' },
      { input: 'https://sub-domain.multi-word-site.example-test.co.uk', expected: 'sub_domain_multi_word_site_example_test_co_uk' },
    ];

    const bucketTestCases = [
      { input: 'test.example.com', expected: 'cdn-logs-test-example-com' },
      { input: 'Test.Example.COM', expected: 'cdn-logs-Test-Example-COM' },
    ];

    it('should extract and sanitize customer domains', () => {
      domainTestCases.forEach(({ input, expected }) => {
        expect(extractCustomerDomain(createMockSite(input))).to.equal(expected);
      });
    });

    it('should generate analysis bucket names', () => {
      bucketTestCases.forEach(({ input, expected }) => {
        expect(getAnalysisBucket(input)).to.equal(expected);
      });
    });
  });

  describe('S3 Configuration', () => {
    const s3ConfigTestCases = [
      {
        name: 'should handle custom bucket config',
        site: createMockSite('https://test.com', { bucketName: 'custom-bucket' }),
        expected: { bucket: 'custom-bucket', customerName: 'test', customerDomain: 'test_com' },
      },
      {
        name: 'should handle null config fallback',
        site: createMockSite('https://empty.com', null),
        expected: { bucket: 'cdn-logs-empty-com', customerName: 'empty', customerDomain: 'empty_com' },
      },
      {
        name: 'should handle empty object config',
        site: createMockSite('https://empty.com', {}),
        expected: { bucket: 'cdn-logs-empty-com', customerName: 'empty', customerDomain: 'empty_com' },
      },
      {
        name: 'should use provided bucket name when specified',
        site: createMockSite('https://test.com', { bucketName: 'my-special-bucket' }),
        expected: { bucket: 'my-special-bucket', customerName: 'test', customerDomain: 'test_com' },
      },
      {
        name: 'should fallback when bucket name is empty string',
        site: createMockSite('https://test.com', { bucketName: '' }),
        expected: { bucket: 'cdn-logs-test-com', customerName: 'test', customerDomain: 'test_com' },
      },
    ];

    s3ConfigTestCases.forEach(({ name, site, expected }) => {
      it(name, () => {
        const config = getS3Config(site);
        expect(config.bucket).to.equal(expected.bucket);
        expect(config.customerName).to.equal(expected.customerName);
        expect(config.customerDomain).to.equal(expected.customerDomain);
      });
    });

    it('should generate correct temp location', () => {
      const config = getS3Config(createMockSite('https://test.example.com', null));
      expect(config.getAthenaTempLocation()).to.equal('s3://cdn-logs-test-example-com/temp/athena-results/');
    });
  });

  describe('Date and Time Operations', () => {
    it('should format dates correctly', () => {
      const dateTests = [
        { input: new Date('2024-01-15T10:30:00Z'), expected: '2024-01-15' },
        { input: new Date('2024-02-29T00:00:00Z'), expected: '2024-02-29' },
      ];

      dateTests.forEach(({ input, expected }) => {
        expect(formatDateString(input)).to.equal(expected);
      });
    });

    it('should generate valid week ranges', () => {
      const testDates = [new Date('2024-01-15T10:00:00Z'), new Date('2024-01-07T10:00:00Z')];

      testDates.forEach((date) => {
        const { weekStart, weekEnd } = getWeekRange(0, date);
        expect(weekStart.getUTCDay()).to.equal(1); // Monday
        expect(weekEnd.getUTCDay()).to.equal(0); // Sunday
        expect(weekStart.getUTCHours()).to.equal(0);
        expect(weekEnd.getUTCHours()).to.equal(23);
      });
    });

    it('should create and validate date ranges', () => {
      const { startDate, endDate } = createDateRange('2025-01-01', '2025-01-07');
      expect(startDate.getUTCHours()).to.equal(0);
      expect(endDate.getUTCHours()).to.equal(23);

      expect(() => createDateRange('invalid', '2025-01-07')).to.throw('Invalid date format provided');
      expect(() => createDateRange('2025-01-07', '2025-01-01')).to.throw('Start date must be before end date');
    });

    it('should generate period identifiers', () => {
      const weekStart = new Date('2025-01-08T00:00:00Z');
      const weekEnd = new Date('2025-01-14T23:59:59Z');
      expect(generatePeriodIdentifier(weekStart, weekEnd)).to.match(/^w\d{2}-\d{4}$/);

      const start = new Date('2025-01-01');
      const end = new Date('2025-01-05');
      expect(generatePeriodIdentifier(start, end)).to.equal('2025-01-01_to_2025-01-05');
    });

    it('should generate reporting periods for various dates', () => {
      const testDates = [
        new Date('2025-01-15T10:00:00Z'),
        new Date('2025-01-01'),
        new Date('2025-12-31'),
        new Date('2024-02-29'), // leap year test
        new Date('2025-01-07T10:00:00Z'),
      ];

      testDates.forEach((date) => {
        const periods = generateReportingPeriods(date);
        expect(periods.weeks).to.be.an('array').with.lengthOf(1);
        expect(periods.columns).to.be.an('array');
        expect(periods.referenceDate).to.be.a('string');
        expect(periods.weeks[0].weekNumber).to.be.a('number').greaterThan(0).lessThan(54);
      });
    });
  });

  describe('Validation and Filtering', () => {
    it('should validate basic country codes', () => {
      const countryTests = [
        { input: 'US', expected: 'US' },
        { input: 'us', expected: 'US' },
        { input: 'FR', expected: 'FR' },
        { input: 'GLOBAL', expected: 'GLOBAL' },
      ];

      countryTests.forEach(({ input, expected }) => {
        expect(validateCountryCode(input)).to.equal(expected);
      });

      const invalidInputs = ['', null, undefined, 'INVALID', '   '];
      invalidInputs.forEach((input) => {
        expect(validateCountryCode(input)).to.equal('GLOBAL');
      });
    });

    it('should validate country codes from URL paths', () => {
      const urlTestCases = [
        { url: 'genuine/ooc-dm-twp-row-cx6-nc.html', expected: 'GLOBAL' },
        { url: 'th_th/genuine/ooc-dm-ses-cx6-nc.html', expected: 'TH' },
        { url: '/', expected: 'GLOBAL' },
        { url: 'in/creativecloud.html', expected: 'IN' },
        { url: 'kr/genuine/ooc-dm-ses-cx6-nc.html', expected: 'KR' },
        { url: 'id_id/genuine/ooc-dm-ses-cx6-nc.html', expected: 'ID' },
        { url: '/uk/', expected: 'UK' },
        { url: '/se/', expected: 'SE' },
        { url: '/fr/search', expected: 'FR' },
        { url: '/en-us/', expected: 'US' },
        { url: '/en-gb/', expected: 'GB' },
      ];

      urlTestCases.forEach(({ url, expected }) => {
        expect(validateCountryCode(extractCC(url))).to.equal(expected);
      });
    });

    it('should build site filters', () => {
      const filterTestCases = [
        { input: [], expected: '' },
        { input: null, expected: '' },
        {
          input: [{ key: 'domain', value: ['example.com'] }],
          expected: "(REGEXP_LIKE(domain, '(?i)(example.com)'))",
        },
        {
          input: [{ key: 'domain', value: ['example.com', 'test.com'], type: 'include' }],
          expected: "(REGEXP_LIKE(domain, '(?i)(example.com|test.com)'))",
        },
        {
          input: [{ key: 'domain', value: ['example.com', 'test.com'], type: 'exclude' }],
          expected: "(NOT REGEXP_LIKE(domain, '(?i)(example.com|test.com)'))",
        },
      ];

      filterTestCases.forEach(({ input, expected }) => {
        expect(buildSiteFilters(input)).to.equal(expected);
      });

      const complexFilters = [
        { key: 'domain', value: ['example.com', 'test.com'], type: 'exclude' },
        { key: 'status', value: ['200'], type: 'include' },
      ];
      expect(buildSiteFilters(complexFilters))
        .to.equal("(NOT REGEXP_LIKE(domain, '(?i)(example.com|test.com)') AND REGEXP_LIKE(status, '(?i)(200)'))");
    });
  });

  describe('Database Operations', () => {
    it('should load SQL successfully (dev)', async () => {
      const reportUtils = await esmock('../src/utils.js', {
        '@adobe/spacecat-shared-utils': {
          getStaticContent: sandbox.stub().resolves('CREATE TABLE test_table...'),
        },
      });
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const result = await reportUtils.loadSql('test-query', { table: 'test_table' });
      expect(result).to.equal('CREATE TABLE test_table...');
      process.env.NODE_ENV = oldEnv;
    });

    it('should load SQL successfully (prod)', async () => {
      const reportUtils = await esmock('../src/utils.js', {
        '@adobe/spacecat-shared-utils': {
          getStaticContent: sandbox.stub().resolves('CREATE TABLE test_table...'),
        },
      });
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'PROD';
      const oldCwd = process.cwd;
      process.cwd = () => '/mock/cwd';
      const result = await reportUtils.loadSql('test-query', { table: 'test_table' });
      expect(result).to.equal('CREATE TABLE test_table...');
      process.env.NODE_ENV = oldEnv;
      process.cwd = oldCwd;
    });

    it('should handle SQL loading errors', async () => {
      const errorReportUtils = await esmock('../src/utils.js', {
        '@adobe/spacecat-shared-utils': {
          getStaticContent: sandbox.stub().rejects(new Error('SQL load failed')),
        },
      });
      try {
        await errorReportUtils.loadSql('test-query', { table: 'test_table' });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.equal('SQL load failed');
      }
    });

    it('should load SQL with custom subdirectory', async () => {
      const reportUtils = await esmock('../src/utils.js', {
        '@adobe/spacecat-shared-utils': {
          getStaticContent: sandbox.stub().resolves('SELECT * FROM custom_table'),
        },
      });
      const oldEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const result = await reportUtils.loadSql('custom-query', { table: 'custom_table' }, 'custom-dir');
      expect(result).to.equal('SELECT * FROM custom_table');
      process.env.NODE_ENV = oldEnv;
    });
  });
});
