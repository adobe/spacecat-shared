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
 * Error thrown when there is a conflict with the current state of a resource (HTTP 409).
 */
export class AemConflictError extends AemClientError {
  /**
   * Creates a new AemConflictError.
   * @param {string} message - The error message.
   * @param {string|null} [resource=null] - The resource that caused the conflict.
   */
  constructor(message, resource = null) {
    super(message, 409, 'AEM_CONFLICT');
    this.name = 'AemConflictError';
    this.resource = resource;
  }
}
