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
 * Base class for opportunity mappers
 * Each opportunity type should extend this class and implement the abstract methods
 */
export default class BaseOpportunityMapper {
  constructor(log) {
    this.log = log;
  }

  /**
   * Returns the opportunity type this mapper handles
   * @abstract
   * @returns {string} - Opportunity type
   */
  // eslint-disable-next-line class-methods-use-this
  getOpportunityType() {
    throw new Error('getOpportunityType() must be implemented by subclass');
  }

  /**
   * Determines if prerendering is required for this opportunity type
   * @abstract
   * @returns {boolean} - True if prerendering is required
   */
  // eslint-disable-next-line class-methods-use-this
  requiresPrerender() {
    throw new Error('requiresPrerender() must be implemented by subclass');
  }

  /**
   * Converts a suggestion to a Tokowaka patch
   * @abstract
   * @param {Object} _ - Suggestion entity with getId() and getData() methods
   * @param {string} _ - Opportunity ID
   * @returns {Object|null} - Patch object or null if conversion fails
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  suggestionToPatch(_, __) {
    throw new Error('suggestionToPatch() must be implemented by subclass');
  }

  /**
   * Validates suggestion data before conversion
   * @param {Object} _ - Suggestion data
   * @returns {boolean} - True if valid
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  validateSuggestionData(_) {
    return false; // Override in subclass if needed
  }

  /**
   * Checks if a suggestion can be deployed for this opportunity type
   * Override this method to add custom deployment eligibility checks
   * @param {Object} _ - Suggestion object
   * @returns {Object} - { eligible: boolean, reason?: string }
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  canDeploy(_) {
    return { eligible: true };
  }

  /**
   * Helper method to create base patch structure
   * @protected
   * @param {string} suggestionId - Suggestion ID
   * @param {string} opportunityId - Opportunity ID
   * @returns {Object} - Base patch object
   */
  createBasePatch(suggestionId, opportunityId) {
    return {
      opportunityId,
      suggestionId,
      prerenderRequired: this.requiresPrerender(),
      lastUpdated: Date.now(),
    };
  }
}
