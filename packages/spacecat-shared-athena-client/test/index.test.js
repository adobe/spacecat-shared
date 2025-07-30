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
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { AthenaClient, QueryExecutionState } from '@aws-sdk/client-athena';
import {
  getTrafficAnalysisQuery,
  getTrafficAnalysisQueryPlaceholders,
  buildPageTypeCase,
  getTrafficAnalysisQueryPlaceholdersFilled,
  TrafficDataResponseDto,
  TrafficDataWithCWVDto,
  AWSAthenaClient,
} from '../src/index.js';

use(chaiAsPromised);
use(sinonChai);

describe('AWSAthenaClient', () => {
  let client;
  let athenaClient;
  let log;

  beforeEach(() => {
    client = new AthenaClient({ region: 'us-east-1' });
    log = {
      info: sinon.spy(),
      warn: sinon.spy(),
      error: sinon.spy(),
      debug: sinon.spy(),
    };
    athenaClient = new AWSAthenaClient(client, 's3://temp-location/', log, {
      backoffMs: 10,
      maxRetries: 2,
      pollIntervalMs: 10,
      maxPollAttempts: 2,
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('throws error if tempLocation is not provided', () => {
      expect(() => new AWSAthenaClient(client, '', log)).to.throw('"tempLocation" is required');
    });

    it('creates client with default options', () => {
      const defaultClient = new AWSAthenaClient(client, 's3://temp-location/', log);
      expect(defaultClient.backoffMs).to.equal(100);
      expect(defaultClient.maxRetries).to.equal(3);
      expect(defaultClient.pollIntervalMs).to.equal(1000);
      expect(defaultClient.maxPollAttempts).to.equal(120);
    });
  });

  describe('fromContext', () => {
    it('returns existing client if present in context', () => {
      const existingClient = new AWSAthenaClient(client, 's3://temp-location/', log);
      const context = { athenaClient: existingClient, log };
      const result = AWSAthenaClient.fromContext(context, 's3://temp-location/');
      expect(result).to.equal(existingClient);
    });

    it('creates new client if not present in context', () => {
      const context = { env: { AWS_REGION: 'us-west-2' }, log };
      const result = AWSAthenaClient.fromContext(context, 's3://temp-location/');
      expect(result).to.be.instanceOf(AWSAthenaClient);
    });

    it('uses default region if not provided in context', () => {
      const context = { log };
      const result = AWSAthenaClient.fromContext(context, 's3://temp-location/');
      expect(result).to.be.instanceOf(AWSAthenaClient);
    });
  });

  describe('query', () => {
    it('executes query and returns parsed results', async () => {
      const queryExecutionId = 'test-execution-id';
      const mockResults = {
        ResultSet: {
          ResultSetMetadata: {
            ColumnInfo: [{ Name: 'column1' }, { Name: 'column2' }],
          },
          Rows: [
            { Data: [{ VarCharValue: 'value1' }, { VarCharValue: 'value2' }] },
          ],
        },
      };

      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: { State: QueryExecutionState.SUCCEEDED },
        },
        ...mockResults,
      });

      const results = await athenaClient.query('SELECT * FROM table', 'database');
      expect(results).to.deep.equal([{ column1: 'value1', column2: 'value2' }]);
    });

    it('handles query start failure with retries', async () => {
      const sendStub = sinon.stub(athenaClient.client, 'send');

      // First call fails
      sendStub.onFirstCall().rejects(new Error('Network error'));

      // Second call succeeds with QueryExecutionId
      sendStub.onSecondCall().resolves({
        QueryExecutionId: 'test-id',
      });

      // Third call (GetQueryExecution) succeeds
      sendStub.onThirdCall().resolves({
        QueryExecution: {
          Status: { State: QueryExecutionState.SUCCEEDED },
        },
      });

      // Fourth call (GetQueryResults) succeeds
      sendStub.onCall(3).resolves({
        ResultSet: {
          ResultSetMetadata: {
            ColumnInfo: [{ Name: 'col1' }],
          },
          Rows: [{ Data: [{ VarCharValue: 'val1' }] }],
        },
      });

      const results = await athenaClient.query('SELECT * FROM table', 'database');
      expect(results).to.deep.equal([{ col1: 'val1' }]);
      expect(sendStub.callCount).to.equal(4);
      expect(log.warn.calledWith(sinon.match(/Start attempt 1 failed/))).to.be.true;
    });

    it('handles missing QueryExecutionId', async () => {
      sinon.stub(athenaClient.client, 'send').resolves({});
      await expect(athenaClient.query('SELECT * FROM table', 'database'))
        .to.be.rejectedWith('No QueryExecutionId returned');
    });

    it('handles query failure state', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: {
            State: QueryExecutionState.FAILED,
            StateChangeReason: 'Invalid query syntax',
          },
        },
      });

      await expect(athenaClient.query('SELECT * FROM table', 'database'))
        .to.be.rejectedWith('Invalid query syntax');
    });

    it('handles query cancelled state', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: {
            State: QueryExecutionState.CANCELLED,
          },
        },
      });

      await expect(athenaClient.query('SELECT * FROM table', 'database'))
        .to.be.rejectedWith('Query CANCELLED');
    });

    it('handles polling timeout', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: { State: QueryExecutionState.RUNNING },
        },
      });

      await expect(athenaClient.query('SELECT * FROM table', 'database'))
        .to.be.rejectedWith('[Athena Client] Polling timed out');
    });

    it('handles missing status in poll response', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {},
      });

      await expect(athenaClient.query('SELECT * FROM table', 'database'))
        .to.be.rejectedWith('No status returned');
    });
  });

  describe('execute', () => {
    it('executes DDL query successfully', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: { State: QueryExecutionState.SUCCEEDED },
        },
      });

      const result = await athenaClient.execute('CREATE TABLE test', 'database');
      expect(result).to.equal(queryExecutionId);
    });

    it('handles execution failure', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: {
            State: QueryExecutionState.FAILED,
            StateChangeReason: 'Table already exists',
          },
        },
      });

      await expect(athenaClient.execute('CREATE TABLE test', 'database'))
        .to.be.rejectedWith('Table already exists');
    });
  });

  describe('parseAthenaResults', () => {
    it('handles empty result set', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: { State: QueryExecutionState.SUCCEEDED },
        },
        ResultSet: { Rows: [] },
      });

      const results = await athenaClient.query('SELECT * FROM empty_table', 'database');
      expect(results).to.deep.equal([]);
    });

    it('handles results without ResultSetMetadata', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: { State: QueryExecutionState.SUCCEEDED },
        },
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'header1' }, { VarCharValue: 'header2' }] },
            { Data: [{ VarCharValue: 'value1' }, { VarCharValue: 'value2' }] },
          ],
        },
      });

      const results = await athenaClient.query('SELECT * FROM table', 'database');
      expect(results).to.deep.equal([{ header1: 'value1', header2: 'value2' }]);
    });

    it('handles case-insensitive header matching', async () => {
      const queryExecutionId = 'test-execution-id';
      sinon.stub(athenaClient.client, 'send').resolves({
        QueryExecutionId: queryExecutionId,
        QueryExecution: {
          Status: { State: QueryExecutionState.SUCCEEDED },
        },
        ResultSet: {
          ResultSetMetadata: {
            ColumnInfo: [{ Name: 'COLUMN1' }, { Name: 'Column2' }],
          },
          Rows: [
            { Data: [{ VarCharValue: 'column1' }, { VarCharValue: 'column2' }] },
            { Data: [{ VarCharValue: 'value1' }, { VarCharValue: 'value2' }] },
          ],
        },
      });

      const results = await athenaClient.query('SELECT * FROM table', 'database');
      expect(results).to.deep.equal([{ COLUMN1: 'value1', Column2: 'value2' }]);
    });
  });
});

describe('Traffic analysis query functions', () => {
  describe('getTrafficAnalysisQuery', () => {
    it('should load and template the traffic analysis query', () => {
      const placeholders = {
        tableName: 'my_table',
        siteId: 'mysite',
        pageTypeCase: 'NULL as page_type',
        temporalCondition: `(year=${2024} AND month=${6} AND week=${23})`,
        dimensionColumns: 'channel, device',
        groupBy: 'channel, device',
        dimensionColumnsPrefixed: 'a.channel, a.device',
        trfTypeConfition: 'trf_type IN (`paid`)',
      };
      const sql = getTrafficAnalysisQuery(placeholders);
      // Should not contain any unreplaced {{...}}
      const unreplaced = sql.match(/{{\s*\w+\s*}}/g);
      expect(unreplaced, `Unreplaced placeholders found: ${unreplaced ? unreplaced.join(', ') : ''}`)
        .to.be.null;
      expect(sql, 'unexpected double ,,').to.not.match(/,,/g); // catch double commas
      expect(sql, 'unexpected trailing comma').to.not.match(/,\s*\)/g); // catch trailing comma before closing paren
      expect(sql).to.include('FROM my_table');
      expect(sql).to.include("siteid = 'mysite'");
      expect(sql).to.include('year=2024');
      expect(sql).to.include('month=6');
      expect(sql).to.include('week=23');
      expect(sql).to.include('channel, device');
      expect(sql).to.include('a.channel, a.device,');
    });

    it('should handle empty placeholders', () => {
      const sql = getTrafficAnalysisQuery();
      expect(sql).to.be.a('string');
      expect(sql.length).to.be.greaterThan(0);
    });
  });

  describe('getTrafficAnalysisQueryPlaceholders', () => {
    it('should return all unique placeholders from the query template', () => {
      const keys = getTrafficAnalysisQueryPlaceholders();
      expect(keys).to.be.an('array').that.includes('tableName');
      expect(keys).to.include('siteId');
      expect(keys).to.include('temporalCondition');
      expect(keys).to.include('pageTypeCase');
      expect(keys).to.include('dimensionColumns');
      expect(keys).to.include('groupBy');
      expect(keys).to.include('dimensionColumnsPrefixed');
      // Should not include duplicates
      expect(new Set(keys).size).to.equal(keys.length);
      // Should be sorted
      expect(keys).to.deep.equal([...keys].sort());
    });
  });

  describe('buildPageTypeCase', () => {
    it('should build SQL CASE statement for page types', () => {
      const pageTypes = [
        { name: 'Home Page', pattern: '^/$' },
        { name: 'Product Pages', pattern: '/products/' },
        { name: "What's New", pattern: '/whats-new' },
      ];
      const column = 'path';

      const result = buildPageTypeCase(pageTypes, column);

      expect(result).to.include('CASE');
      expect(result).to.include('END AS page_type');
      expect(result).to.include("WHEN REGEXP_LIKE(path, '^/$') THEN 'Home Page'");
      expect(result).to.include("WHEN REGEXP_LIKE(path, '/products/') THEN 'Product Pages'");
      expect(result).to.include("WHEN REGEXP_LIKE(path, '/whats-new') THEN 'What''s New'");
      expect(result).to.include("ELSE 'other | Other Pages'");
    });

    it('should handle page types with single quotes correctly', () => {
      const pageTypes = [
        { name: "Men's Clothing", pattern: '/mens-clothing' },
        { name: "Women's Shoes", pattern: '/womens-shoes' },
      ];
      const column = 'url_path';

      const result = buildPageTypeCase(pageTypes, column);

      expect(result).to.include("THEN 'Men''s Clothing'");
      expect(result).to.include("THEN 'Women''s Shoes'");
      expect(result).to.include('REGEXP_LIKE(url_path,');
    });

    it('should return null for empty pageTypes array', () => {
      const result = buildPageTypeCase([], 'path');
      expect(result).to.be.null;
    });

    it('should return null for null pageTypes', () => {
      const result = buildPageTypeCase(null, 'path');
      expect(result).to.be.null;
    });

    it('should return null for undefined pageTypes', () => {
      const result = buildPageTypeCase(undefined, 'path');
      expect(result).to.be.null;
    });

    it('should handle single page type', () => {
      const pageTypes = [
        { name: 'Homepage', pattern: '^/$' },
      ];
      const column = 'page_path';

      const result = buildPageTypeCase(pageTypes, column);

      expect(result).to.include('CASE');
      expect(result).to.include("WHEN REGEXP_LIKE(page_path, '^/$') THEN 'Homepage'");
      expect(result).to.include("ELSE 'other | Other Pages'");
      expect(result).to.include('END AS page_type');
    });
  });

  describe('getTrafficAnalysisQueryPlaceholdersFilled', () => {
    it('should generate complete placeholder values for valid input (2 dimensions - even)', () => {
      const params = {
        week: 23,
        year: 2024,
        siteId: 'test-site-id',
        dimensions: ['utm_campaign', 'device'],
        tableName: 'traffic_data',
        trfTypes: ['paid'],
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result).to.have.property('siteId', 'test-site-id');
      expect(result).to.have.property('tableName', 'traffic_data');
      expect(result).to.have.property('dimensionColumns', 'utm_campaign, device');
      expect(result).to.have.property('dimensionColumnsPrefixed', 'a.utm_campaign, a.device');
      expect(result).to.have.property('groupBy', 'utm_campaign, device');
      expect(result).to.have.property('temporalCondition');
      expect(result).to.have.property('pageTypeCase', 'NULL as page_type');
      expect(result).to.have.property('trfTypeCondition', 'trf_type IN (\'paid\')');

      // Check temporal condition format
      expect(result.temporalCondition).to.match(/\(year=\d+ AND month=\d+ AND week=23\)/);

      // Test full SQL generation for comma validation
      const sql = getTrafficAnalysisQuery(result);
      console.log(sql);

      // Verify no dangling commas (even number of dimensions)
      expect(sql, 'unexpected double commas').to.not.match(/,,/g);
      expect(sql, 'unexpected trailing comma before closing paren').to.not.match(/,\s*\)/g);
      expect(sql, 'unexpected trailing comma before FROM').to.not.match(/,\s*FROM/gi);

      // Verify proper comma separation in dimensions
      expect(sql).to.include('utm_campaign, device');
      expect(sql).to.include('a.utm_campaign, a.device');
      expect(sql).to.include('AND trf_type IN (\'paid\')');
    });

    it('should handle page types when page_type dimension is included (2 dimensions - even)', () => {
      const pageTypes = [
        { name: 'Home', pattern: '^/$' },
        { name: 'Products', pattern: '/products/' },
      ];

      const params = {
        week: 23,
        year: 2024,
        siteId: 'test-site-id',
        dimensions: ['page_type', 'device'],
        tableName: 'traffic_data',
        pageTypes,
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.pageTypeCase).to.include('CASE');
      expect(result.pageTypeCase).to.include("WHEN REGEXP_LIKE(path, '^/$') THEN 'Home'");
      expect(result.pageTypeCase).to.include("WHEN REGEXP_LIKE(path, '/products/') THEN 'Products'");

      // Test full SQL generation for comma validation
      const sql = getTrafficAnalysisQuery(result);

      // Verify no dangling commas (even number of dimensions)
      expect(sql, 'unexpected double commas').to.not.match(/,,/g);
      expect(sql, 'unexpected trailing comma before closing paren').to.not.match(/,\s*\)/g);
      expect(sql, 'unexpected trailing comma before FROM').to.not.match(/,\s*FROM/gi);

      // Verify proper comma separation in dimensions
      expect(sql).to.include('page_type, device');
      expect(sql).to.include('a.page_type, a.device');
    });

    it('should use custom pageTypeMatchColumn', () => {
      const pageTypes = [
        { name: 'Home', pattern: '^/$' },
      ];

      const params = {
        week: 23,
        year: 2024,
        siteId: 'test-site-id',
        dimensions: ['page_type', 'device'],
        tableName: 'traffic_data',
        pageTypes,
        pageTypeMatchColumn: 'url_path',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.pageTypeCase).to.include('REGEXP_LIKE(url_path,');
    });

    it('should throw error for missing week', () => {
      const params = {
        year: 2024,
        siteId: 'test-site-id',
        dimensions: ['device'],
        tableName: 'traffic_data',
      };

      expect(() => getTrafficAnalysisQueryPlaceholdersFilled(params))
        .to.throw('Missing required parameters: week, year, siteId, or tableName');
    });

    it('should throw error for missing year', () => {
      const params = {
        week: 23,
        siteId: 'test-site-id',
        dimensions: ['device'],
        tableName: 'traffic_data',
      };

      expect(() => getTrafficAnalysisQueryPlaceholdersFilled(params))
        .to.throw('Missing required parameters: week, year, siteId, or tableName');
    });

    it('should throw error for missing siteId', () => {
      const params = {
        week: 23,
        year: 2024,
        dimensions: ['device'],
        tableName: 'traffic_data',
      };

      expect(() => getTrafficAnalysisQueryPlaceholdersFilled(params))
        .to.throw('Missing required parameters: week, year, siteId, or tableName');
    });

    it('should throw error for missing tableName', () => {
      const params = {
        week: 23,
        year: 2024,
        siteId: 'test-site-id',
        dimensions: ['device'],
      };

      expect(() => getTrafficAnalysisQueryPlaceholdersFilled(params))
        .to.throw('Missing required parameters: week, year, siteId, or tableName');
    });

    it('should throw error for empty dimensions array', () => {
      const params = {
        week: 23,
        year: 2024,
        siteId: 'test-site-id',
        dimensions: [],
        tableName: 'traffic_data',
      };

      expect(() => getTrafficAnalysisQueryPlaceholdersFilled(params))
        .to.throw('Missing dimension to group by');
    });

    it('should throw error for non-array dimensions', () => {
      const params = {
        week: 23,
        year: 2024,
        siteId: 'test-site-id',
        dimensions: 'device',
        tableName: 'traffic_data',
      };

      expect(() => getTrafficAnalysisQueryPlaceholdersFilled(params))
        .to.throw('Missing dimension to group by');
    });

    it('should throw error for null dimensions', () => {
      const params = {
        week: 23,
        year: 2024,
        siteId: 'test-site-id',
        dimensions: null,
        tableName: 'traffic_data',
      };

      expect(() => getTrafficAnalysisQueryPlaceholdersFilled(params))
        .to.throw('Missing dimension to group by');
    });

    it('should handle multiple dimensions correctly (4 dimensions - even)', () => {
      const params = {
        week: 1,
        year: 2025,
        siteId: 'multi-dim-site',
        dimensions: ['trf_channel', 'utm_campaign', 'device', 'page_type'],
        tableName: 'multi_dim_table',
        pageTypes: [{ name: 'Test', pattern: '/test' }],
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.dimensionColumns).to.equal('trf_channel, utm_campaign, device, page_type');
      expect(result.dimensionColumnsPrefixed).to.equal('a.trf_channel, a.utm_campaign, a.device, a.page_type');
      expect(result.groupBy).to.equal('trf_channel, utm_campaign, device, page_type');
      expect(result.pageTypeCase).to.include('CASE');

      // Test full SQL generation for comma validation
      const sql = getTrafficAnalysisQuery(result);

      // Verify no dangling commas (even number of dimensions - 4)
      expect(sql, 'unexpected double commas').to.not.match(/,,/g);
      expect(sql, 'unexpected trailing comma before closing paren').to.not.match(/,\s*\)/g);
      expect(sql, 'unexpected trailing comma before FROM').to.not.match(/,\s*FROM/gi);

      // Verify proper comma separation in dimensions
      expect(sql).to.include('trf_channel, utm_campaign, device, page_type');
      expect(sql).to.include('a.trf_channel, a.utm_campaign, a.device, a.page_type');
    });

    it('should handle triple dimensions correctly (3 dimensions - odd)', () => {
      const params = {
        week: 30,
        year: 2024,
        siteId: 'triple-dim-site',
        dimensions: ['trf_channel', 'utm_campaign', 'device'],
        tableName: 'triple_dim_table',
        trfTypes: ['earned', 'owned', 'paid'],
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.dimensionColumns).to.equal('trf_channel, utm_campaign, device');
      expect(result.dimensionColumnsPrefixed).to.equal('a.trf_channel, a.utm_campaign, a.device');
      expect(result.groupBy).to.equal('trf_channel, utm_campaign, device');
      expect(result.pageTypeCase).to.equal('NULL as page_type');

      // Test full SQL generation for comma validation
      const sql = getTrafficAnalysisQuery(result);

      // Verify no dangling commas (odd number of dimensions - 3)
      expect(sql, 'unexpected double commas').to.not.match(/,,/g);
      expect(sql, 'unexpected trailing comma before closing paren').to.not.match(/,\s*\)/g);
      expect(sql, 'unexpected trailing comma before FROM').to.not.match(/,\s*FROM/gi);
      expect(sql).to.not.match(/undefined/);

      // Verify proper comma separation in dimensions
      expect(sql).to.include('trf_channel, utm_campaign, device');
      expect(sql).to.include('a.trf_channel, a.utm_campaign, a.device');
      expect(sql).to.include('AND trf_type IN (\'earned\', \'owned\', \'paid\')');
    });

    it('should handle cross-month year correctly', () => {
      const params = {
        week: 53, // Week 53 often spans into the next year
        year: 2024,
        siteId: 'cross-month-site',
        dimensions: ['device'],
        tableName: 'cross_month_table',
      };

      const result = getTrafficAnalysisQueryPlaceholdersFilled(params);

      expect(result.temporalCondition).to.include('week=53');

      // Week 53 might span December 2024 and January 2025
      const conditions = result.temporalCondition.split(' OR ');

      // Each condition should follow the pattern (year=X AND month=Y AND week=53)
      conditions.forEach((condition) => {
        expect(condition.trim()).to.match(/^\(year=\d+ AND month=\d+ AND week=53\)$/);
      });
    });
  });

  describe('Integration: Full Query Generation', () => {
    it('should generate complete SQL with no dangling placeholders or commas', () => {
      const pageTypes = [
        { name: 'Home Page', pattern: '^/$' },
        { name: 'Product Pages', pattern: '/products/' },
        { name: "What's New", pattern: '/whats-new' },
      ];

      const params = {
        week: 23,
        year: 2024,
        siteId: 'test-site-123',
        dimensions: ['page_type', 'trf_channel', 'device'],
        tableName: 'rum_bundles_2024',
        pageTypes,
        pageTypeMatchColumn: 'path',
      };

      const placeholders = getTrafficAnalysisQueryPlaceholdersFilled(params);
      const sql = getTrafficAnalysisQuery(placeholders);

      // Verify no unreplaced placeholders
      const unreplaced = sql.match(/{{\s*\w+\s*}}/g);
      expect(unreplaced, `Unreplaced placeholders found: ${unreplaced ? unreplaced.join(', ') : ''}`)
        .to.be.null;

      // Verify no dangling commas
      expect(sql, 'unexpected double commas').to.not.match(/,,/g);
      expect(sql, 'unexpected trailing comma before closing paren').to.not.match(/,\s*\)/g);
      expect(sql, 'unexpected trailing comma before FROM').to.not.match(/,\s*FROM/gi);
      expect(sql).to.not.match(/undefined/);

      // Verify SQL structure is reasonable
      expect(sql).to.include('WITH raw AS');
      expect(sql).to.include('agg AS');
      expect(sql).to.include('grand_total AS');
      expect(sql).to.include('FROM rum_bundles_2024');
      expect(sql).to.include("siteid = 'test-site-123'");

      // Verify page type CASE statement is included
      expect(sql).to.include('CASE');
      expect(sql).to.include("WHEN REGEXP_LIKE(path, '^/$') THEN 'Home Page'");
      expect(sql).to.include("WHEN REGEXP_LIKE(path, '/products/') THEN 'Product Pages'");
      expect(sql).to.include("WHEN REGEXP_LIKE(path, '/whats-new') THEN 'What''s New'");
      expect(sql).to.include("ELSE 'other | Other Pages'");

      // Verify dimensions are properly included
      expect(sql).to.include('page_type, trf_channel, device');
      expect(sql).to.include('a.page_type, a.trf_channel, a.device');

      // Verify temporal condition
      expect(sql).to.include('week=23');
      expect(sql).to.include('year=');
      expect(sql).to.include('month=');

      // verify if trf_type not passed we dont filter
      expect(sql).to.include('AND TRUE');
    });

    it('should generate SQL without page types when not in dimensions (2 dimensions - even)', () => {
      const params = {
        week: 15,
        year: 2024,
        siteId: 'simple-site',
        dimensions: ['trf_channel', 'device'],
        tableName: 'simple_table',
      };

      const placeholders = getTrafficAnalysisQueryPlaceholdersFilled(params);
      const sql = getTrafficAnalysisQuery(placeholders);

      expect(sql).to.include('NULL as page_type');
      expect(sql).to.include('trf_channel, device');
      expect(sql).to.include('a.trf_channel, a.device');

      // Verify no dangling commas (even number of dimensions)
      expect(sql, 'unexpected double commas').to.not.match(/,,/g);
      expect(sql, 'unexpected trailing comma before closing paren').to.not.match(/,\s*\)/g);
      expect(sql, 'unexpected trailing comma before FROM').to.not.match(/,\s*FROM/gi);
    });

    it('should handle single dimension correctly (1 dimension - odd)', () => {
      const params = {
        week: 1,
        year: 2025,
        siteId: 'single-dim-site',
        dimensions: ['device'],
        tableName: 'single_dim_table',
      };

      const placeholders = getTrafficAnalysisQueryPlaceholdersFilled(params);
      const sql = getTrafficAnalysisQuery(placeholders);

      const unreplaced = sql.match(/{{\s*\w+\s*}}/g);
      expect(unreplaced).to.be.null;

      // Verify no dangling commas (single dimension - odd)
      expect(sql, 'unexpected double commas').to.not.match(/,,/g);
      expect(sql, 'unexpected trailing comma before closing paren').to.not.match(/,\s*\)/g);
      expect(sql, 'unexpected trailing comma before FROM').to.not.match(/,\s*FROM/gi);

      expect(sql).to.include('device');
      expect(sql).to.include('a.device');
    });
  });
});

describe('DTO Tests', () => {
  describe('TrafficDataResponseDto', () => {
    it('should convert traffic data to JSON format', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        trf_platform: 'google',
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: 'none',
        referrer: 'google.com',
        pageviews: 1000,
        pct_pageviews: 0.25,
        click_rate: 0.15,
        engagement_rate: 0.8,
        bounce_rate: 0.2,
        engaged_scroll: 0.6,
        p70_scroll: 0.75,
      };

      const result = TrafficDataResponseDto.toJSON(inputData);

      expect(result).to.deep.equal({
        type: 'organic',
        channel: 'search',
        platform: 'google',
        utm_source: 'google',
        utm_medium: 'organic',
        campaign: 'none',
        referrer: 'google.com',
        pageviews: 1000,
        pct_pageviews: 0.25,
        click_rate: 0.15,
        engagement_rate: 0.8,
        bounce_rate: 0.2,
        engaged_scroll: 0.6,
        p70_scroll: 0.75,
      });
    });
  });

  describe('TrafficDataWithCWVDto', () => {
    it('should convert traffic data with CWV scores using default thresholds', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        utm_platform: 'google',
        utm_source: 'google',
        utm_medium: 'organic',
        utm_campaign: 'none',
        referrer: 'google.com',
        pageviews: 1000,
        pct_pageviews: 0.25,
        click_rate: 0.15,
        engagement_rate: 0.8,
        bounce_rate: 0.2,
        engaged_scroll: 0.6,
        p70_scroll: 0.75,
        path: '/home',
        page_type: 'Home Page',
        device: 'desktop',
        p70_lcp: '2000',
        p70_cls: '0.05',
        p70_inp: '150',
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {});

      expect(result.lcp_score).to.equal('good');
      expect(result.cls_score).to.equal('good');
      expect(result.inp_score).to.equal('good');
      expect(result.overall_cwv_score).to.equal('good');
      expect(result.p70_lcp).to.equal(2000);
      expect(result.p70_cls).to.equal(0.05);
      expect(result.p70_inp).to.equal(150);
      expect(result.path).to.equal('/home');
      expect(result.page_type).to.equal('Home Page');
      expect(result.device).to.equal('desktop');
    });

    it('should handle needs improvement CWV scores', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        p70_lcp: '3500', // needs improvement
        p70_cls: '0.15', // needs improvement
        p70_inp: '300', // needs improvement
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {});

      expect(result.lcp_score).to.equal('needs improvement');
      expect(result.cls_score).to.equal('needs improvement');
      expect(result.inp_score).to.equal('needs improvement');
      expect(result.overall_cwv_score).to.equal('needs improvement');
    });

    it('should handle poor CWV scores', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        p70_lcp: '5000', // poor
        p70_cls: '0.35', // poor
        p70_inp: '600', // poor
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {});

      expect(result.lcp_score).to.equal('poor');
      expect(result.cls_score).to.equal('poor');
      expect(result.inp_score).to.equal('poor');
      expect(result.overall_cwv_score).to.equal('poor');
    });

    it('should handle mixed CWV scores (overall = poor if any poor)', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        p70_lcp: '2000', // good
        p70_cls: '0.05', // good
        p70_inp: '600', // poor
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {});

      expect(result.lcp_score).to.equal('good');
      expect(result.cls_score).to.equal('good');
      expect(result.inp_score).to.equal('poor');
      expect(result.overall_cwv_score).to.equal('poor');
    });

    it('should handle mixed CWV scores (overall = needs improvement if no poor)', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        p70_lcp: '2000', // good
        p70_cls: '0.15', // needs improvement
        p70_inp: '150', // good
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {});

      expect(result.lcp_score).to.equal('good');
      expect(result.cls_score).to.equal('needs improvement');
      expect(result.inp_score).to.equal('good');
      expect(result.overall_cwv_score).to.equal('needs improvement');
    });

    it('should use custom thresholds when provided', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        p70_lcp: '3000',
        p70_cls: '0.15',
        p70_inp: '250',
      };

      const customThresholds = {
        LCP_GOOD: 3500,
        LCP_NEEDS_IMPROVEMENT: 5000,
        CLS_GOOD: 0.2,
        CLS_NEEDS_IMPROVEMENT: 0.3,
        INP_GOOD: 300,
        INP_NEEDS_IMPROVEMENT: 600,
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, customThresholds);

      expect(result.lcp_score).to.equal('good');
      expect(result.cls_score).to.equal('good');
      expect(result.inp_score).to.equal('good');
      expect(result.overall_cwv_score).to.equal('good');
    });

    it('should generate URL when baseUrl and path are provided', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        path: '/products/shoes',
        p70_lcp: '2000',
        p70_cls: '0.05',
        p70_inp: '150',
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {}, 'https://example.com');

      expect(result.url).to.equal('https://example.com/products/shoes');
      expect(result.path).to.equal('/products/shoes');
    });

    it('should handle baseUrl with trailing slash', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        path: '/products/shoes',
        p70_lcp: '2000',
        p70_cls: '0.05',
        p70_inp: '150',
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {}, 'https://example.com/');

      expect(result.url).to.equal('https://example.com/products/shoes');
    });

    it('should handle path with leading slash when baseUrl has trailing slash', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        path: '/products/shoes',
        p70_lcp: '2000',
        p70_cls: '0.05',
        p70_inp: '150',
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {}, 'https://example.com/');

      expect(result.url).to.equal('https://example.com/products/shoes');
    });

    it('should use existing url if provided', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        url: 'https://custom.com/page',
        path: '/products/shoes',
        p70_lcp: '2000',
        p70_cls: '0.05',
        p70_inp: '150',
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {}, 'https://example.com');

      expect(result.url).to.equal('https://custom.com/page');
    });

    it('should handle undefined url when no baseUrl provided', () => {
      const inputData = {
        trf_type: 'organic',
        trf_channel: 'search',
        pageviews: 1000,
        path: '/products/shoes',
        p70_lcp: '2000',
        p70_cls: '0.05',
        p70_inp: '150',
      };

      const result = TrafficDataWithCWVDto.toJSON(inputData, {});

      expect(result.url).to.be.undefined;
    });
  });
});
