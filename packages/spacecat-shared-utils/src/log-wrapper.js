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
 * Check if a value is a plain object (not Array, not Error, not null, not other special objects)
 * @param {*} value - The value to check
 * @returns {boolean} - True if the value is a plain object
 */
function isPlainObject(value) {
  return typeof value === 'object'
    && value !== null
    && !Array.isArray(value)
    && !(value instanceof Error)
    && value.constructor === Object;
}

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
            // If first argument is a plain object, merge with markers
            if (args.length > 0 && isPlainObject(args[0])) {
              return log[level]({ ...markers, ...args[0] });
            }

            // If first argument is a string, convert to structured format
            if (args.length > 0 && typeof args[0] === 'string') {
              const logObject = {
                ...markers,
                message: args[0],
              };

              // If second argument is a plain object, merge it into the log object
              if (args.length > 1 && isPlainObject(args[1])) {
                Object.assign(logObject, args[1]);

                // If there are more arguments after the object, add them as 'data'
                if (args.length > 2) {
                  logObject.data = args.slice(2);
                }
              } else if (args.length > 1) {
                // If there are additional arguments but second is not a plain object,
                // add all additional args as 'data'
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
