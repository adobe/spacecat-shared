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

import { PostgrestClient } from '@supabase/postgrest-js';
import { S3Client } from '@aws-sdk/client-s3';
import { instrumentAWSClient } from '@adobe/spacecat-shared-utils';

import PostgresEntityRegistry from './postgres-entity-registry.js';

/**
 * Creates an S3 service configuration if bucket configuration is provided.
 * @param {object} config - Configuration object
 * @returns {{s3Client: S3Client, s3Bucket: string}|null}
 */
const createS3Service = (config) => {
  const { s3Bucket, region } = config;

  if (!s3Bucket) {
    return null;
  }
  /* c8 ignore next 5 -- S3 client creation tested in integration */
  const options = region ? { region } : {};
  const s3Client = instrumentAWSClient(new S3Client(options));

  return { s3Client, s3Bucket };
};

/**
 * Creates a PostgreSQL data access layer backed by PostgREST.
 *
 * @param {object} config - Configuration object
 * @param {string} config.postgrestUrl - PostgREST base URL
 * @param {string} [config.postgrestSchema='public'] - PostgREST schema
 * @param {string} [config.postgrestApiKey] - API key for PostgREST authentication
 * @param {object} [config.postgrestHeaders] - Additional headers
 * @param {string} [config.s3Bucket] - S3 bucket for Configuration entity
 * @param {string} [config.region] - AWS region
 * @param {object} log - Logger instance
 * @returns {object} Data access collections
 */
export const createPostgresDataAccess = (config, log) => {
  const {
    postgrestUrl,
    postgrestSchema = 'public',
    postgrestApiKey,
    postgrestHeaders = {},
    s3Bucket,
    region,
  } = config;

  if (!postgrestUrl) {
    throw new Error('postgrestUrl is required for PostgreSQL backend');
  }

  const headers = {
    ...postgrestHeaders,
    ...(postgrestApiKey
      ? { apikey: postgrestApiKey, Authorization: `Bearer ${postgrestApiKey}` }
      : {}),
  };

  const client = new PostgrestClient(postgrestUrl, { schema: postgrestSchema, headers });

  const s3Config = createS3Service({ s3Bucket, region });

  const registryConfig = { s3: s3Config };
  const entityRegistry = new PostgresEntityRegistry(client, registryConfig, log);

  return entityRegistry.getCollections();
};
