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

/**
 * @import { S3Client } from "@aws-sdk/client-s3"
 */

/**
 * @param {string} siteId The ID of the site to get the strategy file path for.
 * @returns {string} The strategy file path for the given site ID.
 */
export function strategyPath(siteId) {
  return `workspace/llmo/${siteId}/strategy.json`;
}

/**
 * Reads the strategy JSON for a given site.
 * Returns null if the strategy does not exist.
 *
 * @param {string} siteId The ID of the site.
 * @param {S3Client} s3Client The S3 client to use for reading the strategy.
 * @param {object} [options]
 * @param {string} [options.version] Optional version ID of the strategy to read.
 *        Defaults to the latest version.
 * @param {string} [options.s3Bucket] Optional S3 bucket name.
 * @returns {Promise<{data: object | null, exists: boolean, version?: string}>} The strategy data,
 *        a flag indicating if it existed, and the version ID if it exists.
 * @throws {Error} If reading the strategy fails for reasons other than it not existing.
 */
export async function readStrategy(siteId, s3Client, options) {
  const version = options?.version;
  const s3Bucket = options?.s3Bucket || process.env.S3_BUCKET_NAME;

  const getObjectCommand = new GetObjectCommand({
    Bucket: s3Bucket,
    Key: strategyPath(siteId),
    VersionId: version,
  });

  let res;
  try {
    res = await s3Client.send(getObjectCommand);
  } catch (e) {
    if (e.name === 'NoSuchKey' || e.name === 'NotFound') {
      // Strategy does not exist yet. Return null.
      return { data: null, exists: false, version: undefined };
    }
    throw e;
  }

  const body = res.Body;
  if (!body) {
    throw new Error('Strategy body is empty');
  }
  const text = await body.transformToString();
  const data = JSON.parse(text);
  return { data, exists: true, version: res.VersionId || undefined };
}

/**
 * Writes the strategy JSON for a given site.
 * @param {string} siteId The ID of the site.
 * @param {object} data The data object to write (any valid JSON).
 * @param {S3Client} s3Client The S3 client to use for writing the strategy.
 * @param {object} [options]
 * @param {string} [options.s3Bucket] Optional S3 bucket name.
 * @returns {Promise<{ version: string }>} The version of the strategy written.
 */
export async function writeStrategy(siteId, data, s3Client, options) {
  const s3Bucket = options?.s3Bucket || process.env.S3_BUCKET_NAME;

  const putObjectCommand = new PutObjectCommand({
    Bucket: s3Bucket,
    Key: strategyPath(siteId),
    Body: JSON.stringify(data, null, 2),
    ContentType: 'application/json',
  });

  const res = await s3Client.send(putObjectCommand);
  if (!res.VersionId) {
    throw new Error('Failed to get version ID after writing strategy');
  }
  return { version: res.VersionId };
}
