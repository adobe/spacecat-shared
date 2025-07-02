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

/* eslint-disable import/no-extraneous-dependencies */
import sinon from 'sinon';
import { expect } from 'chai';
/* eslint-enable import/no-extraneous-dependencies */

export const createMockContext = (overrides = {}) => ({
  log: {
    info: sinon.spy(),
    warn: sinon.spy(),
    error: sinon.spy(),
    debug: sinon.spy(),
  },
  env: {
    AWS_REGION: 'us-east-1',
  },
  ...overrides,
});

export const createMockSite = (baseURL = 'https://example.com', cdnLogsConfig = { bucketName: 'test-bucket' }) => ({
  getBaseURL: () => baseURL,
  getConfig: () => ({
    getCdnLogsConfig: () => cdnLogsConfig,
    getGroupedURLs: () => [
      { name: 'home', pattern: '^/$' },
      { name: 'product', pattern: '/products/.+' },
    ],
  }),
});

export const createMockAthenaClient = (queryResults = []) => ({
  query: sinon.stub().resolves(queryResults),
});

export const createMockS3Config = (overrides = {}) => ({
  bucket: 'test-bucket',
  customerName: 'test',
  customerDomain: 'test_com',
  databaseName: 'test_db',
  tableName: 'test_table',
  aggregatedLocation: 's3://test-bucket/aggregated/',
  getAthenaTempLocation: () => 's3://test-bucket/temp/athena-results/',
  ...overrides,
});

export const createMockPeriods = (numberOfWeeks = 2) => {
  const weeks = Array.from({ length: numberOfWeeks }, (_, i) => ({
    startDate: new Date(`2025-01-${(i * 7) + 1}`),
    endDate: new Date(`2025-01-${(i * 7) + 7}`),
    weekLabel: `Week ${i + 1}`,
    weekNumber: i + 1,
    dateRange: {
      start: `2025-01-${String((i * 7) + 1).padStart(2, '0')}`,
      end: `2025-01-${String((i * 7) + 7).padStart(2, '0')}`,
    },
  }));

  return {
    weeks,
    columns: weeks.map((w) => w.weekLabel),
  };
};

export const createServiceMocks = async () => {
  const mockAthenaClient = createMockAthenaClient();
  const mockLoadSql = sinon.stub().resolves('SELECT * FROM test_table WHERE 1=1');
  const mockS3Config = createMockS3Config();

  return {
    mockAthenaClient,
    mockLoadSql,
    mockS3Config,
    mocks: {
      '@adobe/spacecat-shared-athena-client': {
        AWSAthenaClient: {
          fromContext: sinon.stub().returns(mockAthenaClient),
        },
      },
      '../src/utils.js': {
        loadSql: mockLoadSql,
        getS3Config: () => mockS3Config,
        buildSiteFilters: (filters) => (filters?.length ? '(mock_filter)' : ''),
      },
    },
  };
};

export const expectValidQuery = (query) => {
  expect(query).to.be.a('string');
  expect(query.length).to.be.greaterThan(10);
  expect(query.toUpperCase()).to.include('SELECT');
};

export const expectQueryContainsElements = (query, elements) => {
  elements.forEach((element) => {
    expect(query).to.include(element);
  });
};
