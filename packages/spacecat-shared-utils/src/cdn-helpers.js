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

/**
 * CDN-specific transformations for setup payloads
 */
const CDN_TRANSFORMATIONS = {
  'byocdn-fastly': (payload) => ({
    ...payload,
    allowedPaths: payload.allowedPaths?.map((path) => `${path}additional/path`) || [],
    newField: 'somejson',
  }),
  'byocdn-akamai': (payload) => ({
    ...payload,
    // Add Akamai-specific transformations here
  }),
  'byocdn-cloudflare': (payload) => ({
    ...payload,
    // Add Cloudflare-specific transformations here
  }),
  'byocdn-cloudfront': (payload) => ({
    ...payload,
    // Add CloudFront-specific transformations here
  }),
  'ams-cloudfront': (payload) => ({
    ...payload,
    // Add AMS CloudFront-specific transformations here
  }),
};

/**
 * Transforms a CDN setup payload based on the log source type
 * @param {Object} payload - The original CDN setup payload
 * @param {string} logSource - The CDN type ('byocdn-fastly' | 'byocdn-akamai'
 *   | 'byocdn-cloudflare' | 'byocdn-cloudfront' | 'ams-cloudfront')
 * @returns {Object} - The transformed CDN setup payload
 * @throws {Error} - If logSource is not supported
 */
const transformCDNSetup = (payload, logSource) => {
  if (!logSource) {
    throw new Error('logSource parameter is required');
  }

  const transformation = CDN_TRANSFORMATIONS[logSource];
  if (!transformation) {
    throw new Error(`Unsupported log source: ${logSource}. Supported types: ${Object.keys(CDN_TRANSFORMATIONS).join(', ')}`);
  }

  return transformation(payload);
};

export { transformCDNSetup };
