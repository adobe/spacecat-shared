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

import { hasText } from '@adobe/spacecat-shared-utils';
import { TARGET_USER_AGENTS_CATEGORIES } from '../constants.js';
import BaseOpportunityMapper from './base-mapper.js';

const EXCLUDED_FIELDS = new Set([
  'rationale',
]);

function filterEnrichmentData(enrichmentData) {
  const filtered = {};
  for (const [key, value] of Object.entries(enrichmentData)) {
    if (!EXCLUDED_FIELDS.has(key) && value != null) {
      filtered[key] = value;
    }
  }
  return filtered;
}

export default class CommercePageEnrichmentMapper extends BaseOpportunityMapper {
  constructor(log) {
    super(log);
    this.opportunityType = 'commerce-product-page-enrichment';
    this.prerenderRequired = true;
  }

  getOpportunityType() {
    return this.opportunityType;
  }

  requiresPrerender() {
    return this.prerenderRequired;
  }

  // eslint-disable-next-line class-methods-use-this
  canDeploy(suggestion) {
    const data = suggestion.getData();

    if (!hasText(data?.patchValue)) {
      return { eligible: false, reason: 'patchValue is required' };
    }

    if (!hasText(data?.url)) {
      return { eligible: false, reason: 'url is required' };
    }

    try {
      JSON.parse(data.patchValue);
    } catch {
      return { eligible: false, reason: 'patchValue must be valid JSON' };
    }

    return { eligible: true };
  }

  suggestionsToPatches(urlPath, suggestions, opportunityId) {
    const patches = [];

    suggestions.forEach((suggestion) => {
      const eligibility = this.canDeploy(suggestion);
      if (!eligibility.eligible) {
        this.log.warn(`Commerce page enrichment suggestion ${suggestion.getId()} cannot be deployed: ${eligibility.reason}`);
        return;
      }

      const data = suggestion.getData();
      const enrichmentData = JSON.parse(data.patchValue);
      const value = filterEnrichmentData(enrichmentData);

      patches.push({
        ...this.createBasePatch(suggestion, opportunityId),
        op: 'appendChild',
        selector: 'head',
        value,
        valueFormat: 'json',
        target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS,
        tag: 'script',
        attrs: { type: 'application/json' },
      });
    });

    return patches;
  }
}
