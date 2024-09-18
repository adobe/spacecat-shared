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
 * A wrapper function that enhances logging by appending the `jobId` to all log statements
 * within the provided context. This allows better traceability and correlation of logs
 * associated with a specific job.
 *
 * @param {function} fn - The original function to be wrapped.
 * @returns {function(object, object): Promise<Response>} A wrapped function that includes
 *  `jobId` in all log statements if `context.contextualLog` is used.
 */
export function logWrapper(fn) {
  return async (message, context) => {
    const { log } = context;

    if (log) {
      if (message && 'jobId' in message) {
        const { jobId } = message;

        // Enhance the log object to include jobId in all log statements
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
          trace: (...args) => {
            log.trace({ jobId, ...args });
          },
        };
      } else {
        log.debug('No jobId found in the provided message. Log entries will be recorded without a jobId.');
        context.contextualLog = log;
      }
    }

    return fn(message, context);
  };
}
