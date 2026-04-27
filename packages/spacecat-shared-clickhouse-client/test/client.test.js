/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

// Claude Code, Model: Sonnet 4.6 - Prompt: "write unit tests for the clickhouse client,
// follow AAA pattern and coverage should be 80% at least"
import { expect } from 'chai';
import ClickhouseClient from '../src/index.js';

const VALID_EXECUTION = {
  site_id: '94d151ff-09d2-4462-9703-4956e635425f',
  platform: 'google-ai-overviews',
  week: '2025-W47',
  execution_date: '2025-11-23',
  category: 'Dining Room',
  topic: 'oak dining table',
  prompt: 'What size oak dining table do I need for 6 people?',
  region: 'gb',
  answer: 'Oakwood Living solid oak dining tables are available in fixed and extending configurations.',
};

function makeClient() {
  const log = { error: () => {} };
  const client = new ClickhouseClient({}, log);
  client.client = {
    insert: async () => {},
    query: async () => ({ json: async () => [] }),
    close: async () => {},
  };
  return client;
}

describe('ClickhouseClient', () => {
  it('can be instantiated', () => {
    expect(new ClickhouseClient()).to.be.instanceOf(ClickhouseClient);
  });

  describe('writeBatch()', () => {
    it('writes valid rows and returns the written count', async () => {
      const client = makeClient();
      const result = await client.writeBatch('brand_presence_executions', [VALID_EXECUTION]);
      expect(result.written).to.equal(1);
      expect(result.failures).to.deep.equal([]);
    });

    it('skips insert for empty input', async () => {
      const client = makeClient();
      const result = await client.writeBatch('brand_presence_executions', []);
      expect(result.written).to.equal(0);
      expect(result.failures).to.deep.equal([]);
    });

    it('writes valid rows and reports invalid ones', async () => {
      const client = makeClient();
      const invalidRow = { site_id: '94d151ff-09d2-4462-9703-4956e635425f' };
      const result = await client.writeBatch('brand_presence_executions', [VALID_EXECUTION, invalidRow]);
      expect(result.written).to.equal(1);
      expect(result.failures.length).to.be.greaterThan(0);
    });
  });

  describe('query()', () => {
    it('returns parsed JSON results', async () => {
      const client = makeClient();
      const expected = [{ site_id: '94d151ff-09d2-4462-9703-4956e635425f' }];
      client.client.query = async () => ({ json: async () => expected });
      const result = await client.query('SELECT 1');
      expect(result).to.deep.equal(expected);
    });

    it('wraps and rethrows clickhouse query errors', async () => {
      const client = makeClient();
      client.client.query = async () => {
        throw new Error('timeout');
      };
      let caught;
      try {
        await client.query('SELECT 1');
      } catch (err) {
        caught = err;
      }
      expect(caught.message).to.include('ClickHouse query failed');
    });
  });

  describe('close()', () => {
    it('closes the clickhouse connection', async () => {
      const client = makeClient();
      let closeCalled = false;
      client.client.close = async () => {
        closeCalled = true;
      };
      await client.close();
      expect(closeCalled).to.be.true;
    });
  });
});
