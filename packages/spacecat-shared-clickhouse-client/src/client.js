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

import { createClient } from '@clickhouse/client';
import { VALIDATORS } from './validators.js';

export default class ClickhouseClient {
  constructor(config = {}, log = console) {
    const {
      url = process.env.CLICKHOUSE_URL,
      username = process.env.CLICKHOUSE_USER,
      password = process.env.CLICKHOUSE_PASSWORD,
      database = process.env.CLICKHOUSE_DB,
    } = config;

    this.log = log;
    this.client = createClient({
      url,
      username,
      password,
      database,
    });
  }

  async writeBatch(table, rows) {
    if (!rows || rows.length === 0) {
      return { written: 0, failures: [] };
    }

    const validator = VALIDATORS[table];
    let validRows = rows;
    const failures = [];

    if (validator) {
      validRows = [];
      for (let i = 0; i < rows.length; i += 1) {
        const errors = validator(rows[i]);
        if (errors.length > 0) {
          for (const err of errors) {
            failures.push({ index: i, ...err });
          }
        } else {
          validRows.push(rows[i]);
        }
      }
    }

    if (validRows.length > 0) {
      try {
        await this.client.insert({
          table,
          values: validRows,
          format: 'JSONEachRow',
        });
      } catch (err) {
        this.log.error(`[clickhouse-client] writeBatch failed on table ${table}: ${err.message}`);
        throw new Error(`ClickHouse write failed: ${err.message}`);
      }
    }

    return { written: validRows.length, failures };
  }

  async query(query, queryParams = {}) {
    try {
      const result = await this.client.query({
        query,
        query_params: queryParams,
        format: 'JSONEachRow',
      });

      return result.json();
    } catch (err) {
      this.log.error(`[clickhouse-client] query failed: ${err.message}`);
      throw new Error(`ClickHouse query failed: ${err.message}`);
    }
  }

  async close() {
    await this.client.close();
  }
}
