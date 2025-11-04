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
 * @returns {string|null} The trace ID if available, or null if not in AWS Lambda or no segment found
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
