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
  getOpportunityType() {
    this.log.error('getOpportunityType() must be implemented by subclass');
    throw new Error('getOpportunityType() must be implemented by subclass');
  }

  /**
   * Determines if prerendering is required for this opportunity type
   * @abstract
   * @returns {boolean} - True if prerendering is required
   */
  requiresPrerender() {
    this.log.error('requiresPrerender() must be implemented by subclass');
    throw new Error('requiresPrerender() must be implemented by subclass');
  }

  /**
   * Converts a suggestion to a Tokowaka patch
   * @abstract
   * @param {Object} _ - Suggestion entity with getId() and getData() methods
   * @param {string} __ - Opportunity ID
   * @returns {Object|null} - Patch object or null if conversion fails
   */
  // eslint-disable-next-line no-unused-vars
  suggestionToPatch(_, __) {
    this.log.error('suggestionToPatch() must be implemented by subclass');
    throw new Error('suggestionToPatch() must be implemented by subclass');
  }

  /**
   * Checks if a suggestion can be deployed for this opportunity type
   * This method should validate all eligibility and data requirements
   * @abstract
   * @param {Object} _ - Suggestion object
   * @returns {Object} - { eligible: boolean, reason?: string }
   */
  // eslint-disable-next-line no-unused-vars
  canDeploy(_) {
    this.log.error('canDeploy() must be implemented by subclass');
    throw new Error('canDeploy() must be implemented by subclass');
  }

  /**
   * Helper method to create base patch structure
   * @protected
   * @param {Object} suggestion - Suggestion entity with getUpdatedAt() method
   * @param {string} opportunityId - Opportunity ID
   * @returns {Object} - Base patch object
   */
  createBasePatch(suggestion, opportunityId) {
    const updatedAt = suggestion.getUpdatedAt();
    const lastUpdated = updatedAt ? new Date(updatedAt).getTime() : Date.now();

    return {
      opportunityId,
      suggestionId: suggestion.getId(),
      prerenderRequired: this.requiresPrerender(),
      lastUpdated,
    };
  }
}
