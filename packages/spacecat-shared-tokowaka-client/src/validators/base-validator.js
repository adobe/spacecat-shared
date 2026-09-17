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
 * Base class for oae_validation validators. Each validator type (routing, and later
 * others such as prerender) extends this class and implements the abstract methods,
 * so the caller (e.g. an import-worker job handler) never needs to know which validator
 * produced a result — only that every validator returns the same { outcome, metadata } shape.
 */
export default class BaseValidator {
  constructor(log) {
    this.log = log;
  }

  /**
   * Returns the validation type this validator handles (matches the oae_validation.type column).
   * @abstract
   * @returns {string} - Validation type
   */
  getType() {
    this.log.error('getType() must be implemented by subclass');
    throw new Error('getType() must be implemented by subclass');
  }

  /**
   * Validates a single suggestion.
   * @abstract
   * @param {Object} _ - Suggestion entity to validate
   * @param {Object} __ - Context (e.g. log, dataAccess) passed through from the caller
   * @returns {Promise<{outcome: string, metadata?: Object}>} - outcome is 'true' | 'false' |
   *   'unknown'; metadata carries supplementary detail (e.g. { origin_status: 403 }).
   */
  // eslint-disable-next-line no-unused-vars
  async validate(_, __) {
    this.log.error('validate() must be implemented by subclass');
    throw new Error('validate() must be implemented by subclass');
  }
}
