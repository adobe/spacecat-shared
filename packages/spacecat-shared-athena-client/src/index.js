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

import {
  AthenaClient,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  QueryExecutionState,
  paginateGetQueryResults,
} from '@aws-sdk/client-athena';
import { instrumentAWSClient, hasText } from '@adobe/spacecat-shared-utils';

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export class AWSAthenaClient {
  /**
   * @param {import('@aws-sdk/client-athena').AthenaClient} client
   * @param {string} tempLocation   – S3 URI for Athena temp results
   * @param {{ info: Function, warn: Function, error: Function, debug: Function }} log
   * @param {object} opts
   * @param {number} [opts.backoffMs=100]
   * @param {number} [opts.maxRetries=3]
   * @param {number} [opts.pollIntervalMs=1000]
   * @param {number} [opts.maxPollAttempts=120]
   */
  constructor(client, tempLocation, log, opts = {}) {
    const {
      backoffMs = 100,
      maxRetries = 3,
      pollIntervalMs = 1000,
      maxPollAttempts = 120,
    } = opts;

    if (!hasText(tempLocation)) {
      throw new Error('"tempLocation" is required');
    }

    this.client = instrumentAWSClient(client);
    this.log = log;
    this.tempLocation = tempLocation;
    this.backoffMs = backoffMs;
    this.maxRetries = maxRetries;
    this.pollIntervalMs = pollIntervalMs;
    this.maxPollAttempts = maxPollAttempts;
  }

  /**
   * @param {object} context   – must contain `env.AWS_REGION` and `log`
   * @param {string} tempLocation   – S3 URI for Athena temp results
   * @param {object} opts      – same opts as constructor
   * @returns {AWSAthenaClient}
   */
  static fromContext(context, tempLocation, opts = {}) {
    if (context.athenaClient) return context.athenaClient;

    const { env = {}, log } = context;
    const region = env.AWS_REGION || 'us-east-1';
    const rawClient = new AthenaClient({ region });
    return new AWSAthenaClient(rawClient, tempLocation, log, opts);
  }

  /**
   * @private
   * Start the query, with retries on StartQueryExecution errors
   * @returns {Promise<string>} – QueryExecutionId
   */
  async #startQueryWithRetry(sql, database, description, backoffMs, maxRetries) {
    let lastError = new Error('No attempts were made');
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const { QueryExecutionId } = await this.client.send(
          new StartQueryExecutionCommand({
            QueryString: sql,
            QueryExecutionContext: { Database: database },
            ResultConfiguration: { OutputLocation: this.tempLocation },
          }),
        );
        if (!QueryExecutionId) {
          throw new Error('No QueryExecutionId returned');
        }
        this.log.debug(`[Athena Client] QueryExecutionId=${QueryExecutionId}`);
        return QueryExecutionId;
      } catch (err) {
        lastError = err;
        this.log.warn(`[Athena Client] Start attempt ${attempt} failed: ${err.message}`);
        if (attempt < maxRetries) {
          const waitMs = 2 ** attempt * backoffMs;
          this.log.debug(`[Athena Client] Retrying start in ${waitMs}ms`);
          // eslint-disable-next-line no-await-in-loop
          await sleep(waitMs);
        } else {
          this.log.error(`[Athena Client] All ${maxRetries} start attempts failed: ${lastError.message}`);
        }
      }
    }
    throw lastError;
  }

  /**
   * @private
   * Poll the given query until it finishes or fails
   */
  async #pollToCompletion(queryExecutionId, description, pollIntervalMs, maxPollAttempts) {
    for (let i = 0; i < maxPollAttempts; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(pollIntervalMs);
      // eslint-disable-next-line no-await-in-loop
      const { QueryExecution } = await this.client.send(
        new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId }),
      );
      const status = QueryExecution?.Status;
      if (!status) {
        throw new Error('No status returned');
      }

      const { State, StateChangeReason } = status;
      this.log.debug(`State=${State}`);

      if (State === QueryExecutionState.SUCCEEDED) {
        return;
      }
      if (State === QueryExecutionState.FAILED || State === QueryExecutionState.CANCELLED) {
        throw new Error(StateChangeReason || `Query ${State}`);
      }
    }
    throw new Error('[Athena Client] Polling timed out');
  }

  /**
   * @private
   * Parse Athena results into usable format
   */
  static #parseAthenaResults(results) {
    if (!results.ResultSet || !results.ResultSet.Rows || results.ResultSet.Rows.length === 0) {
      return [];
    }

    const rows = results.ResultSet.Rows;
    let headers;
    let dataStartIndex = 0;

    if (results.ResultSet.ResultSetMetadata && results.ResultSet.ResultSetMetadata.ColumnInfo) {
      headers = results.ResultSet.ResultSetMetadata.ColumnInfo.map((col) => col.Name);

      const firstRowValues = rows[0].Data.map((col) => col.VarCharValue);
      const isFirstRowHeaders = firstRowValues.every(
        (value, index) => value === headers[index]
                    || (value && value.toLowerCase() === headers[index].toLowerCase()),
      );

      if (isFirstRowHeaders) {
        dataStartIndex = 1;
      } else {
        dataStartIndex = 0;
      }
    } else {
      headers = rows[0].Data.map((col) => col.VarCharValue);
      dataStartIndex = 1;
    }

    return rows.slice(dataStartIndex).map((row) => {
      const record = {};
      row.Data.forEach((col, index) => {
        record[headers[index]] = col.VarCharValue;
      });
      return record;
    });
  }

  /**
   * Execute a query without returning results (for DDL operations)
   */
  async execute(sql, database, description = 'Athena query', opts = {}) {
    const {
      backoffMs = this.backoffMs,
      maxRetries = this.maxRetries,
      pollIntervalMs = this.pollIntervalMs,
      maxPollAttempts = this.maxPollAttempts,
    } = opts;

    this.log.debug(`[Athena Client] Executing: ${description}`);

    const queryExecutionId = await this.#startQueryWithRetry(
      sql,
      database,
      description,
      backoffMs,
      maxRetries,
    );

    await this.#pollToCompletion(queryExecutionId, description, pollIntervalMs, maxPollAttempts);

    return queryExecutionId;
  }

  /**
   * Execute an Athena SQL query and return parsed results.
   * @param {string} sql - sql query to run
   * @param {string} database - database to run against
   * @param {string} [description='Athena query'] – human-readable for logs
   * @param {object} [opts]
   * @param {number} [opts.backoffMs]
   * @param {number} [opts.maxRetries]
   * @param {number} [opts.pollIntervalMs]
   * @param {number} [opts.maxPollAttempts]
   * @returns {Promise<Array>} – Parsed query results
   */
  async query(sql, database, description = 'Athena query', opts = {}) {
    const queryExecutionId = await this.execute(sql, database, description, opts);

    this.log.debug(`[Athena Client] Fetching paginated results for QueryExecutionId=${queryExecutionId}`);

    const paginationConfig = {
      client: this.client,
    };

    const input = {
      QueryExecutionId: queryExecutionId,
    };

    const paginator = paginateGetQueryResults(paginationConfig, input);

    const allResults = [];
    let pageCount = 0;
    let totalRows = 0;

    /* c8 ignore start */
    for await (const page of paginator) {
      pageCount += 1;
      const pageRows = page.ResultSet?.Rows?.length || 0;
      totalRows += pageRows;

      this.log.debug(`[Athena Client] Processing page ${pageCount} with ${pageRows} rows`);

      const pageResults = AWSAthenaClient.#parseAthenaResults(page);
      allResults.push(...pageResults);
    }
    /* c8 ignore stop */

    this.log.debug(`[Athena Client] Fetched ${totalRows} total rows across ${pageCount} pages`);
    return allResults;
  }
}

export {
  getTrafficAnalysisQuery,
  getTrafficAnalysisQueryPlaceholders,
  buildPageTypeCase,
  getTrafficAnalysisQueryPlaceholdersFilled,
  getTop3PagesWithTrafficLostTemplate,
} from './traffic-analysis/queries.js';
export { TrafficDataResponseDto } from './traffic-analysis/traffic-data-base-response.js';
export { TrafficDataWithCWVDto } from './traffic-analysis/traffic-data-with-cwv.js';

export {
  getPreviousPeriod,
  getPTASummaryQuery,
  getPTASummaryWithTrendQuery,
  PTASummaryResponseDto,
  PTASummaryWithTrendResponseDto,
} from './pta2/queries.js';
