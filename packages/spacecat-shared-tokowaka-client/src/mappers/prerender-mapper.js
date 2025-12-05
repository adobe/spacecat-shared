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
import BaseOpportunityMapper from './base-mapper.js';

/**
 * Prerender mapper for prerender opportunities
 * Handles prerender suggestions - these don't generate patches, just enable prerendering
 */
export default class PrerenderMapper extends BaseOpportunityMapper {
  constructor(log) {
    super(log);
    this.opportunityType = 'prerender';
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
   * For prerender, we don't generate patches - just mark prerender as required
   * @param {string} urlPath - URL path for the suggestions
   * @param {Array} suggestions - Array of suggestion entities for the same URL
   * @param {string} opportunityId - Opportunity ID
   * @returns {Array} - Empty array (prerender doesn't use patches)
   */
  // eslint-disable-next-line class-methods-use-this, no-unused-vars
  suggestionsToPatches(urlPath, suggestions, opportunityId) {
    // Prerender suggestions don't generate patches
    // They just enable prerendering for the URL
    // Return empty array so no patches are created
    return [];
  }

  /**
   * Checks if a prerender suggestion can be deployed
   * @param {Object} suggestion - Suggestion object
   * @returns {Object} { eligible: boolean, reason?: string }
   */
  // eslint-disable-next-line class-methods-use-this
  canDeploy(suggestion) {
    const data = suggestion.getData();

    // Validate URL exists
    if (!hasText(data?.url)) {
      return { eligible: false, reason: 'url is required' };
    }

    // All prerender suggestions with valid URLs are eligible
    return { eligible: true };
  }
}
