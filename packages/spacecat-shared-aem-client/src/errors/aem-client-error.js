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

/**
 * Base error class for all AEM client errors.
 * Extends Error with additional properties for HTTP status codes and error codes.
 */
export class AemClientError extends Error {
  /**
   * Creates a new AemClientError.
   * @param {string} message - The error message.
   * @param {number} [statusCode=500] - The HTTP status code associated with this error.
   * @param {string} [errorCode='AEM_CLIENT_ERROR'] - A machine-readable error code.
   */
  constructor(message, statusCode = 500, errorCode = 'AEM_CLIENT_ERROR') {
    super(message);
    this.name = 'AemClientError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
  }
}
