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

import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { llmoConfig } from './schemas.js';

/**
 * @import { S3Client } from "@aws-sdk/client-s3"
 * @import { LLMOConfig } from "./schemas.js"
 */

/**
 * @param {string} siteId The ID of the site to get the config directory for.
 * @returns {string} The configuration directory path for the given site ID.
 */
export function lmmoConfigDir(siteId) {
  return `config/llmo/${siteId}`;
}

/**
 * @param {string} siteId The ID of the site to get the latest config file path for.
 * @returns {string} The latest configuration file path for the given site ID.
 */
export function llmoConfigPath(siteId) {
  return `${lmmoConfigDir(siteId)}/lmmo-config.json`;
}

/**
 * Returns the default LLMO configuration.
 * @returns {LLMOConfig} The default configuration object.
 */
export function defaultConfig() {
  return {
    entities: {},
    categories: {},
    topics: {},
    brands: {
      aliases: [],
    },
    competitors: {
      competitors: [],
    },
    deleted: {
      prompts: {},
    },
    ignoredPrompts: {
      prompts: {},
    },
  };
}

/**
 * Reads the LLMO configuration for a given site.
 * Returns an empty configuration if the configuration does not exist.
 *
 * @param {string} sideId The ID of the site.
 * @param {S3Client} s3Client The S3 client to use for reading the configuration.
 * @param {object} [options]
 * @param {string} [options.version] Optional version ID of the configuration to read.
 *        Defaults to the latest version.
 * @param {string} [options.s3Bucket] Optional S3 bucket name.
 * @returns {Promise<{config: LLMOConfig, exists: boolean, version?: string}>} The configuration,
 *        a flag indicating if it existed, and the version ID if it exists.
 * @throws {Error} If reading the configuration fails for reasons other than it not existing.
 */
export async function readConfig(sideId, s3Client, options) {
  const version = options?.version;
  const s3Bucket = options?.s3Bucket || process.env.S3_BUCKET_NAME;

  const getObjectCommand = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: llmoConfigPath(sideId),
    VersionId: version,
  });
  let res;
  try {
    res = await s3Client.send(getObjectCommand);
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.name === 'NotFound') {
      // Config does not exist yet. Return empty config.
      return { config: defaultConfig(), exists: false, version: undefined };
    }
    throw e;
  }

  const body = res.Body;
  if (!body) {
    throw new Error('LLMO config body is empty');
  }
  const text = await body.transformToString();
  const config = llmoConfig.parse(JSON.parse(text));
  return { config, exists: true, version: res.VersionId || undefined };
}

/**
 * Writes the LLMO configuration for a given site.
 * @param {string} siteId The ID of the site.
 * @param {LLMOConfig} config The configuration object to write.
 * @param {S3Client} s3Client The S3 client to use for reading the configuration.
 * @param {object} [options]
 * @param {string} [options.s3Bucket] Optional S3 bucket name.
 * @returns {Promise<{ version: string }>} The version of the configuration written.
 */
export async function writeConfig(siteId, config, s3Client, options) {
  const s3Bucket = options?.s3Bucket || process.env.S3_BUCKET_NAME;

  const putObjectCommand = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: llmoConfigPath(siteId),
    Body: JSON.stringify(config, null, 2),
    ContentType: 'application/json',
  });
  const res = await s3Client.send(putObjectCommand);
  if (!res.VersionId) {
    throw new Error('Failed to get version ID after writing LLMO config');
  }
  return { version: res.VersionId };
}
