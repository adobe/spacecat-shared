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
 * Dependency sources used by opportunities.
 * RUM          — Real User Monitoring (Adobe RUM / helix-rum-js)
 * SEOImport    — SEO import job (organic traffic, backlinks, keywords)
 * GSC          — Google Search Console import
 * scraping     — Page HTML scraping (spacecat-scraper / spacecat-content-scraper)
 * ExternalAPI  — Third-party API call at audit run-time (Wikipedia, Reddit, YouTube)
 * CrUX         — Chrome User Experience Report (field data from Google)
 * PSI          — PageSpeed Insights (lab data via Lighthouse API)
 */
export const DEPENDENCY_SOURCES = /** @type {const} */ ({
  RUM: 'RUM',
  SEO_IMPORT: 'SEOImport',
  GSC: 'GSC',
  SCRAPING: 'scraping',
  EXTERNAL_API: 'ExternalAPI',
  CRUX: 'CrUX',
  PSI: 'PSI',
});

/**
 * Maps each opportunity type to the data sources it requires to be populated.
 * A missing or empty import for any listed source means the opportunity
 * cannot be generated or will have incomplete data.
 *
 * Key:   opportunity type string
 * Value: array of DEPENDENCY_SOURCES values
 */
export const OPPORTUNITY_DEPENDENCY_MAP = {
  // Performance
  cwv: [DEPENDENCY_SOURCES.RUM, DEPENDENCY_SOURCES.CRUX, DEPENDENCY_SOURCES.PSI],
  prerender: [DEPENDENCY_SOURCES.SCRAPING],

  // SEO — traffic-driven
  'high-organic-low-ctr': [DEPENDENCY_SOURCES.RUM, DEPENDENCY_SOURCES.GSC],

  // SEO — link audits
  'broken-backlinks': [DEPENDENCY_SOURCES.SEO_IMPORT, DEPENDENCY_SOURCES.SCRAPING],
  'broken-internal-links': [DEPENDENCY_SOURCES.RUM, DEPENDENCY_SOURCES.SCRAPING],

  // SEO — on-page / content
  canonical: [DEPENDENCY_SOURCES.SCRAPING],
  hreflang: [DEPENDENCY_SOURCES.SCRAPING],
  'meta-tags': [DEPENDENCY_SOURCES.SEO_IMPORT, DEPENDENCY_SOURCES.SCRAPING],
  sitemap: [DEPENDENCY_SOURCES.SCRAPING],
  'sitemap-product-coverage': [DEPENDENCY_SOURCES.SEO_IMPORT, DEPENDENCY_SOURCES.SCRAPING],
  'structured-data': [DEPENDENCY_SOURCES.SCRAPING],
  'redirect-chains': [DEPENDENCY_SOURCES.SCRAPING],
  headings: [DEPENDENCY_SOURCES.SCRAPING],

  // Accessibility & content
  accessibility: [DEPENDENCY_SOURCES.SCRAPING],
  'alt-text': [DEPENDENCY_SOURCES.SEO_IMPORT, DEPENDENCY_SOURCES.SCRAPING],
  'no-cta-above-the-fold': [DEPENDENCY_SOURCES.RUM, DEPENDENCY_SOURCES.SCRAPING],
  readability: [DEPENDENCY_SOURCES.SCRAPING],

  // Forms
  'high-form-views-low-conversions': [DEPENDENCY_SOURCES.RUM],
  'high-page-views-low-form-nav': [DEPENDENCY_SOURCES.RUM],
  'high-page-views-low-form-views': [DEPENDENCY_SOURCES.RUM],
  'form-accessibility': [DEPENDENCY_SOURCES.RUM, DEPENDENCY_SOURCES.SCRAPING],

  // Commerce
  'product-metatags': [DEPENDENCY_SOURCES.SCRAPING],

  // Security
  'security-csp': [DEPENDENCY_SOURCES.SCRAPING],
  'security-vulnerabilities': [DEPENDENCY_SOURCES.SCRAPING],
  'security-permissions': [DEPENDENCY_SOURCES.SCRAPING],
  'security-permissions-redundant': [DEPENDENCY_SOURCES.SCRAPING],

  // LLMO / content quality
  'llm-blocked': [DEPENDENCY_SOURCES.SCRAPING],
  'llm-error-pages': [DEPENDENCY_SOURCES.SCRAPING],
  faqs: [DEPENDENCY_SOURCES.SCRAPING],
  'related-urls': [DEPENDENCY_SOURCES.SEO_IMPORT],
  toc: [DEPENDENCY_SOURCES.SCRAPING],

  // Experimentation (ESS signals — organic traffic + RUM)
  'experimentation-ess-daily': [DEPENDENCY_SOURCES.RUM, DEPENDENCY_SOURCES.GSC],
  'experimentation-ess-monthly': [DEPENDENCY_SOURCES.RUM, DEPENDENCY_SOURCES.GSC],

  // Offsite / brand analysis
  'cited-analysis': [DEPENDENCY_SOURCES.EXTERNAL_API],
  'wikipedia-analysis': [DEPENDENCY_SOURCES.EXTERNAL_API],
  'reddit-analysis': [DEPENDENCY_SOURCES.EXTERNAL_API],
  'youtube-analysis': [DEPENDENCY_SOURCES.EXTERNAL_API],
};

// ─── Query helpers ───────────────────────────────────────────────────────────

/**
 * Returns the required data sources for a given opportunity type.
 * @param {string} opportunityType
 * @returns {string[]}
 */
export function getDependenciesForOpportunity(opportunityType) {
  return OPPORTUNITY_DEPENDENCY_MAP[opportunityType] || [];
}

/**
 * Returns all opportunity types that depend on a given data source.
 * @param {string} source - One of DEPENDENCY_SOURCES values
 * @returns {string[]}
 */
export function getOpportunitiesForSource(source) {
  return Object.entries(OPPORTUNITY_DEPENDENCY_MAP)
    .filter(([, deps]) => deps.includes(source))
    .map(([opportunityType]) => opportunityType);
}
