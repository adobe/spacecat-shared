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

import { expect } from 'chai';
import ClickhouseClient from '../../src/index.js';
import { IT_CH_CONFIG, executeSql } from './setup.js';

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

describe('ClickhouseClient — integration', () => {
  let client;

  beforeEach(async () => {
    client = new ClickhouseClient(IT_CH_CONFIG);
    await executeSql('TRUNCATE TABLE brand_presence_executions');
    await executeSql('TRUNCATE TABLE brand_presence_competitor_data');
  });

  afterEach(async () => {
    await client.close();
  });

  describe('writeBatch() — brand_presence_executions', () => {
    it('S-01: inserts a valid object with all required fields and confirms it is stored', async () => {
      const result = await client.writeBatch('brand_presence_executions', [VALID_EXECUTION]);
      const rows = await client.query('SELECT site_id, platform, region FROM brand_presence_executions');

      expect(result.written).to.equal(1);
      expect(result.failures).to.deep.equal([]);
      expect(rows).to.have.length(1);
      expect(rows[0].site_id).to.equal('94d151ff-09d2-4462-9703-4956e635425f');
      expect(rows[0].platform).to.equal('google-ai-overviews');
      expect(rows[0].region).to.equal('gb');
    });

    it('S-02: rejects a row with missing site_id and writes nothing to ClickHouse', async () => {
      const row = { ...VALID_EXECUTION };
      delete row.site_id;

      const result = await client.writeBatch('brand_presence_executions', [row]);
      const [{ amount }] = await client.query('SELECT count() AS amount FROM brand_presence_executions');

      expect(result.written).to.equal(0);
      expect(result.failures.some((f) => f.field === 'site_id')).to.be.true;
      expect(Number(amount)).to.equal(0);
    });

    it('S-03: rejects a row with missing execution_date and writes nothing to ClickHouse', async () => {
      const row = { ...VALID_EXECUTION };
      delete row.execution_date;

      const result = await client.writeBatch('brand_presence_executions', [row]);
      const [{ amount }] = await client.query('SELECT count() AS amount FROM brand_presence_executions');

      expect(result.written).to.equal(0);
      expect(result.failures.some((f) => f.field === 'execution_date')).to.be.true;
      expect(Number(amount)).to.equal(0);
    });

    it('S-04: rejects a row with missing platform and writes nothing to ClickHouse', async () => {
      const row = { ...VALID_EXECUTION };
      delete row.platform;

      const result = await client.writeBatch('brand_presence_executions', [row]);
      const [{ amount }] = await client.query('SELECT count() AS amount FROM brand_presence_executions');

      expect(result.written).to.equal(0);
      expect(result.failures.some((f) => f.field === 'platform')).to.be.true;
      expect(Number(amount)).to.equal(0);
    });

    it('S-05: rejects a row with visibility_score below 0 and writes nothing to ClickHouse', async () => {
      const result = await client.writeBatch('brand_presence_executions', [
        { ...VALID_EXECUTION, visibility_score: -1.0 },
      ]);
      const [{ amount }] = await client.query('SELECT count() AS amount FROM brand_presence_executions');

      expect(result.written).to.equal(0);
      expect(result.failures.some((f) => f.field === 'visibility_score')).to.be.true;
      expect(Number(amount)).to.equal(0);
    });

    it('S-06: inserts a row without optional fields volume, business_competitors, organic_competitors', async () => {
      const row = { ...VALID_EXECUTION };
      delete row.volume;
      delete row.business_competitors;
      delete row.organic_competitors;

      const result = await client.writeBatch('brand_presence_executions', [row]);

      expect(result.written).to.equal(1);
      expect(result.failures).to.deep.equal([]);
    });

    it('S-07: inserts a batch of multiple valid rows and confirms all are stored', async () => {
      const rows = [
        VALID_EXECUTION,
        { ...VALID_EXECUTION, site_id: 'site-it-002', region: 'us' },
        { ...VALID_EXECUTION, site_id: 'site-it-003', region: 'de' },
      ];

      const result = await client.writeBatch('brand_presence_executions', rows);
      const stored = await client.query(
        'SELECT site_id FROM brand_presence_executions ORDER BY site_id',
      );

      expect(result.written).to.equal(3);
      expect(result.failures).to.deep.equal([]);
      expect(stored).to.have.length(3);
      expect(stored.map((row) => row.site_id)).to.deep.equal([
        '94d151ff-09d2-4462-9703-4956e635425f',
        'site-it-002',
        'site-it-003',
      ]);
    });

    it('writes only valid rows and reports failures for invalid rows in the same batch', async () => {
      const invalidRow = { site_id: '94d151ff-09d2-4462-9703-4956e635425f' };
      const rows = [VALID_EXECUTION, invalidRow];

      const result = await client.writeBatch('brand_presence_executions', rows);
      const stored = await client.query('SELECT site_id FROM brand_presence_executions');

      expect(result.written).to.equal(1);
      expect(result.failures.length).to.be.greaterThan(0);
      expect(result.failures[0].index).to.equal(1);
      expect(stored).to.have.length(1);
      expect(stored[0].site_id).to.equal('94d151ff-09d2-4462-9703-4956e635425f');
    });
  });

  describe('writeBatch() — brand_presence_competitor_data', () => {
    const VALID_COMPETITOR = {
      site_id: '94d151ff-09d2-4462-9703-4956e635425f',
      platform: 'google-ai-overviews',
      week: '2025-W47',
      category: 'Dining Room',
      competitor: 'IKEA',
      region: 'gb',
    };

    it('inserts a valid competitor row and confirms it is stored', async () => {
      const result = await client.writeBatch('brand_presence_competitor_data', [VALID_COMPETITOR]);
      const rows = await client.query('SELECT site_id, competitor, region FROM brand_presence_competitor_data');

      expect(result.written).to.equal(1);
      expect(result.failures).to.deep.equal([]);
      expect(rows).to.have.length(1);
      expect(rows[0].site_id).to.equal('94d151ff-09d2-4462-9703-4956e635425f');
      expect(rows[0].competitor).to.equal('IKEA');
      expect(rows[0].region).to.equal('gb');
    });

    it('rejects a competitor row with a missing required field and writes nothing to ClickHouse', async () => {
      const row = { ...VALID_COMPETITOR };
      delete row.competitor;

      const result = await client.writeBatch('brand_presence_competitor_data', [row]);
      const [{ amount }] = await client.query('SELECT count() AS amount FROM brand_presence_competitor_data');

      expect(result.written).to.equal(0);
      expect(result.failures.some((f) => f.field === 'competitor')).to.be.true;
      expect(Number(amount)).to.equal(0);
    });

    it('inserts a batch of multiple competitor rows and confirms all are stored', async () => {
      const rows = [
        VALID_COMPETITOR,
        { ...VALID_COMPETITOR, competitor: 'John Lewis' },
        { ...VALID_COMPETITOR, competitor: 'Wayfair' },
      ];

      const result = await client.writeBatch('brand_presence_competitor_data', rows);
      const stored = await client.query(
        'SELECT competitor FROM brand_presence_competitor_data ORDER BY competitor',
      );

      expect(result.written).to.equal(3);
      expect(result.failures).to.deep.equal([]);
      expect(stored).to.have.length(3);
      expect(stored.map((row) => row.competitor)).to.deep.equal(['IKEA', 'John Lewis', 'Wayfair']);
    });
  });
});
