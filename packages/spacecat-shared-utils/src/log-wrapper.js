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
 * Wraps the provided function to enhance the logging functionality by including the
 * `jobId` in each log statement.
 *
 * @param {function} fn - The original function that will be wrapped.
 * @returns {function(object, object): Promise<Response>} A new function that, when invoked,
 *  will automatically include the `jobId` in all log statements within the context.
 */
export function logWrapper(fn) {
  return async (message, context) => {
    const { log } = context;

    if (log) {
      if (!message || !message.jobId) {
        log.debug('Missing jobId, hence it will not be included in log messages.');
        context.contextualLog = log;

        return fn(message, context);
      }

      const { jobId } = message;

      // Enhance the log object to include jobId in each log statement
      context.contextualLog = {
        info: (...args) => {
          log.info({ jobId, ...args });
        },
        error: (...args) => {
          log.error({ jobId, ...args });
        },
        debug: (...args) => {
          log.debug({ jobId, ...args });
        },
        warn: (...args) => {
          log.warn({ jobId, ...args });
        },
      };
    }

    // Call the wrapped function
    return fn(message, context);
  };
}
