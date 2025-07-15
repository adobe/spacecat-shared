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
import { getTrafficAnalysisQuery, getTrafficAnalysisQueryPlaceholders, AWSAthenaClient } from '../src/index.js';

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

describe('Traffic analysis query loader', () => {
  it('should load and template the traffic analysis query', async () => {
    const placeholders = {
      tableName: 'my_table',
      siteId: 'mysite',
      year: 2024,
      month: 6,
      week: 23,
      dimensionColumns: 'channel, device',
      groupBy: 'channel, device',
      dimensionColumnsPrefixed: 'a.channel, a.device,',
    };
    const sql = await getTrafficAnalysisQuery(placeholders);
    console.log(sql);
    expect(sql).to.be.a('string');
    expect(sql).to.include('FROM my_table');
    expect(sql).to.include("siteid = 'mysite'");
    expect(sql).to.include('year = 2024');
    expect(sql).to.include('month = 6');
    expect(sql).to.include('week = 23');
    expect(sql).to.include('channel, device');
    expect(sql).to.include('a.channel, a.device,');
    // Should not contain any unreplaced {{...}}
    const unreplaced = sql.match(/{{\s*\w+\s*}}/g);
    expect(unreplaced, `Unreplaced placeholders found: ${unreplaced ? unreplaced.join(', ') : ''}`)
      .to.be.null;
  });

  it('should extract all unique placeholders from the query template', async () => {
    const keys = await getTrafficAnalysisQueryPlaceholders();
    expect(keys).to.be.an('array').that.includes('tableName');
    expect(keys).to.include('siteId');
    expect(keys).to.include('year');
    expect(keys).to.include('week');
    expect(keys).to.include('month');
    expect(keys).to.include('dimensionColumns');
    expect(keys).to.include('groupBy');
    expect(keys).to.include('dimensionColumnsPrefixed');
    // Should not include duplicates
    expect(new Set(keys).size).to.equal(keys.length);
  });
});
