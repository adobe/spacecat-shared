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

import { getTraceId } from './xray.js';

/**
 * A higher-order function that wraps a given function and enhances logging by converting
 * all logs to JSON format and appending `jobId` and `traceId` to log messages when available.
 *
 * All log messages are automatically converted to structured JSON format:
 * - String messages become: { message: "...", jobId: "...", traceId: "..." }
 * - Object messages are merged with: { ...yourObject, jobId: "...", traceId: "..." }
 *
 * @param {function} fn - The original function to be wrapped
 * @returns {function(object, object): Promise<Response>} - A wrapped function with JSON logging
 */
export function logWrapper(fn) {
  return async (message, context) => {
    const { log } = context;

    if (log && !context.contextualLog) {
      const markers = {};

      // Extract jobId from message if available
      if (typeof message === 'object' && message !== null && 'jobId' in message) {
        markers.jobId = message.jobId;
      }

      // Extract traceId from AWS X-Ray
      const traceId = getTraceId();
      if (traceId) {
        markers.traceId = traceId;
      }

      // Define log levels
      const logLevels = ['info', 'error', 'debug', 'warn', 'trace', 'verbose', 'silly', 'fatal'];

      // Wrap all log methods to output structured JSON
      context.log = logLevels.reduce((accumulator, level) => {
        if (typeof log[level] === 'function') {
          accumulator[level] = (...args) => {
            // If first argument is a plain object
            // (not Error, not Array, not null), merge with markers
            if (args.length > 0
                && typeof args[0] === 'object'
                && args[0] !== null
                && !Array.isArray(args[0])
                && !(args[0] instanceof Error)
                && args[0].constructor === Object) {
              return log[level]({ ...markers, ...args[0] });
            }

            // If first argument is a string, convert to structured format
            if (args.length > 0 && typeof args[0] === 'string') {
              const logObject = {
                ...markers,
                message: args[0],
              };

              // If there are additional arguments, add them as 'data'
              if (args.length > 1) {
                logObject.data = args.slice(1);
              }

              return log[level](logObject);
            }

            // For other types (arrays, primitives, Error objects), wrap in object
            return log[level]({ ...markers, data: args });
          };
        }
        return accumulator;
      }, {});

      // Mark that we've processed this context
      context.contextualLog = context.log;
    }

    return fn(message, context);
  };
}
