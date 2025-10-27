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
import { DEFAULT_CPC_VALUE } from './constants.js';
import { getObjectFromKey } from './s3.js';

function createFilePath({ siteId, source, metric }) {
  if (!siteId) {
    throw new Error('siteId is required to compose metrics storage path');
  }

  if (!source) {
    throw new Error('source is required to compose metrics storage path');
  }

  if (!metric) {
    throw new Error('metric is required to compose metrics storage path');
  }

  return `metrics/${siteId}/${source}/${metric}.json`;
}

export async function getStoredMetrics(config, context) {
  const { log, s3 } = context;

  if (!s3.s3Bucket) {
    throw new Error('S3 bucket name is required to get stored metrics');
  }

  const filePath = createFilePath(config);

  const command = new GetObjectCommand({
    Bucket: s3.s3Bucket,
    Key: filePath,
  });

  try {
    const response = await s3.s3Client.send(command);
    const content = await response.Body?.transformToString();
    const metrics = JSON.parse(content);
    log.debug(`Successfully retrieved ${metrics.length} metrics from ${filePath}`);

    return metrics;
  } catch (e) {
    log.error(`Failed to retrieve metrics from ${filePath}, error: ${e.message}`);
    return [];
  }
}

export async function storeMetrics(content, config, context) {
  const { log, s3 } = context;

  if (!s3.s3Bucket) {
    throw new Error('S3 bucket name is required to store metrics');
  }

  const filePath = createFilePath(config);

  const command = new PutObjectCommand({
    Bucket: s3.s3Bucket,
    Key: filePath,
    Body: JSON.stringify(content, null, 2),
    ContentType: 'application/json',
  });

  try {
    const response = await s3.s3Client.send(command);
    log.debug(`Successfully uploaded metrics to ${filePath}, response: ${JSON.stringify(response)}`);

    return filePath;
  } catch (e) {
    log.error(`Failed to upload metrics to ${filePath}, error: ${e.message}`);
    throw new Error(`Failed to upload metrics to ${filePath}, error: ${e.message}`);
  }
}

/**
 * Fetches the organic traffic data for a site from S3 and calculate the CPC value as per
 * https://wiki.corp.adobe.com/pages/viewpage.action?spaceKey=AEMSites&title=Success+Studio+Projected+Business+Impact+Metrics#SuccessStudioProjectedBusinessImpactMetrics-IdentifyingCPCvalueforadomain
 * @param context
 * @param siteId
 * @returns {number} CPC value
 */
export async function calculateCPCValue(context, siteId) {
  if (!context?.env?.S3_IMPORTER_BUCKET_NAME) {
    throw new Error('S3 importer bucket name is required');
  }
  if (!context.s3Client) {
    throw new Error('S3 client is required');
  }
  if (!context.log) {
    throw new Error('Logger is required');
  }
  if (!siteId) {
    throw new Error('SiteId is required');
  }
  const { s3Client, log } = context;
  const bucketName = context.env.S3_IMPORTER_BUCKET_NAME;
  const key = `metrics/${siteId}/ahrefs/organic-traffic.json`;
  try {
    const organicTrafficData = await getObjectFromKey(s3Client, bucketName, key, log);
    if (!Array.isArray(organicTrafficData) || organicTrafficData.length === 0) {
      log.warn(`Organic traffic data not available for ${siteId}. Using Default CPC value.`);
      return DEFAULT_CPC_VALUE;
    }
    const lastTraffic = organicTrafficData.at(-1);
    if (!lastTraffic.cost || !lastTraffic.value) {
      log.warn(`Invalid organic traffic data present for ${siteId} - cost:${lastTraffic.cost} value:${lastTraffic.value}, Using Default CPC value.`);
      return DEFAULT_CPC_VALUE;
    }
    // dividing by 100 for cents to dollar conversion
    return lastTraffic.cost / lastTraffic.value / 100;
  } catch (err) {
    log.error(`Error fetching organic traffic data for site ${siteId}. Using Default CPC value.`, err);
    return DEFAULT_CPC_VALUE;
  }
}
