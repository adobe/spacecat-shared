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

import { hasText } from '@adobe/spacecat-shared-utils';
import { TARGET_USER_AGENTS_CATEGORIES } from '../constants.js';
import BaseOpportunityMapper from './base-mapper.js';

/**
 * Generic mapper for code change opportunities
 * Handles conversion of generic code change suggestions to Tokowaka patches
 */
export default class GenericMapper extends BaseOpportunityMapper {
  constructor(log) {
    super(log);
    this.opportunityType = 'generic-tokowaka-patch';
    this.prerenderRequired = true;
  }

  getOpportunityType() {
    return this.opportunityType;
  }

  requiresPrerender() {
    return this.prerenderRequired;
  }

  /**
   * Converts suggestions to Tokowaka patches
   * @param {string} urlPath - URL path for the suggestions
   * @param {Array} suggestions - Array of suggestion entities for the same URL
   * @param {string} opportunityId - Opportunity ID
   * @returns {Array} - Array of Tokowaka patch objects
   */
  suggestionsToPatches(urlPath, suggestions, opportunityId) {
    const patches = [];

    suggestions.forEach((suggestion) => {
      const eligibility = this.canDeploy(suggestion);
      if (!eligibility.eligible) {
        this.log.warn(`Generic suggestion ${suggestion.getId()} cannot be deployed: ${eligibility.reason}`);
        return;
      }

      const data = suggestion.getData();

      const patch = {
        ...this.createBasePatch(suggestion, opportunityId),
        op: data.insertionOperation,
        selector: data.cssSelector,
        value: data.patchValue,
        valueFormat: 'text',
        target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS,
      };

      patches.push(patch);
    });

    return patches;
  }

  /**
   * Checks if a generic suggestion can be deployed
   * @param {Object} suggestion - Suggestion object
   * @returns {Object} { eligible: boolean, reason?: string }
   */
  // eslint-disable-next-line class-methods-use-this
  canDeploy(suggestion) {
    const data = suggestion.getData();

    // Validate required fields
    if (!hasText(data?.cssSelector)) {
      return { eligible: false, reason: 'cssSelector is required' };
    }

    if (!hasText(data?.patchValue)) {
      return { eligible: false, reason: 'patchValue is required' };
    }

    if (!hasText(data?.insertionOperation)) {
      return { eligible: false, reason: 'insertionOperation is required' };
    }

    // Validate insertionOperation value
    const validOperations = ['insertBefore', 'insertAfter', 'replace'];
    if (!validOperations.includes(data.insertionOperation)) {
      return {
        eligible: false,
        reason: `insertionOperation must be one of: ${validOperations.join(', ')}. Got: ${data.insertionOperation}`,
      };
    }

    if (!hasText(data?.url)) {
      return { eligible: false, reason: 'url is required' };
    }

    return { eligible: true };
  }
}
