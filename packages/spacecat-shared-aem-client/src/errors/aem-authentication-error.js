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
 * Error thrown when authentication with AEM fails (HTTP 401).
 */
export class AemAuthenticationError extends AemClientError {
  /**
   * Creates a new AemAuthenticationError.
   * @param {string} message - The error message.
   * @param {string} [reason='UNAUTHORIZED'] - The reason for authentication failure.
   */
  constructor(message, reason = 'UNAUTHORIZED') {
    super(message, 401, 'AEM_AUTHENTICATION_ERROR');
    this.name = 'AemAuthenticationError';
    this.reason = reason;
  }
}
