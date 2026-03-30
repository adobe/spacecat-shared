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

/**
 * Maps each audit type to the opportunity types it can generate.
 * Derived from the HANDLERS registry in spacecat-audit-worker/src/index.js.
 *
 * Audits that are data-collection only (e.g. apex, paid, lhs-mobile, cdn-logs-*)
 * and produce no opportunities are intentionally omitted.
 *
 * Key:   audit type string
 * Value: array of opportunity type strings produced by that audit
 */
export const AUDIT_OPPORTUNITY_MAP = {
  // Core SEO
  'broken-backlinks': ['broken-backlinks'],
  'broken-internal-links': ['broken-internal-links'],
  canonical: ['canonical'],
  hreflang: ['hreflang'],
  'meta-tags': ['meta-tags'],
  sitemap: ['sitemap'],
  'sitemap-product-coverage': ['sitemap-product-coverage'],
  'structured-data': ['structured-data'],
  'redirect-chains': ['redirect-chains'],

  // Performance
  cwv: ['cwv'],
  prerender: ['prerender'],

  // Accessibility & content
  accessibility: ['accessibility'],
  'alt-text': ['alt-text'],
  headings: ['headings'],
  'no-cta-above-the-fold': ['no-cta-above-the-fold'],
  readability: ['readability'],

  // Forms — one audit, multiple opportunity types
  'forms-opportunities': [
    'high-form-views-low-conversions',
    'high-page-views-low-form-nav',
    'high-page-views-low-form-views',
    'form-accessibility',
  ],

  // Experimentation
  'experimentation-opportunities': ['high-organic-low-ctr'],

  // Commerce
  'product-metatags': ['product-metatags'],

  // Security
  'security-csp': ['security-csp'],
  'security-vulnerabilities': ['security-vulnerabilities'],
  'security-permissions': ['security-permissions'],
  'security-permissions-redundant': ['security-permissions-redundant'],

  // LLMO / content quality
  'llm-blocked': ['llm-blocked'],
  'llm-error-pages': ['llm-error-pages'],
  faqs: ['faqs'],
  'related-urls': ['related-urls'],
  toc: ['toc'],

  // Experimentation (ESS signals)
  'experimentation-ess-daily': ['experimentation-ess-daily'],
  'experimentation-ess-monthly': ['experimentation-ess-monthly'],

  // Offsite / brand analysis
  'cited-analysis': ['cited-analysis'],
  'wikipedia-analysis': ['wikipedia-analysis'],
  'reddit-analysis': ['reddit-analysis'],
  'youtube-analysis': ['youtube-analysis'],
};

// ─── Query helpers ───────────────────────────────────────────────────────────

/**
 * Returns all opportunity types that a given audit type can generate.
 * @param {string} auditType
 * @returns {string[]}
 */
export function getOpportunitiesForAudit(auditType) {
  return AUDIT_OPPORTUNITY_MAP[auditType] || [];
}

/**
 * Returns all audit types that produce a given opportunity type.
 * @param {string} opportunityType
 * @returns {string[]}
 */
export function getAuditsForOpportunity(opportunityType) {
  return Object.entries(AUDIT_OPPORTUNITY_MAP)
    .filter(([, opps]) => opps.includes(opportunityType))
    .map(([auditType]) => auditType);
}

/**
 * Returns all unique opportunity types across all audits.
 * @returns {string[]}
 */
export function getAllOpportunityTypes() {
  return [...new Set(Object.values(AUDIT_OPPORTUNITY_MAP).flat())];
}

/**
 * Returns all audit types defined in the map.
 * @returns {string[]}
 */
export function getAllAuditTypes() {
  return Object.keys(AUDIT_OPPORTUNITY_MAP);
}
