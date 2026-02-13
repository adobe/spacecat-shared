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

import { S3Client } from '@aws-sdk/client-s3';
import { PostgrestClient } from '@supabase/postgrest-js';

import { instrumentAWSClient } from '@adobe/spacecat-shared-utils';
import { EntityRegistry } from '../models/index.js';
import { registerLogger } from '../util/logger-registry.js';

export * from '../errors/index.js';
export * from '../models/index.js';
export * from '../util/index.js';

const createPostgrestService = (config, client = undefined) => {
  if (client) {
    return client;
  }

  const {
    postgrestUrl,
    postgrestSchema = 'public',
    postgrestApiKey,
    postgrestHeaders = {},
  } = config;

  if (!postgrestUrl) {
    throw new Error('postgrestUrl is required to create data access');
  }

  const headers = {
    ...postgrestHeaders,
    ...postgrestApiKey ? { apikey: postgrestApiKey, Authorization: `Bearer ${postgrestApiKey}` } : {},
  };

  return new PostgrestClient(postgrestUrl, {
    schema: postgrestSchema,
    headers,
  });
};

/**
 * Creates an S3 service configuration if bucket configuration is provided.
 *
 * @param {object} config - Configuration object
 * @param {string} [config.s3Bucket] - S3 bucket name
 * @param {string} [config.region] - AWS region
 * @returns {{s3Client: S3Client, s3Bucket: string}|null} - S3 client and bucket or null
 */
const createS3Service = (config) => {
  const { s3Bucket, region } = config;

  if (!s3Bucket) {
    return null;
  }

  const options = region ? { region } : {};
  const s3Client = instrumentAWSClient(new S3Client(options));

  return { s3Client, s3Bucket };
};

/**
 * Creates a services dictionary containing all datastore services.
 * Each collection can declare which service it needs via its DATASTORE_TYPE.
 *
 * @param {PostgrestClient} postgrestService - PostgREST client
 * @param {object} config - Configuration object
 * @returns {object} Services dictionary with postgrest and s3 services
 */
const createServices = (postgrestService, config) => ({
  postgrest: postgrestService,
  s3: createS3Service(config),
});

/**
 * Creates a data access layer for interacting with Postgres via PostgREST.
 *
 * @param {{postgrestUrl: string, postgrestSchema?: string, postgrestApiKey?: string,
 * postgrestHeaders?: object, s3Bucket?: string, region?: string}} config - Configuration object
 * @param {object} log - Logger instance, defaults to console
 * @param {PostgrestClient} [client] - Optional custom Postgrest client instance
 * @returns {object} Data access collections for interacting with entities
 */
export const createDataAccess = (config, log = console, client = undefined) => {
  registerLogger(log);

  const postgrestService = createPostgrestService(config, client);
  const services = createServices(postgrestService, config);
  const entityRegistry = new EntityRegistry(services, log);

  return entityRegistry.getCollections();
};
