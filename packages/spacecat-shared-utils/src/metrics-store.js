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
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

function createFilePath({ siteId, source, metric }) {
  if (!siteId) {
    throw new Error('siteId is required');
  }

  if (!source) {
    throw new Error('source is required');
  }

  if (!metric) {
    throw new Error('metric is required');
  }

  return `metrics/${siteId}/${source}/${metric}.json`;
}

async function getStoredMetrics(s3Client, config, context) {
  const { log } = context;

  const filePath = createFilePath(config);

  const command = new GetObjectCommand({
    Bucket: context.env.S3_BUCKET_NAME,
    Key: filePath,
  });

  try {
    const response = await s3Client.send(command);
    const content = await response.Body?.transformToString();
    const metrics = JSON.parse(content);
    log.info(`Successfully retrieved ${metrics.length} metrics from ${filePath}`);

    return metrics;
  } catch (e) {
    log.error(`Failed to retrieve metrics from ${filePath}, error: ${e.message}`);
    return [];
  }
}

async function storeMetrics(content, s3Client, config, context) {
  const { log } = context;

  const filePath = createFilePath(config);

  const command = new PutObjectCommand({
    Bucket: context.env.S3_BUCKET_NAME,
    Key: filePath,
    Body: JSON.stringify(content, null, 2),
    ContentType: 'application/json',
  });

  try {
    const response = await s3Client.send(command);
    log.info(`Successfully uploaded metrics to ${filePath}, response: ${JSON.stringify(response)}`);

    return filePath;
  } catch (e) {
    log.error(`Failed to upload metrics to ${filePath}, error: ${e.message}`);
    throw new Error(`Failed to upload metrics to ${filePath}, error: ${e.message}`);
  }
}

export { getStoredMetrics, storeMetrics };
