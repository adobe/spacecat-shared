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
 * CDN-specific transformations for log forwarding configuration preparation
 */

const FASTLY_LOG_FORMAT = `{
    "timestamp": "%{strftime(\\{"%Y-%m-%dT%H:%M:%S%z"\\}, time.start)}V",
    "host": "%{if(req.http.Fastly-Orig-Host, req.http.Fastly-Orig-Host, req.http.Host)}V",
    "url": "%{json.escape(req.url)}V",
    "request_method": "%{json.escape(req.method)}V",
    "request_referer": "%{json.escape(req.http.referer)}V",
    "request_user_agent": "%{json.escape(req.http.User-Agent)}V",
    "response_status": %{resp.status}V,
    "response_content_type": "%{json.escape(resp.http.Content-Type)}V",
    "client_country_code": "%{client.geo.country_name}V",
    "time_to_first_byte": "%{time.to_first_byte}V"
}`;
const CDN_TRANSFORMATIONS = {
  'byocdn-fastly': (payload) => ({
    'Bucket Name': payload.bucketName,
    Domain: `s3.${payload.region}.amazonaws.com`,
    Path: `${payload.allowedPaths?.[0] || ''}%Y/%m/%d/%H/`,
    'Timestamp Format': '%Y-%m-%dT%H:%M:%S.000',
    Placement: 'Format Version Default',
    'Log format': FASTLY_LOG_FORMAT,
    'Access method': 'User credentials',
    'Access key': payload.accessKey,
    'Secret key': payload.secretKey,
    Period: 300,
    'Log line format': 'Blank',
    Compression: 'Gzip',
    'Redundancy level': 'Standard',
    ACL: 'None',
    'Server side encryption': 'None',
    'Maximum bytes': 0,
    HelpUrl: 'https://www.fastly.com/documentation/guides/integrations/logging-endpoints/log-streaming-amazon-s3/',
  }),
  'byocdn-akamai': (payload) => ({
    'Bucket Name': payload.bucketName,
    Region: payload.region,
    Path: `${payload.allowedPaths?.[0] || ''}{%Y}/{%m}/{%d}/{%H}`,
    'Logged Properties': [
      'reqTimeSec',
      'country',
      'reqHost',
      'reqPath',
      'queryStr',
      'reqMethod',
      'ua',
      'statusCode',
      'referer',
      'rspContentType',
      'timeToFirstByte',
    ],
    'Log file prefix': '{%Y}-{%m}-{%d}T{%H}:{%M}:{%S}.000',
    'Log file suffix': '.log',
    'Log interval': '60 seconds',
    'Access key': payload.accessKey,
    'Secret key': payload.secretKey,
    HelpUrl: 'https://techdocs.akamai.com/datastream2/docs/stream-amazon-s3',
  }),
  'byocdn-cloudflare': (payload) => ({
    'Bucket Name': payload.bucketName,
    Region: payload.region,
    Path: `${payload.allowedPaths?.[0] || ''}{DATE}/`,
    'Timestamp format': 'RFC3339',
    'Sampling rate': 'All logs',
    'Organize logs into daily subfolders': 'Yes',
    'Logged Properties': [
      'EdgeStartTimestamp',
      'ClientCountry',
      'ClientRequestHost',
      'ClientRequestURI',
      'ClientRequestMethod',
      'ClientRequestUserAgent',
      'EdgeResponseStatus',
      'ClientRequestReferer',
      'EdgeResponseContentType',
      'EdgeTimeToFirstByteMs',
    ],
    'Ownership token': 'Please reach out to Adobe support for obtaining the token once you completed the configuration.',
    HelpUrl: 'https://developers.cloudflare.com/logs/logpush/logpush-job/enable-destinations/aws-s3/',
  }),
  'byocdn-cloudfront': (payload) => ({
    'Bucket Name': payload.bucketName,
    Region: payload.region,
    'Delivery destination ARN': payload.deliveryDestinationArn,
    'Delivery Destination Name': payload.deliveryDestinationName,
    'Destination AWS Account ID': '640168421876',
    'Path suffix': '/{yyyy}/{MM}/{dd}/{HH}',
    'Logged Properties': [
      'date',
      'time',
      'x-edge-location',
      'cs-method',
      'x-host-header',
      'cs-uri-stem',
      'sc-status',
      'cs(Referer)',
      'cs(User-Agent)',
      'time-to-first-byte',
      'sc-content-type',
    ],
    HelpUrl: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html#enable-standard-logging-cross-accounts',
  }),
  'ams-cloudfront': (payload) => ({
    'Bucket Name': payload.bucketName,
    Region: payload.region,
    'Delivery destination ARN': payload.deliveryDestinationArn,
    'Delivery Destination Name': payload.deliveryDestinationName,
    'Destination AWS Account ID': '640168421876',
    'Path suffix': '/{yyyy}/{MM}/{dd}/{HH}',
    'Logged Properties': [
      'date',
      'time',
      'x-edge-location',
      'cs-method',
      'x-host-header',
      'cs-uri-stem',
      'sc-status',
      'cs(Referer)',
      'cs(User-Agent)',
      'time-to-first-byte',
      'sc-content-type',
    ],
  }),
};

/**
 * Prepares log forwarding configuration parameters
 * from CDN-Logs-Infrastructure-Provisioning API result
 *
 * Takes the result of the CDN-Logs-Infrastructure-Provisioning API and prepares all configuration
 * parameters needed for setting up log forwarding. Some parameters are read from the API result,
 * while others are static values that don't come from the API.
 *
 * @param {Object} payload - The result from CDN-Logs-Infrastructure-Provisioning API
 * @param {string} payload.logSource - The CDN type ('byocdn-fastly' | 'byocdn-akamai'
 *   | 'byocdn-cloudflare' | 'byocdn-cloudfront' | 'ams-cloudfront')
 * @returns {Object} - The prepared log forwarding configuration parameters
 * @throws {Error} - If logSource is not supported or missing
 */
const prettifyLogForwardingConfig = (payload) => {
  if (!payload) {
    throw new Error('payload is required as input');
  }

  if (!payload.logSource) {
    throw new Error('logSource is required in payload');
  }

  if (!payload.bucketName) {
    throw new Error('bucketName is required in payload');
  }

  if (!payload.region) {
    throw new Error('region is required in payload');
  }

  if (!payload.authMethod) {
    throw new Error('authMethod is required in payload');
  }

  if (!payload.allowedPaths) {
    throw new Error('allowedPaths is required in payload');
  }

  if (payload.logSource === 'byocdn-fastly' || payload.logSource === 'byocdn-akamai') {
    if (!payload.accessKey) {
      throw new Error('accessKey is required in payload');
    }
    if (!payload.secretKey) {
      throw new Error('secretKey is required in payload');
    }
  }

  if (payload.logSource === 'byocdn-cloudfront' || payload.logSource === 'ams-cloudfront') {
    if (!payload.deliveryDestinationArn) {
      throw new Error('deliveryDestinationArn is required in payload');
    }
    if (!payload.deliveryDestinationName) {
      throw new Error('deliveryDestinationName is required in payload');
    }
  }

  const transformation = CDN_TRANSFORMATIONS[payload.logSource];
  if (!transformation) {
    throw new Error(`Unsupported log source: ${payload.logSource}. Supported types: ${Object.keys(CDN_TRANSFORMATIONS).join(', ')}`);
  }

  return transformation(payload);
};

export { prettifyLogForwardingConfig };
