/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { DynamoDB } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommandInput } from '@aws-sdk/lib-dynamodb';

export declare interface Logger {
  error(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
}

export declare interface DynamoDbKey {
  partitionKey: string;
  sortKey?: string;
}

export declare interface DynamoDbClient {
  query(originalParams: QueryCommandInput): Promise<object[]>;
  getItem(tableName: string, key: DynamoDbKey): Promise<object>;
  putItem(tableName: string, item: object): Promise<{ message: string }>;
  removeItem(tableName: string, key: DynamoDbKey): Promise<{ message: string }>;
}

export function createClient(logger: Logger, dbClient?: DynamoDB, docClient?: DynamoDBDocumentClient): DynamoDbClient;
