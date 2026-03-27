/*
 * Copyright 2026 Adobe. All rights reserved.
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
 * Logs a message with an audit-type prefix using the requested log level.
 * @param {object} log - Logger instance with level methods such as info/error/warn/debug
 * @param {string} level - The log level to invoke
 * @param {string} auditType - The audit type used in the log prefix
 * @param {string} message - The log message
 * @param {Error} [error] - Optional error object to forward to the logger
 */
export function logWithAuditPrefix(log, level, auditType, message, error) {
  const method = log?.[level];
  if (typeof method !== 'function') {
    return;
  }

  const prefixedMessage = `[${auditType}] ${message}`;
  if (error) {
    method(prefixedMessage, error);
  } else {
    method(prefixedMessage);
  }
}
