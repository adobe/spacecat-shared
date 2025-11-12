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

import { hasText, isValidUrl } from '@adobe/spacecat-shared-utils';
import { TARGET_USER_AGENTS_CATEGORIES } from '../constants.js';
import BaseOpportunityMapper from './base-mapper.js';
import { markdownToHast } from '../utils/markdown-utils.js';

/**
* Mapper for FAQ opportunity
* Handles conversion of FAQ suggestions to Tokowaka patches
*/
export default class FaqMapper extends BaseOpportunityMapper {
  constructor(log) {
    super(log);
    this.opportunityType = 'faq';
    this.prerenderRequired = true;
    this.validActions = ['insertAfter', 'insertBefore', 'appendChild'];
  }

  getOpportunityType() {
    return this.opportunityType;
  }

  requiresPrerender() {
    return this.prerenderRequired;
  }

  /**
  * Builds FAQ item HTML structure (div with h3 and answer)
  * Structure: <div><h3>question</h3>answer-content</div>
  * @param {Object} suggestion - Suggestion entity
  * @returns {Object} - HAST object for the FAQ item
  * @private
  */
  // eslint-disable-next-line class-methods-use-this
  buildFaqItemHast(suggestion) {
    const data = suggestion.getData();
    const { item } = data;

    // Convert answer markdown to HAST
    const answerHast = markdownToHast(item.answer);

    // Build structure: <div><h3>question</h3>answer-hast-children</div>
    return {
      type: 'element',
      tagName: 'div',
      properties: {},
      children: [
        {
          type: 'element',
          tagName: 'h3',
          properties: {},
          children: [{ type: 'text', value: item.question }],
        },
        ...answerHast.children, // Spread answer HAST children directly
      ],
    };
  }

  /**
  * Checks if heading patch exists for this opportunity in existing config
  * @param {string} urlPath - URL path to check
  * @param {string} opportunityId - Opportunity ID
  * @param {Object} existingConfig - Existing Tokowaka config
  * @returns {boolean} - True if heading patch exists
  * @private
  */
  // eslint-disable-next-line class-methods-use-this
  hasHeadingPatch(urlPath, opportunityId, existingConfig) {
    if (!existingConfig?.tokowakaOptimizations) {
      return false;
    }

    const urlOptimizations = existingConfig.tokowakaOptimizations[urlPath];
    if (!urlOptimizations?.patches) {
      return false;
    }

    // Check if heading patch exists (no suggestionId, matches opportunityId)
    return urlOptimizations.patches.some(
      (patch) => patch.opportunityId === opportunityId && !patch.suggestionId,
    );
  }

  /**
  * Creates individual patches for FAQ suggestions
  * First patch is heading (h2) if it doesn't exist, then individual FAQ divs
  * @param {string} urlPath - URL path for current suggestions
  * @param {Array} suggestions - Array of suggestion entities for the same URL (to be deployed)
  * @param {string} opportunityId - Opportunity ID
  * @param {Object} existingConfig - Existing Tokowaka config (to check for heading)
  * @returns {Array} - Array of patch objects
  */
  suggestionsToPatches(
    urlPath,
    suggestions,
    opportunityId,
    existingConfig,
  ) {
    if (!urlPath || !Array.isArray(suggestions) || suggestions.length === 0) {
      this.log.error('Invalid parameters for FAQ mapper.suggestionsToPatches');
      return [];
    }

    // Filter eligible suggestions
    const eligibleSuggestions = suggestions.filter((suggestion) => {
      const eligibility = this.canDeploy(suggestion);
      if (!eligibility.eligible) {
        this.log.warn(`FAQ suggestion ${suggestion.getId()} cannot be deployed: ${eligibility.reason}`);
        return false;
      }
      return true;
    });

    if (eligibleSuggestions.length === 0) {
      this.log.warn('No eligible FAQ suggestions to deploy');
      return [];
    }

    const patches = [];

    // Get transformRules and headingText from first suggestion
    const firstSuggestion = eligibleSuggestions[0];
    const firstData = firstSuggestion.getData();
    const { headingText = 'FAQs', transformRules } = firstData;

    // Check if heading patch already exists
    const headingExists = this.hasHeadingPatch(urlPath, opportunityId, existingConfig);

    // Create heading patch if it doesn't exist
    if (!headingExists) {
      this.log.debug(`Creating heading patch for ${urlPath}`);

      const headingHast = {
        type: 'element',
        tagName: 'h2',
        properties: {},
        children: [{ type: 'text', value: headingText }],
      };

      patches.push({
        opportunityId,
        // No suggestionId for FAQ heading patch
        prerenderRequired: this.requiresPrerender(),
        lastUpdated: Date.now(),
        op: transformRules.action,
        selector: transformRules.selector,
        value: headingHast,
        valueFormat: 'hast',
        target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS,
      });
    }

    // Create individual FAQ patches
    eligibleSuggestions.forEach((suggestion) => {
      try {
        const faqItemHast = this.buildFaqItemHast(suggestion);

        const updatedAt = suggestion.getUpdatedAt();
        const lastUpdated = updatedAt ? new Date(updatedAt).getTime() : Date.now();

        patches.push({
          opportunityId,
          suggestionId: suggestion.getId(),
          prerenderRequired: this.requiresPrerender(),
          lastUpdated,
          op: transformRules.action,
          selector: transformRules.selector,
          value: faqItemHast,
          valueFormat: 'hast',
          target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS,
        });
      } catch (error) {
        this.log.error(`Failed to build FAQ HAST for suggestion ${suggestion.getId()}: ${error.message}`);
      }
    });

    return patches;
  }

  /**
  * Not supported in FAQ mapper. Added for compatibility with base class.
  * FAQ suggestions must be processed together to determine if they are
  * the first FAQ for a URL. Use suggestionsToPatches instead.
  * @throws {Error} Always throws - use suggestionsToPatches instead
  * @see suggestionsToPatches
  */
  suggestionToPatch() {
    this.log.error('FAQ mapper does not support suggestionToPatch, use suggestionsToPatches instead');
    throw new Error('FAQ mapper does not support suggestionToPatch, use suggestionsToPatches instead');
  }

  /**
  * Checks if a FAQ suggestion can be deployed
  * @param {Object} suggestion - Suggestion object
  * @returns {Object} { eligible: boolean, reason?: string }
  */
  canDeploy(suggestion) {
    const data = suggestion.getData();

    // Check shouldOptimize flag first
    if (data?.shouldOptimize === false) {
      return { eligible: false, reason: 'shouldOptimize flag is false' };
    }

    if (!data?.item?.question || !data?.item?.answer) {
      return { eligible: false, reason: 'item.question and item.answer are required' };
    }

    if (!data.transformRules) {
      return { eligible: false, reason: 'transformRules is required' };
    }

    if (!hasText(data.transformRules.selector)) {
      return { eligible: false, reason: 'transformRules.selector is required' };
    }

    if (!this.validActions.includes(data.transformRules.action)) {
      return { eligible: false, reason: 'transformRules.action must be insertAfter, insertBefore, or appendChild' };
    }

    if (!isValidUrl(data.url)) {
      return { eligible: false, reason: `url ${data.url} is not a valid URL` };
    }

    return { eligible: true };
  }
}
