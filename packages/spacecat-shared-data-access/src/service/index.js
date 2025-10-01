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
import { Service } from 'electrodb';

import { instrumentAWSClient } from '@adobe/spacecat-shared-utils';
import { EntityRegistry } from '../models/index.js';
import { registerLogger } from '../util/logger-registry.js';

export * from '../errors/index.js';
export * from '../models/index.js';
export * from '../util/index.js';

const createRawClient = (client = undefined) => {
  const dbClient = instrumentAWSClient(client || new DynamoDB());
  return DynamoDBDocument.from(dbClient, {
    marshallOptions: {
      convertEmptyValues: true,
      removeUndefinedValues: true,
    },
  });
};

const createElectroService = (client, config) => {
  const { tableNameData: table } = config;

  return new Service(
    EntityRegistry.getEntities(),
    {
      client,
      table,
    },
  );
};

/**
 * Creates a data access layer for interacting with DynamoDB using ElectroDB.
 *
 * @param {{tableNameData: string}} config - Configuration object containing table name
 * @param {object} log - Logger instance, defaults to console
 * @param {DynamoDB} [client] - Optional custom DynamoDB client instance
 * @returns {object} Data access collections for interacting with entities
 */
export const createDataAccess = (config, log = console, client = undefined) => {
  registerLogger(log);

  const rawClient = createRawClient(client);
  const electroService = createElectroService(rawClient, config);
  const entityRegistry = new EntityRegistry(electroService, log);

  return entityRegistry.getCollections();
};
