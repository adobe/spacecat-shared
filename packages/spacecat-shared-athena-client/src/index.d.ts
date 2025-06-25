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

import { AthenaClient } from '@aws-sdk/client-athena';

export interface AthenaClientOptions {
  backoffMs?: number;
  maxRetries?: number;
  pollIntervalMs?: number;
  maxPollAttempts?: number;
}

export interface Logger {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
  debug: (message: string) => void;
}

export declare class AWSAthenaClient {
  constructor(
    client: AthenaClient,
    tempLocation: string,
    log: Logger,
    opts?: AthenaClientOptions,
  );

  static fromContext(
    context: {
      env?: {
        AWS_REGION?: string;
      };
      log: Logger;
      athenaClient?: AWSAthenaClient;
    },
    tempLocation: string,
    opts?: AthenaClientOptions,
  ): AWSAthenaClient;

  /**
   * Execute an SQL query against AWS Athena and return the results as an array of records.
   * This method handles query execution, polling for completion, and parsing results.
   *
   * @param sql - The SQL query string to execute
   * @param database - The name of the database to query against
   * @param description - Optional description for the query (used for logging and AWS console)
   * @param opts - Optional configuration to override default client options
   * @returns Promise that resolves to an array of records, where each record is a key-value object
   */
  query(
    sql: string,
    database: string,
    description?: string,
    opts?: AthenaClientOptions,
  ): Promise<Record<string, string>[]>;

  /**
   * Execute an SQL statement against AWS Athena and return the execution ID.
   * to know if the query executed successfully without retrieving results.
   *
   * @param sql - The SQL statement to execute
   * @param database - The name of the database to execute the statement against
   * @param description - Optional description for the execution (used for logging and AWS console)
   * @param opts - Optional configuration to override default client options
   * @returns Promise that resolves to the query execution ID
   */
  execute(
    sql: string,
    database: string,
    description?: string,
    opts?: AthenaClientOptions,
  ): Promise<string>;
}

export type Context = Parameters<typeof AWSAthenaClient.fromContext>[0];
