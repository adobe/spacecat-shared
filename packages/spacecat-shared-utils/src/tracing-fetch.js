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
import { Request, timeoutSignal, AbortError } from '@adobe/fetch';
import AWSXRay from 'aws-xray-sdk';

import { fetch as adobeFetch } from './adobe-fetch.js';
import { isNumber, isObject } from './functions.js';
import { RUNTIMES } from './constants.js';

export const SPACECAT_USER_AGENT = 'Mozilla/5.0 (Linux; Android 11; moto g power (2022)) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36 Spacecat/1.0';

/**
 * Creates a subsegment for a given hostname based on whether the parent segment is traced or not.
 * @param {Object} parentSegment - The parent X-Ray segment.
 * @param {string} hostname - The hostname to associate with the subsegment.
 * @returns {Object} The created subsegment.
 */
const createSubsegment = (parentSegment, hostname) => (parentSegment.notTraced
  ? parentSegment.addNewSubsegmentWithoutSampling(hostname)
  : parentSegment.addNewSubsegment(hostname));

/**
 * Sets the AWS X-Ray trace headers on the request object.
 * @param {Request} request - The request object on which headers are set.
 * @param {Object} parentSegment - The parent X-Ray segment.
 * @param {Object} subSegment - The subsegment to include in the headers.
 */
const setTraceHeaders = (request, parentSegment, subSegment) => {
  const effectiveParentSegment = parentSegment.segment || parentSegment;
  request.headers.set(
    'X-Amzn-Trace-Id',
    `Root=${effectiveParentSegment.trace_id};Parent=${subSegment.id};Sampled=0`,
  );
};

/**
 * Adds flags to the given subsegment based on the status code of the response.
 * @param {Object} subSegment - The X-Ray subsegment to which flags are added.
 * @param {number} status - The status code of the response.
 */
const setSubSegmentFlagsByStatusCode = (
  subSegment,
  status,
) => { /* eslint-disable no-param-reassign */
  if (status === 429) {
    subSegment.throttled = true;
    return;
  }
  if (status >= 400 && status < 500) {
    subSegment.error = true;
    return;
  }
  if (status >= 500 && status < 600) {
    subSegment.fault = true;
  }
};

/**
 * Adds request and response data to the given segment for AWS X-Ray tracing.
 * @param {Object} segment - The X-Ray segment to which request and response data are added.
 * @param {Request} request - The original request object.
 * @param {Response} [response] - The response object (if available).
 */
const addFetchRequestDataToSegment = (
  segment,
  request,
  response,
) => { /* eslint-disable no-param-reassign */
  const { url, method } = request;
  segment.http = {
    request: { url, method },
  };

  if (!response) {
    return;
  }

  segment.http.response = {
    status: response.status,
  };

  const contentLength = Number.parseInt(response.headers.get('content-length'), 10);
  if (isNumber(contentLength)) {
    segment.http.response.content_length = contentLength;
  }
};

/**
 * Adds error data to the given segment for AWS X-Ray tracing.
 * @param {Object} subSegment - The X-Ray subsegment to which error data is added.
 * @param {Request} request - The original request object.
 * @param {Error} error - The error object.
 */
const handleSubSegmentError = (subSegment, request, error) => {
  subSegment.addErrorFlag();
  addFetchRequestDataToSegment(subSegment, request);
  subSegment.addAnnotation('errorMessage', error.message);
  subSegment.addAnnotation('errorStack', error.stack);
  subSegment.close(error);
};

/**
 * Creates a timeout error with a consistent format
 * @param {number} timeout - The timeout value in milliseconds
 * @returns {Error} A formatted timeout error
 */
const createTimeoutError = (timeout) => {
  const timeoutError = new Error(`Request timeout after ${timeout}ms`);
  timeoutError.code = 'ETIMEOUT';
  return timeoutError;
};

/**
 * Performs a fetch request with timeout handling
 * @param {string|Request} resource - The resource to fetch
 * @param {Object} options - Options for the fetch call
 * @param {Object} signal - The timeout signal
 * @returns {Promise<Response>} The fetch response
 */
const fetchWithTimeout = async (resource, options, signal) => {
  try {
    const fetchOptions = { ...options, signal };
    return await adobeFetch(resource, fetchOptions);
  } catch (error) {
    if (error instanceof AbortError) {
      // Extract timeout from signal (implementation detail, but necessary)
      // eslint-disable-next-line no-underscore-dangle
      const timeout = signal._ms || 10000;
      throw createTimeoutError(timeout);
    }
    throw error;
  } finally {
    signal.clear(); // Clean up the signal
  }
};

/**
 * Performs a fetch request and adds AWS X-Ray tracing, including request/response tracking.
 * @param {string} url - The URL for the request.
 * @param {Object} [options] - Optional options to be passed to the fetch call.
 * @param {number} [options.timeout=10000] - Timeout in milliseconds (defaults to 10 seconds).
 * @returns {Promise<Response>} The response from the fetch request.
 */
export async function tracingFetch(url, options) {
  // fallback to adobe fetch outside an aws lambda function
  if (process.env.SPACECAT_RUNTIME !== RUNTIMES.AWS_LAMBDA) {
    return adobeFetch;
  }

  const parentSegment = AWSXRay.getSegment();

  options = isObject(options) ? { ...options } : {};
  options.headers = isObject(options.headers) ? options.headers : { };

  // Set default timeout of 10 seconds if not specified
  const timeout = options.timeout || 10000;
  delete options.timeout; // Remove from options as we'll handle it separately

  // Create a timeout signal
  const signal = timeoutSignal(timeout);

  // find user-agent header in headers case insensitively
  let hasUserAgent = false;
  Object.keys(options.headers).forEach((key) => {
    if (key.toLowerCase() === 'user-agent') {
      hasUserAgent = true;
    }
  });

  if (!hasUserAgent) {
    options.headers['User-Agent'] = SPACECAT_USER_AGENT;
  }

  // If no parent segment, perform fetch without tracing
  if (!parentSegment) {
    return fetchWithTimeout(url, options, signal);
  }

  // With parent segment, create subsegment and add tracing
  const request = new Request(url, options);
  const { hostname } = new URL(request.url);
  const subSegment = createSubsegment(parentSegment, hostname);

  subSegment.namespace = 'remote';

  if (!parentSegment.noOp) {
    setTraceHeaders(request, parentSegment, subSegment);
  }

  subSegment.addAnnotation('timeout_ms', timeout);

  try {
    // Create a new request with the signal
    const requestWithSignal = new Request(request, { signal });

    // Use the same fetchWithTimeout function but catch errors to handle subsegment
    const response = await fetchWithTimeout(requestWithSignal, { }, signal);

    setSubSegmentFlagsByStatusCode(subSegment, response.status);
    addFetchRequestDataToSegment(subSegment, request, response);
    subSegment.close();

    return response;
  } catch (error) {
    handleSubSegmentError(subSegment, request, error);
    throw error;
  }
}
