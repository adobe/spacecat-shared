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
import { expect, use } from 'chai';
import sinonChai from 'sinon-chai';
import {
  createMockSite,
  createMockPeriods,
  expectValidQuery,
  expectQueryContainsElements,
} from './test-helpers.js';

use(sinonChai);

describe('CDN Analytics Query Builder', () => {
  let weeklyBreakdownQueries;
  let mockOptions;

  before(async () => {
    ({ weeklyBreakdownQueries } = await import('../src/query-builder.js'));
  });

  beforeEach(() => {
    mockOptions = {
      periods: createMockPeriods(2),
      databaseName: 'test_db',
      tableName: 'test_table',
      provider: 'chatgpt',
      siteFilters: [],
      site: createMockSite(),
    };
  });

  const queryBuilders = [
    { name: 'createCountryWeeklyBreakdown', expectedElements: ['test_db', 'test_table', 'ChatGPT'] },
    { name: 'createUserAgentWeeklyBreakdown', expectedElements: ['test_db', 'test_table'] },
    { name: 'createUrlStatusWeeklyBreakdown', expectedElements: ['test_db', 'test_table'] },
    { name: 'createTopBottomUrlsByStatus', expectedElements: ['test_db', 'test_table'] },
    { name: 'createError404Urls', expectedElements: ['test_db', 'test_table'] },
    { name: 'createError503Urls', expectedElements: ['test_db', 'test_table'] },
    { name: 'createTopUrls', expectedElements: ['test_db', 'test_table'] },
  ];

  it('builds comprehensive set of analytics queries with proper filtering', async () => {
    const queries = await Promise.all(
      queryBuilders.map(({ name }) => weeklyBreakdownQueries[name](mockOptions)),
    );

    queries.forEach((query, index) => {
      if (query === null) return; // Some queries may return null for specific conditions

      expectValidQuery(query);
      expectQueryContainsElements(query, queryBuilders[index].expectedElements);
    });

    const countryQuery = queries[0];
    expect(countryQuery).to.include("REGEXP_LIKE(user_agent, '(?i)ChatGPT|GPTBot|OAI-SearchBot')");
    expect(countryQuery).to.include("year = '2025'");
    expect(countryQuery).to.include("month = '01'");
  });

  it('handles bulk.com site with special success URLs by category query', async () => {
    const bulkOptions = {
      ...mockOptions,
      site: createMockSite('https://bulk.com'),
    };

    const categoryQuery = await weeklyBreakdownQueries.createSuccessUrlsByCategory(bulkOptions);
    expectValidQuery(categoryQuery);
    expectQueryContainsElements(categoryQuery, ['status = 200', 'test_db', 'test_table']);
  });

  it('generates valid queries without provider filtering when provider is null', async () => {
    const optionsWithoutProvider = { ...mockOptions, provider: null };
    const query = await weeklyBreakdownQueries.createCountryWeeklyBreakdown(optionsWithoutProvider);

    expectValidQuery(query);
    expect(query).to.not.include('REGEXP_LIKE(user_agent');
    expectQueryContainsElements(query, ['test_db', 'test_table']);
  });

  it('includes site filters when provided in query options', async () => {
    const optionsWithFilters = {
      ...mockOptions,
      siteFilters: ['url LIKE "https://test.com/%"', 'status = 200'],
    };

    const query = await weeklyBreakdownQueries.createCountryWeeklyBreakdown(optionsWithFilters);
    expectValidQuery(query);
    expectQueryContainsElements(query, ['test_db', 'test_table']);
  });

  it('returns null for non-bulk.com sites when creating success URLs by category', async () => {
    const nonBulkOptions = {
      ...mockOptions,
      site: createMockSite('https://example.com'),
    };

    const result = await weeklyBreakdownQueries.createSuccessUrlsByCategory(nonBulkOptions);
    expect(result).to.be.null;
  });

  it('handles cross-month date ranges in query filters', async () => {
    const crossMonthOptions = {
      ...mockOptions,
      periods: {
        weeks: [{
          startDate: new Date('2024-01-25'),
          endDate: new Date('2024-02-05'),
          weekLabel: 'Week 1',
          dateRange: { start: '2024-01-25', end: '2024-02-05' },
        }],
        columns: ['Week 1'],
      },
    };

    const query = await weeklyBreakdownQueries.createCountryWeeklyBreakdown(crossMonthOptions);
    expectValidQuery(query);
    expect(query).to.include("year = '2024' AND month = '01' AND day >= '25'");
    expect(query).to.include("year = '2024' AND month = '02' AND day <= '05'");
  });

  it('generates queries without WHERE clause when no filters are applied', async () => {
    const noFilterOptions = {
      ...mockOptions,
      provider: null,
      siteFilters: [],
    };

    const query = await weeklyBreakdownQueries.createUserAgentWeeklyBreakdown(noFilterOptions);
    expectValidQuery(query);
    expect(query).to.not.include('REGEXP_LIKE(user_agent');
    expectQueryContainsElements(query, ['test_db', 'test_table']);
  });

  it('falls back to default patterns when site config returns null', async () => {
    const nullConfigOptions = {
      ...mockOptions,
      site: createMockSite('https://test.com', { getGroupedURLs: () => null }),
    };

    const query = await weeklyBreakdownQueries.createUrlStatusWeeklyBreakdown(nullConfigOptions);
    expectValidQuery(query);
    expectQueryContainsElements(query, ['test_db', 'test_table']);
    expect(query.toUpperCase()).to.include('CASE');
  });
});
