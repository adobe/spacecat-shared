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
 * Formats a timestamp relative to the current date
 * @param {string} timestamp - ISO 8601 timestamp string
 * @returns {string} - Formatted relative time string
 */
const formatRelativeTime = (timestamp) => {
  if (!timestamp) return '';

  const date = new Date(timestamp);
  const now = new Date();

  // Reset time to midnight for day comparison
  const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const diffMs = nowOnly - dateOnly;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'today';
  }

  const diffYears = diffDays / 365;

  if (diffYears >= 1) {
    return `more than ${Math.floor(diffYears)} year${Math.floor(diffYears) > 1 ? 's' : ''} ago`;
  }

  return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
};

/**
 * Builds credential fields object with backwards compatibility
 * @param {Object} payload - The payload containing credential information
 * @returns {Object} - Object with credential fields and optional timestamp fields
 */
const buildCredentialFields = (payload) => {
  const fields = {};

  // Handle access key
  if (payload.currentAccessKey) {
    fields['Access Key (current)'] = payload.currentAccessKey;
  } else if (payload.accessKey) {
    fields['Access Key'] = payload.accessKey;
  }

  // Handle secret key
  if (payload.currentSecretKey) {
    fields['Secret Key (current)'] = payload.currentSecretKey;
  } else if (payload.secretKey) {
    fields['Secret Key'] = payload.secretKey;
  }

  // Add old credentials if present
  if (payload.oldAccessKey) {
    fields['Access Key (to be retired)'] = payload.oldAccessKey;
  }

  if (payload.oldSecretKey) {
    fields['Secret Key (to be retired)'] = payload.oldSecretKey;
  }

  // Add timestamp fields if present
  if (payload.currentCredentialsCreatedAt) {
    fields.currentCredentialsCreatedAt = formatRelativeTime(payload.currentCredentialsCreatedAt);
  }

  if (payload.currentCredentialsLastUsed) {
    fields.currentCredentialsLastUsed = formatRelativeTime(payload.currentCredentialsLastUsed);
  }

  if (payload.oldCredentialsCreatedAt) {
    fields.oldCredentialsCreatedAt = formatRelativeTime(payload.oldCredentialsCreatedAt);
  }

  if (payload.oldCredentialsLastUsed) {
    fields.oldCredentialsLastUsed = formatRelativeTime(payload.oldCredentialsLastUsed);
  }

  return fields;
};

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
    ...buildCredentialFields(payload),
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
    'Log format': 'JSON',
    'Log file prefix': '{%Y}-{%m}-{%d}T{%H}:{%M}:{%S}.000',
    'Log file suffix': '.log',
    'Log interval': '60 seconds',
    ...buildCredentialFields(payload),
    HelpUrl: 'https://techdocs.akamai.com/datastream2/docs/stream-amazon-s3',
  }),
  'byocdn-cloudflare': (payload) => ({
    'Bucket Name': payload.bucketName,
    Region: payload.region,
    Path: `${payload.allowedPaths?.[0] || ''}`,
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
    'Log format': 'JSON',
    'Ownership token': payload.ownershipToken || 'token-available-after-deployment',
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
    'Output file format': 'JSON',
    HelpUrl: 'https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/standard-logging.html#enable-standard-logging-cross-accounts',
  }),
  'ams-cloudfront': (payload) => ({
    'Bucket Name': payload.bucketName,
    Region: payload.region,
    'Delivery destination ARN': payload.deliveryDestinationArn,
    'Delivery Destination Name': payload.deliveryDestinationName,
    'Destination AWS Account ID': '640168421876',
    'Path suffix': '/{yyyy}/{MM}/{dd}/{HH}',
    'Output file format': 'JSON',
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
  'byocdn-imperva': (payload) => ({
    'Log integration mode': 'Push mode',
    'Delivery method': 'Amazon S3 ARN',
    'Bucket Name': payload.bucketName,
    Region: payload.region,
    Path: payload.allowedPaths?.[0] || '',
    'Log types': 'Cloud WAF',
    'Log level': 'Access logs',
    Format: 'W3C',
    'Compress logs': 'Yes',
    HelpUrl: 'https://docs-cybersec.thalesgroup.com/bundle/cloud-application-security/page/siem-log-configuration.htm',
  }),
  'byocdn-other': (payload) => ({
    'Bucket name': payload.bucketName,
    Region: payload.region,
    Path: `${payload.allowedPaths?.[0] || ''}<year>/<month>/<day>`,
    ...buildCredentialFields(payload),
    'Timestamp format': 'RFC3339',
    'Log format': 'JSON lines (one log per line)',
    Compression: 'Optional, but prefered. Please use Gzip compression if you decide to compress the log files.',
    'Example of valid log line': '{"timestamp":"2025-12-01T13:00:05Z","host":"www.example.com","url":"/docs/getting-started","request_method":"GET","request_user_agent":"Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.0; +https://openai.com/gptbot)","response_status":200,"request_referer":"https://www.chatgpt.com/","response_content_type":"text/html; charset=utf-8","time_to_first_byte":123}',
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
 *   | 'byocdn-cloudflare' | 'byocdn-cloudfront' | 'ams-cloudfront' | 'byocdn-imperva'
 *   | 'byocdn-other')
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

  if (payload.logSource === 'byocdn-fastly' || payload.logSource === 'byocdn-akamai' || payload.logSource === 'byocdn-other') {
    if (!payload.accessKey && !payload.currentAccessKey) {
      throw new Error('accessKey or currentAccessKey is required in payload');
    }
    if (!payload.secretKey && !payload.currentSecretKey) {
      throw new Error('secretKey or currentSecretKey is required in payload');
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

export { prettifyLogForwardingConfig, formatRelativeTime };
