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
 * A higher-order function that wraps a given function and enhances logging by appending
 * a `jobId` and `traceId` to log messages when available. This improves traceability of logs
 * associated with specific jobs or processes.
 *
 * The wrapper checks if a `log` object exists in the `context` and whether the `message`
 * contains a `jobId`. It also extracts the AWS X-Ray trace ID if available. If found, log
 * methods (e.g., `info`, `error`, etc.) will prepend the `jobId` and/or `traceId` to all log
 * statements. All existing code using `context.log` will automatically include these markers.
 *
 * @param {function} fn - The original function to be wrapped, called with the provided
 * message and context after logging enhancement.
 * @returns {function(object, object): Promise<Response>} - A wrapped function that enhances
 * logging and returns the result of the original function.
 *
 * `context.log` will be enhanced in place to include `jobId` and/or `traceId` prefixed to all
 * log messages. No code changes needed - existing `context.log` calls work automatically.
 */
export function logWrapper(fn) {
  return async (message, context) => {
    const { log } = context;

    if (log && !context.contextualLog) {
      const markers = [];

      // Extract jobId from message if available
      if (typeof message === 'object' && message !== null && 'jobId' in message) {
        const { jobId } = message;
        markers.push(`[jobId=${jobId}]`);
      }

      // Extract traceId: prioritize context.traceId (from SQS message propagation)
      // over X-Ray segment (which is new for each Lambda invocation)
      const traceId = context.traceId || getTraceId();
      if (traceId) {
        markers.push(`[traceId=${traceId}]`);
      }

      // If we have markers, enhance the log object directly
      if (markers.length > 0) {
        const markerString = markers.join(' ');

        // Define log levels
        const logLevels = ['info', 'error', 'debug', 'warn', 'trace', 'verbose', 'silly', 'fatal'];

        // Enhance context.log directly to include markers in all log statements
        context.log = logLevels.reduce((accumulator, level) => {
          if (typeof log[level] === 'function') {
            accumulator[level] = (...args) => {
              // If first argument is a string (format string), prepend the marker to it
              if (args.length > 0 && typeof args[0] === 'string') {
                const enhancedArgs = [`${markerString} ${args[0]}`, ...args.slice(1)];
                return log[level](...enhancedArgs);
              }
              return log[level](...args);
            };
          }
          return accumulator;
        }, {});
      }

      // Mark that we've processed this context
      context.contextualLog = context.log;
    }

    return fn(message, context);
  };
}
