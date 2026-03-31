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
 * Human-readable display titles for each opportunity type.
 *
 * Key:   opportunity type string
 * Value: display title string
 */
export const OPPORTUNITY_TITLES = {
  // Performance
  cwv: 'Core Web Vitals',
  prerender: 'Prerender',

  // Core SEO
  'broken-backlinks': 'Broken Backlinks',
  'broken-internal-links': 'Broken Internal Links',
  canonical: 'Canonical',
  hreflang: 'Hreflang',
  'meta-tags': 'SEO Meta Tags',
  sitemap: 'Sitemap',
  'sitemap-product-coverage': 'Sitemap Product Coverage',
  'structured-data': 'Structured Data',
  'redirect-chains': 'Redirect Chains',

  // Accessibility & content
  accessibility: 'Accessibility',
  'alt-text': 'Alt Text',
  headings: 'Headings',
  'no-cta-above-the-fold': 'No CTA Above the Fold',
  readability: 'Readability',

  // Forms
  'high-form-views-low-conversions': 'High Form Views Low Conversions',
  'high-page-views-low-form-nav': 'High Page Views Low Form Navigation',
  'high-page-views-low-form-views': 'High Page Views Low Form Views',
  'form-accessibility': 'Form Accessibility',

  // Experimentation
  'high-organic-low-ctr': 'High Organic Low CTR',

  // Commerce
  'product-metatags': 'Product Meta Tags',

  // Security
  'security-csp': 'Security CSP',
  'security-vulnerabilities': 'Security Vulnerabilities',
  'security-permissions': 'Security Permissions',
  'security-permissions-redundant': 'Security Permissions Redundant',

  // LLMO / content quality
  'llm-blocked': 'LLM Blocked',
  'llm-error-pages': 'LLM Error Pages',
  faqs: 'FAQs',
  'related-urls': 'Related URLs',
  toc: 'Table of Contents',

  // Experimentation (ESS signals)
  'experimentation-ess-daily': 'Experimentation ESS Daily',
  'experimentation-ess-monthly': 'Experimentation ESS Monthly',

  // Offsite / brand analysis
  'cited-analysis': 'Cited Analysis',
  'wikipedia-analysis': 'Wikipedia Analysis',
  'reddit-analysis': 'Reddit Analysis',
  'youtube-analysis': 'YouTube Analysis',
};

/**
 * Returns the human-readable title for a given opportunity type.
 * Falls back to converting kebab-case to Title Case for unknown types.
 * @param {string} opportunityType
 * @returns {string}
 */
export function getOpportunityTitle(opportunityType) {
  return OPPORTUNITY_TITLES[opportunityType]
    ?? opportunityType
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
}
