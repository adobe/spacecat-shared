/*
 * Copyright 2024 Adobe. All rights reserved.
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
import { DynamoDBDocument } from '@aws-sdk/lib-dynamodb';
import { S3Client } from '@aws-sdk/client-s3';
import { Service } from 'electrodb';

import { instrumentAWSClient } from '@adobe/spacecat-shared-utils';
import { EntityRegistry } from '../models/index.js';
import { registerLogger } from '../util/logger-registry.js';

export * from '../errors/index.js';
export * from '../models/index.js';
export * from '../util/index.js';

let defaultDynamoDBClient;
const documentClientCache = new WeakMap();

const createRawClient = (client = undefined) => {
  const rawClient = client || (() => {
    if (!defaultDynamoDBClient) {
      defaultDynamoDBClient = new DynamoDB();
    }
    return defaultDynamoDBClient;
  })();

  let documentClient = documentClientCache.get(rawClient);
  if (!documentClient) {
    documentClient = DynamoDBDocument.from(instrumentAWSClient(rawClient), {
      marshallOptions: {
        convertEmptyValues: true,
        removeUndefinedValues: true,
      },
    });
    documentClientCache.set(rawClient, documentClient);
  }

  return documentClient;
};

const createElectroService = (client, config, log) => {
  const { tableNameData: table } = config;
  /* c8 ignore start */
  const logger = (event) => {
    log.debug(JSON.stringify(event, null, 4));
  };
  /* c8 ignore end */

  return new Service(
    EntityRegistry.getEntities(),
    {
      client,
      table,
      logger,
    },
  );
};

/**
 * Creates an S3 client if bucket configuration is provided.
 *
 * @param {object} config - Configuration object
 * @param {string} [config.s3Bucket] - S3 bucket name
 * @param {string} [config.region] - AWS region
 * @returns {{s3Client: S3Client, s3Bucket: string}|null} - S3 client and bucket or null
 */
const createS3Client = (config) => {
  const { s3Bucket, region } = config;

  if (!s3Bucket) {
    return null;
  }

  const options = region ? { region } : {};
  const s3Client = instrumentAWSClient(new S3Client(options));

  return { s3Client, s3Bucket };
};

/**
 * Creates a data access layer for interacting with DynamoDB using ElectroDB.
 *
 * @param {{tableNameData: string, s3Bucket?: string, region?: string}} config - Configuration
 *   object containing table name and optional S3 configuration
 * @param {object} log - Logger instance, defaults to console
 * @param {DynamoDB} [client] - Optional custom DynamoDB client instance
 * @returns {object} Data access collections for interacting with entities
 */
export const createDataAccess = (config, log = console, client = undefined) => {
  registerLogger(log);

  const rawClient = createRawClient(client);
  const electroService = createElectroService(rawClient, config, log);
  const s3Config = createS3Client(config);
  const entityRegistry = new EntityRegistry(electroService, log, s3Config);

  return entityRegistry.getCollections();
};
