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
 * A higher-order function that wraps a given function and enhances logging by appending
 * a `jobId` to log messages when available. This improves traceability of logs associated
 * with specific jobs or processes.
 *
 * The wrapper checks if a `log` object exists in the `context` and whether the `message`
 * contains a `jobId`. If found, log methods (e.g., `info`, `error`, etc.) will prepend the
 * `jobId` to all log statements where `context.contextualLog` is used. If no `jobId` is found,
 * logging will remain unchanged.
 *
 * @param {function} fn - The original function to be wrapped, called with the provided
 * message and context after logging enhancement.
 * @returns {function(object, object): Promise<Response>} - A wrapped function that enhances
 * logging and returns the result of the original function.
 *
 * `context.contextualLog` will include logging methods with `jobId` prefixed, or fall back
 * to the existing `log` object if no `jobId` is provided.
 */
export function logWrapper(fn) {
  return async (message, context) => {
    const { log } = context;

    if (log && !context.contextualLog) {
      if (typeof message === 'object' && 'jobId' in message) {
        const { jobId } = message;
        const jobIdMarker = `[jobId=${jobId}]`;

        // Define log levels
        const logLevels = ['info', 'error', 'debug', 'warn', 'trace', 'verbose', 'silly', 'fatal'];

        // Enhance the log object to include jobId in all log statements
        context.contextualLog = logLevels.reduce((accumulator, level) => {
          if (typeof log[level] === 'function') {
            accumulator[level] = (...args) => log[level](jobIdMarker, ...args);
          }
          return accumulator;
        }, {});
      } else {
        log.debug('No jobId found in the provided message. Log entries will be recorded without a jobId.');
        context.contextualLog = log;
      }
    }

    return fn(message, context);
  };
}
