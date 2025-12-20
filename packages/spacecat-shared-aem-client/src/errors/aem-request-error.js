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

import { AemClientError } from './aem-client-error.js';
import { AemBadRequestError } from './aem-bad-request-error.js';
import { AemAuthenticationError } from './aem-authentication-error.js';
import { AemForbiddenError } from './aem-forbidden-error.js';
import { AemConflictError } from './aem-conflict-error.js';
import { AemPreconditionFailedError } from './aem-precondition-failed-error.js';

/**
 * Error thrown when an AEM API request fails with an unexpected HTTP status.
 */
export class AemRequestError extends AemClientError {
  /**
   * Creates a new AemRequestError.
   * @param {number} statusCode - The HTTP status code of the failed request.
   * @param {string} message - The error message.
   * @param {string|null} [responseBody=null] - The response body from the failed request.
   */
  constructor(statusCode, message, responseBody = null) {
    super(message, statusCode, `AEM_HTTP_${statusCode}`);
    this.name = 'AemRequestError';
    this.responseBody = responseBody;
  }

  /**
   * Factory method to create the appropriate error type based on HTTP status code.
   * @param {number} statusCode - The HTTP status code.
   * @param {string} message - The error message.
   * @param {object} [context={}] - Additional context for the error.
   * @param {string} [context.resource] - The resource path that failed.
   * @param {string} [context.parameter] - The parameter that caused the error (for 400).
   * @returns {AemClientError} The appropriate error instance.
   */
  static fromResponse(statusCode, message, context = {}) {
    const { resource, parameter } = context;

    switch (statusCode) {
      case 400:
        return new AemBadRequestError(message, parameter);
      case 401:
        return new AemAuthenticationError(message);
      case 403:
        return new AemForbiddenError(message, resource);
      case 409:
        return new AemConflictError(message, resource);
      case 412:
        return new AemPreconditionFailedError(message, resource);
      default:
        return new AemRequestError(statusCode, message);
    }
  }
}
