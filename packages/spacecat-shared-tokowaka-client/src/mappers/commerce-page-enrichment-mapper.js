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

// Enrichment fields that map to schema.org Product top-level properties.
// Each entry: schemaKey → [enrichment field names in priority order]
const TOP_LEVEL_MAPPINGS = {
  sku: ['sku'],
  name: ['name'],
  material: ['material'],
  keywords: ['keywords'],
  color: ['color', 'variants.color'],
  size: ['size', 'variants.size'],
  description: ['description', 'pdp.description_plain', 'human_readable_summary'],
  category: ['category', 'facts.facets.category_path'],
};

function toSchemaOrgProduct(enrichmentData) {
  const product = {
    '@context': 'https://schema.org',
    '@type': 'Product',
  };
  const consumed = new Set();

  // Map top-level schema.org Product fields
  for (const [schemaKey, sourceKeys] of Object.entries(TOP_LEVEL_MAPPINGS)) {
    for (const key of sourceKeys) {
      if (key in enrichmentData && enrichmentData[key] != null) {
        consumed.add(key);
        let value = enrichmentData[key];

        if (schemaKey === 'category' && Array.isArray(value)) {
          value = value.join(' > ');
        }

        product[schemaKey] = value;
        break;
      }
    }
  }

  // Brand: wrap string in Brand object, pass objects through
  if ('brand' in enrichmentData && enrichmentData.brand != null) {
    consumed.add('brand');
    const brandValue = enrichmentData.brand;
    product.brand = typeof brandValue === 'object'
      ? brandValue
      : { '@type': 'Brand', name: brandValue };
  }

  // Everything else → additionalProperty as PropertyValue
  const additionalProperties = [];
  for (const [key, value] of Object.entries(enrichmentData)) {
    if (!consumed.has(key) && !EXCLUDED_FIELDS.has(key) && value != null) {
      additionalProperties.push({
        '@type': 'PropertyValue',
        name: key,
        value,
      });
    }
  }

  if (additionalProperties.length > 0) {
    product.additionalProperty = additionalProperties;
  }

  return product;
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
      const value = toSchemaOrgProduct(enrichmentData);

      patches.push({
        ...this.createBasePatch(suggestion, opportunityId),
        op: 'appendChild',
        selector: 'head',
        value,
        valueFormat: 'json',
        target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS,
        tag: 'script',
        attrs: { type: 'application/ld+json' },
      });
    });

    return patches;
  }
}
