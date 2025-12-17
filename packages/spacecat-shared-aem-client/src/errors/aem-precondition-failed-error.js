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

/**
 * Error thrown when a precondition for a request fails (HTTP 412).
 */
export class AemPreconditionFailedError extends AemClientError {
  /**
   * Creates a new AemPreconditionFailedError.
   * @param {string} message - The error message.
   * @param {string|null} [resource=null] - The resource that failed the precondition check.
   */
  constructor(message, resource = null) {
    super(message, 412, 'AEM_PRECONDITION_FAILED');
    this.name = 'AemPreconditionFailedError';
    this.resource = resource;
  }
}
