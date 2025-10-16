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

import BaseOpportunityMapper from './base-mapper.js';

/**
 * Mapper for headings opportunity
 * Handles conversion of heading suggestions to Tokowaka patches
 */
export default class HeadingsMapper extends BaseOpportunityMapper {
  // eslint-disable-next-line class-methods-use-this
  getOpportunityType() {
    return 'headings';
  }

  // eslint-disable-next-line class-methods-use-this
  requiresPrerender() {
    return true;
  }

  suggestionToPatch(suggestion, opportunityId) {
    const data = suggestion.getData();

    if (!this.validateSuggestionData(data)) {
      this.log.warn(`Headings suggestion ${suggestion.getId()} has invalid data`);
      return null;
    }

    // Use path if available, otherwise construct from headingTag
    const selector = data.path || data.headingTag;

    return {
      ...this.createBasePatch(suggestion.getId(), opportunityId),
      op: 'replace',
      selector,
      value: data.recommendedAction,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  validateSuggestionData(data) {
    // At minimum, need heading selector (path or headingTag) and recommendedAction/value
    const hasSelector = data?.path || data?.headingTag;
    const hasValue = data?.recommendedAction;
    return !!(hasSelector && hasValue);
  }

  /**
   * Checks if a heading suggestion can be deployed
   * Only empty headings are eligible for deployment
   * @param {Object} suggestion - Suggestion object
   * @returns {Object} { eligible: boolean, reason?: string }
   */
  // eslint-disable-next-line class-methods-use-this
  canDeploy(suggestion) {
    const data = suggestion.getData();
    const checkType = data?.checkType;

    if (checkType !== 'heading-empty') {
      return {
        eligible: false,
        reason: `Only empty headings can be deployed. This suggestion has checkType: ${checkType}`,
      };
    }

    return { eligible: true };
  }
}
