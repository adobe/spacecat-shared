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
import { h1NoCache, keepAliveNoCache } from '@adobe/fetch';

import { instrumentAWSClient } from '@adobe/spacecat-shared-utils';
import { EntityRegistry } from '../models/index.js';
import { registerLogger } from '../util/logger-registry.js';

// Create a dedicated fetch context for PostgREST with:
// - keepAlive: true for HTTP/1.1 connection reuse (the default h2() context sets keepAlive: false
//   for h1 on Node 19+, which defeats connection reuse for plain HTTP targets like our ALB)
// - maxCacheSize: 0 to disable HTTP response caching (PostgREST GET responses are cacheable
//   by default, which could cause stale reads after writes within the same Lambda invocation)
// h1NoCache() in tests for nock compat; keepAliveNoCache() in prod for connection reuse.
const fetchContext = process.env.HELIX_FETCH_FORCE_HTTP1
  ? h1NoCache() : keepAliveNoCache();
const { fetch: postgrestFetch } = fetchContext;

/**
 * Creates a fetch wrapper that converts native (WHATWG) Headers instances to plain objects.
 * @adobe/fetch's Headers class doesn't recognize native Headers instances (instanceof check
 * fails), causing all headers to be silently dropped. @supabase/postgrest-js passes native
 * Headers objects, so we convert them to plain objects for compatibility.
 *
 * @param {Function} fetchFn - The underlying fetch function to wrap
 * @returns {Function} A wrapped fetch function with Headers compatibility
 */
export const createFetchCompat = (fetchFn) => (url, opts) => {
  if (opts?.headers instanceof Headers) {
    return fetchFn(url, { ...opts, headers: Object.fromEntries(opts.headers.entries()) });
  }
  return fetchFn(url, opts);
};

const fetch = createFetchCompat(postgrestFetch);

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
    fetch,
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
  const entityRegistry = new EntityRegistry(services, config, log);

  return {
    ...entityRegistry.getCollections(),
    services: {
      postgrestClient: postgrestService,
    },
  };
};
