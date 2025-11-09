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
    this.hasSinglePatchPerURL = true;
  }

  getOpportunityType() {
    return this.opportunityType;
  }

  requiresPrerender() {
    return this.prerenderRequired;
  }

  /**
   * FAQ mapper combines all suggestions into a single patch per URL
   * @returns {boolean} - Always true for FAQ
   */
  hasSinglePatchPerUrl() {
    return this.hasSinglePatchPerURL;
  }

  /**
  * Builds FAQ markdown from multiple suggestions
  * @param {Array} suggestions - Array of suggestion entities
  * @param {string} headingText - Heading text to use (e.g., "FAQs")
  * @returns {string} - Combined markdown text
  * @private
  */
  buildFaqMarkdown(suggestions, headingText) {
    const lines = [];

    // Add heading only once at the start
    if (hasText(headingText)) {
      lines.push(`## ${headingText}`);
      lines.push('');
    }

    // Add each FAQ item
    suggestions.forEach((suggestion) => {
      const data = suggestion.getData();
      const { item } = data;

      if (item?.question && item?.answer) {
        lines.push(`### ${item.question}`);
        lines.push('');
        lines.push(item.answer);
        lines.push('');
      }
    });
    this.log.debug(`FAQ markdown: ${lines.join('\n')}`);
    return lines.join('\n');
  }

  /**
  * Gets all deployed suggestions for a specific URL from all opportunity suggestions
  * @param {string} urlPath - URL path to filter by
  * @param {Array} allOpportunitySuggestions - All suggestions for the opportunity
  * @param {Array} excludeSuggestionIds - Suggestion IDs to exclude
  * @returns {Array} - Array of deployed suggestions for this URL path
  * @private
  */
  getDeployedSuggestionsForUrl(
    urlPath,
    allOpportunitySuggestions,
    excludeSuggestionIds = [],
  ) {
    if (!Array.isArray(allOpportunitySuggestions)) {
      return [];
    }

    return allOpportunitySuggestions.filter((suggestion) => {
      const suggestionId = suggestion.getId();
      const suggestionData = suggestion.getData();

      if (excludeSuggestionIds.includes(suggestionId)) {
        return false;
      }

      try {
        const suggestionUrlPath = new URL(suggestionData.url).pathname;
        if (suggestionUrlPath !== urlPath) {
          return false;
        }
      } catch (error) {
        return false;
      }

      return suggestionData?.tokowakaDeployed && this.canDeploy(suggestion).eligible === true;
    });
  }

  /**
  * Override to combine multiple FAQ suggestions for a URL into a single patch
  * Rebuilds complete FAQ section including previously deployed suggestions
  * @param {Array} suggestions - Array of suggestion entities for the same URL (to be deployed)
  * @param {string} opportunityId - Opportunity ID
  * @param {Array} allOpportunitySuggestions - All suggestions for the opportunity (optional)
  * @param {string} urlPath - URL path for current suggestions (optional)
  * @returns {Array} - Array with single patch object (or empty if all suggestions fail)
  */
  suggestionsToPatches(
    urlPath,
    suggestions,
    opportunityId,
    allOpportunitySuggestions,
  ) {
    if (!suggestions || suggestions.length === 0) {
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

    // Get URL and transformRules from first suggestion
    // (all should have same URL and transformRules)
    const firstSuggestion = eligibleSuggestions[0];
    const firstData = firstSuggestion.getData();
    const { url, headingText = 'FAQs', transformRules } = firstData;

    // Start with eligible suggestions (new ones to deploy)
    let allSuggestionsForUrl = [...eligibleSuggestions];

    // If we have all opportunity suggestions, add previously deployed ones
    // excluding the ones to be deployed
    if (Array.isArray(allOpportunitySuggestions)) {
      const deployedSuggestions = this.getDeployedSuggestionsForUrl(
        urlPath,
        allOpportunitySuggestions,
        [...eligibleSuggestions.map((s) => s.getId())],
      );

      if (deployedSuggestions.length > 0) {
        this.log.debug(`Found ${deployedSuggestions.length} previously deployed FAQ suggestions for ${url}`);
        // Add deployed suggestions BEFORE the new ones
        allSuggestionsForUrl = [...deployedSuggestions, ...eligibleSuggestions];
      }
    }

    // Build combined markdown from all suggestions (deployed + new)
    const combinedMarkdown = this.buildFaqMarkdown(allSuggestionsForUrl, headingText);

    // Convert markdown to HAST
    let hastValue;
    try {
      hastValue = markdownToHast(combinedMarkdown);
    } catch (error) {
      this.log.error(`Failed to convert FAQ markdown to HAST: ${error.message}`);
      return [];
    }

    // Create a single patch with combined suggestionIds as array
    const suggestionIds = allSuggestionsForUrl.map((s) => s.getId());
    const lastUpdated = Math.min(...allSuggestionsForUrl.map((s) => {
      const updatedAt = s.getUpdatedAt();
      return updatedAt ? new Date(updatedAt).getTime() : Date.now();
    }));

    return [{
      opportunityId,
      suggestionIds,
      prerenderRequired: this.requiresPrerender(),
      lastUpdated,
      op: transformRules.action,
      selector: transformRules.selector,
      value: hastValue,
      valueFormat: 'hast',
      target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS,
    }];
  }

  /**
   * Not supported in FAQ mapper. Added for compatibility with base class.
   * FAQ suggestions must be processed together to combine into a single
   * patch per URL. Use suggestionsToPatches instead.
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
