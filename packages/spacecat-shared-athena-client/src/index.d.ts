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

  query(
    sql: string,
    database: string,
    description?: string,
    opts?: AthenaClientOptions,
  ): Promise<Record<string, string>[]>;

  execute(
    sql: string,
    database: string,
    description?: string,
    opts?: AthenaClientOptions,
  ): Promise<string>;
}

export type Context = Parameters<typeof AWSAthenaClient.fromContext>[0];
