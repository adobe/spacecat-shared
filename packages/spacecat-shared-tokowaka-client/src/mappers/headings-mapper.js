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

    // Extract heading text - try multiple field names for backward compatibility
    const value = data?.recommendedAction
      || data?.value
      || data?.suggestedText
      || data?.text
      || data?.heading;

    // Extract selector - try headingTag first, then explicit selectors
    const headingTag = data?.headingTag;
    let selector = data?.selector || data?.cssSelector || data?.xpath;

    // If no explicit selector, construct from headingTag
    if (!selector && headingTag) {
      selector = headingTag;
    }

    if (!selector || !value) {
      this.log.warn(
        `Headings suggestion ${suggestion.getId()} missing required fields: `
        + `selector/headingTag=${selector}, value/recommendedAction=${value}`,
      );
      return null;
    }

    return {
      ...this.createBasePatch(suggestion.getId(), opportunityId),
      op: 'replace',
      selector,
      value,
    };
  }

  // eslint-disable-next-line class-methods-use-this
  validateSuggestionData(data) {
    // At minimum, need either headingTag/selector and recommendedAction/value
    const hasSelector = data?.headingTag || data?.selector
      || data?.cssSelector || data?.xpath;
    const hasValue = data?.recommendedAction || data?.value
      || data?.suggestedText || data?.text || data?.heading;
    return !!(hasSelector && hasValue);
  }
}
