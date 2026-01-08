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

import { AemBadRequestError } from './aem-bad-request-error.js';

/**
 * Error thrown when the AEM client is misconfigured.
 * Examples: missing base URL, invalid IMS client configuration.
 */
export class AemConfigurationError extends AemBadRequestError {
  /**
   * Creates a new AemConfigurationError.
   * @param {string} message - Description of the configuration issue.
   * @param {string} parameter - The configuration parameter that is missing or invalid.
   */
  constructor(message, parameter) {
    super(message, parameter);
    this.name = 'AemConfigurationError';
    this.errorCode = 'AEM_CONFIGURATION_ERROR';
  }
}
