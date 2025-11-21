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

import AWSXray from 'aws-xray-sdk';
import { isAWSLambda } from './runtimes.js';

export function instrumentAWSClient(client) {
  return isAWSLambda() ? AWSXray.captureAWSv3Client(client) : client;
}

/**
 * Extracts the trace ID from the current AWS X-Ray segment.
 * This function is designed to work in AWS Lambda environments where X-Ray tracing is enabled.
 *
 * @returns {string|null} The trace ID if available, or null if not in Lambda or no segment
 */
export function getTraceId() {
  if (!isAWSLambda()) {
    return null;
  }

  const segment = AWSXray.getSegment();
  if (!segment) {
    return null;
  }

  // Get the root trace ID
  const effectiveSegment = segment.segment || segment;
  return effectiveSegment.trace_id;
}

/**
 * Adds the x-trace-id header to a headers object if a trace ID is available.
 * Checks for traceId from:
 * 1. Explicit context.traceId (from incoming HTTP request or SQS message)
 * 2. AWS X-Ray segment (current Lambda execution)
 *
 * @param {object} headers - The headers object to augment
 * @param {object} context - The context object that may contain traceId
 * @returns {object} The headers object with x-trace-id added if available
 */
export function addTraceIdHeader(headers = {}, context = {}) {
  // Priority: 1) context.traceId (propagated from incoming request), 2) X-Ray traceId
  const traceId = context.traceId || getTraceId();

  if (traceId) {
    return {
      ...headers,
      'x-trace-id': traceId,
    };
  }

  return headers;
}
