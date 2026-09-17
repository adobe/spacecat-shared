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

import RoutingValidator from './routing-validator.js';

/**
 * Registry for oae_validation validators. Implements Factory Pattern to get the appropriate
 * validator for a validation type (the oae_validation.type column) — new validator types
 * (e.g. a future prerender validator) register here without any caller code changing.
 */
export default class ValidatorRegistry {
  constructor(log) {
    this.log = log;
    this.validators = new Map();
    this.#registerDefaultValidators();
  }

  /**
   * Registers default validators for built-in validation types.
   * @private
   */
  #registerDefaultValidators() {
    const defaultValidators = [
      RoutingValidator,
    ];

    defaultValidators.forEach((ValidatorClass) => {
      const validator = new ValidatorClass(this.log);
      this.registerValidator(validator);
    });
  }

  /**
   * Registers a validator for a validation type.
   * @param {BaseValidator} validator - Validator instance
   */
  registerValidator(validator) {
    const type = validator.getType();
    if (this.validators.has(type)) {
      this.log.debug(`Validator for type "${type}" is being overridden`);
    }
    this.validators.set(type, validator);
    this.log.info(`Registered validator for type: ${type}`);
  }

  /**
   * Gets the validator for a validation type.
   * @param {string} type - Validation type
   * @returns {BaseValidator|null} - Validator instance or null if not found
   */
  getValidator(type) {
    const validator = this.validators.get(type);
    if (!validator) {
      this.log.warn(`No validator found for type: ${type}`);
      return null;
    }
    return validator;
  }

  /**
   * Checks if a validator exists for a validation type.
   * @param {string} type - Validation type
   * @returns {boolean} - True if validator exists
   */
  hasValidator(type) {
    return this.validators.has(type);
  }

  /**
   * Gets all registered validation types.
   * @returns {string[]} - Array of validation types
   */
  getSupportedTypes() {
    return Array.from(this.validators.keys());
  }
}
