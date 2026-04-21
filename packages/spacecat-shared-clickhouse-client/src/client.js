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

export default class ClickhouseClient {
  constructor(config = {}) {
    const {
      url = process.env.CLICKHOUSE_URL,
      username = process.env.CLICKHOUSE_USER,
      password = process.env.CLICKHOUSE_PASSWORD,
      database = process.env.CLICKHOUSE_DB,
    } = config;

    this.client = createClient({
      url,
      username,
      password,
      database,
    });
  }

  async writeBatch(table, rows) {
    if (!rows || rows.length === 0) {
      return;
    }

    await this.client.insert({
      table,
      values: rows,
      format: 'JSONEachRow',
    });
  }

  async query(query, queryParams = {}) {
    const result = await this.client.query({
      query,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    return result.json();
  }

  async close() {
    await this.client.close();
  }
}
