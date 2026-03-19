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
import { htmlToHast } from '../utils/html-utils.js';

const EXCLUDED_FIELDS = new Set([
  'rationale',
]);

// Fields rendered in fixed order at the top of the article.
// Each entry: CSS class, display label, [source keys in priority order]
const ORDERED_FIELDS = [
  { cls: 'category', sources: ['facts.facets.category_path', 'category'] },
  { cls: 'description', sources: ['pdp.description_plain', 'description'] },
  { cls: 'features', sources: ['pdp.feature_bullets'] },
  { cls: 'variants', sources: ['facts.variants.summary'] },
];

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sanitizeClassName(key) {
  return key
    .replace(/^(pdp\.|facts\.facets\.|facts\.variants\.|facts\.attributes\.)/, '')
    .replace(/[^a-z0-9-]/gi, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function renderCategoryPath(value) {
  if (Array.isArray(value)) {
    return escapeHtml(value.join(' \u203A '));
  }
  return escapeHtml(String(value));
}

function renderList(items, cls) {
  const lis = items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join('');
  return `<ul class="${cls}">${lis}</ul>`;
}

function renderValue(key, value, cls) {
  if (value == null) return '';

  if (key === 'facts.facets.category_path' || key === 'category') {
    return `<p class="${cls}">${renderCategoryPath(value)}</p>`;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return renderList(value, cls);
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value).filter(([, v]) => v != null && v !== '');
    if (entries.length === 0) return '';
    const items = entries.map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(String(v))}`);
    return renderList(items, cls);
  }

  const str = String(value);
  if (!str) return '';
  return `<p class="${cls}">${escapeHtml(str)}</p>`;
}

function enrichmentToHtml(enrichmentData) {
  const sku = enrichmentData.sku || '';
  const consumed = new Set(['sku', ...EXCLUDED_FIELDS]);
  const parts = [];

  // Render ordered fields first
  for (const { cls, sources } of ORDERED_FIELDS) {
    let matched = false;
    for (const sourceKey of sources) {
      if (!matched && sourceKey in enrichmentData && enrichmentData[sourceKey] != null) {
        const html = renderValue(sourceKey, enrichmentData[sourceKey], cls);
        if (html) {
          parts.push(html);
          matched = true;
        }
      }
    }
    // Consume all sources in the group so alternatives don't appear in remaining fields
    for (const sourceKey of sources) {
      consumed.add(sourceKey);
    }
  }

  // Render remaining fields in document order
  for (const [key, value] of Object.entries(enrichmentData)) {
    if (consumed.has(key)) {
      // eslint-disable-next-line no-continue
      continue;
    }
    const cls = sanitizeClassName(key);
    const html = renderValue(key, value, cls);
    if (html) {
      parts.push(html);
    }
  }

  const skuAttr = sku ? ` data-sku="${escapeHtml(sku)}"` : '';
  return `<div data-enrichment="spacecat"${skuAttr}><article>${parts.join('')}</article></div>`;
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
      const html = enrichmentToHtml(enrichmentData);
      const value = htmlToHast(html);

      patches.push({
        ...this.createBasePatch(suggestion, opportunityId),
        op: 'appendChild',
        selector: 'body',
        value,
        valueFormat: 'hast',
        target: TARGET_USER_AGENTS_CATEGORIES.AI_BOTS,
      });
    });

    return patches;
  }
}
