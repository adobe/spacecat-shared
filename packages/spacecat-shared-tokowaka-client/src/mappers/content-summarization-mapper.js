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

import { toHast } from 'mdast-util-to-hast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { hasText } from '@adobe/spacecat-shared-utils';
import { TARGET_USER_AGENTS_CATEGORIES } from '../constants.js';
import BaseOpportunityMapper from './base-mapper.js';

/**
 * Mapper for content opportunity
 * Handles conversion of content summarization suggestions to Tokowaka patches
 */
export default class ContentSummarizationMapper extends BaseOpportunityMapper {
  constructor(log) {
    super(log);
    this.opportunityType = 'summarization';
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
   * Converts markdown text to HAST (Hypertext Abstract Syntax Tree) format
   * @param {string} markdown - Markdown text
   * @returns {Object} - HAST object
   */
  // eslint-disable-next-line class-methods-use-this
  markdownToHast(markdown) {
    const mdast = fromMarkdown(markdown);
    return toHast(mdast);
  }

  suggestionToPatch(suggestion, opportunityId) {
    const eligibility = this.canDeploy(suggestion);
    if (!eligibility.eligible) {
      this.log.warn(`Content-Summarization suggestion ${suggestion.getId()} cannot be deployed: ${eligibility.reason}`);
      return null;
    }

    const data = suggestion.getData();
    const { summarizationText, transformRules } = data;

    // Convert markdown to HAST
    let hastValue;
    try {
      hastValue = this.markdownToHast(summarizationText);
    } catch (error) {
      this.log.error(`Failed to convert markdown to HAST for suggestion ${suggestion.getId()}: ${error.message}`);
      return null;
    }

    return {
      ...this.createBasePatch(suggestion, opportunityId),
      op: transformRules.action,
      selector: transformRules.selector,
      value: hastValue,
      valueFormat: 'hast',
      target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS,
    };
  }

  /**
   * Checks if a content suggestion can be deployed
   * @param {Object} suggestion - Suggestion object
   * @returns {Object} { eligible: boolean, reason?: string }
   */
  canDeploy(suggestion) {
    const data = suggestion.getData();

    // Validate required fields
    if (!data?.summarizationText) {
      return { eligible: false, reason: 'summarizationText is required' };
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

    return { eligible: true };
  }
}
