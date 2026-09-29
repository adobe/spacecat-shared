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

export const OPPORTUNITY_TYPES = /** @type {const} */ ({
  // Core Audit Types
  ACCESSIBILITY: 'accessibility',
  ALT_TEXT: 'alt-text',
  BROKEN_BACKLINKS: 'broken-backlinks',
  BROKEN_INTERNAL_LINKS: 'broken-internal-links',
  CANONICAL: 'canonical',
  CWV: 'cwv',
  HEADINGS: 'headings',
  HREFLANG: 'hreflang',
  INVALID_OR_MISSING_METADATA: 'meta-tags',
  NOTFOUND: '404',
  PRERENDER: 'prerender',
  SECURITY_CSP: 'security-csp',
  SECURITY_VULNERABILITIES: 'security-vulnerabilities',
  SITEMAP: 'sitemap',
  STRUCTURED_DATA: 'structured-data',

  // Custom Audit Types (not in shared AUDIT_TYPES)
  LLM_BLOCKED: 'llm-blocked',
  LLM_ERROR_PAGES_404: 'llm-error-pages-404',
  LLM_ERROR_PAGES_403: 'llm-error-pages-403',
  LLM_ERROR_PAGES_5XX: 'llm-error-pages-5xx',
  REDIRECT_CHAINS: 'redirect-chains',
  SECURITY_PERMISSIONS: 'security-permissions',
  SECURITY_PERMISSIONS_REDUNDANT: 'security-permissions-redundant',
  SITEMAP_PRODUCT_COVERAGE: 'sitemap-product-coverage',

  // Experimentation Opportunities
  HIGH_ORGANIC_LOW_CTR: 'high-organic-low-ctr',
  RAGECLICK: 'rageclick',
  HIGH_INORGANIC_HIGH_BOUNCE_RATE: 'high-inorganic-high-bounce-rate',

  // Forms Opportunities
  HIGH_FORM_VIEWS_LOW_CONVERSIONS: 'high-form-views-low-conversions',
  HIGH_PAGE_VIEWS_LOW_FORM_NAV: 'high-page-views-low-form-nav',
  HIGH_PAGE_VIEWS_LOW_FORM_VIEWS: 'high-page-views-low-form-views',
  FORM_ACCESSIBILITY: 'form-accessibility',

  // Geo Brand Presence
  DETECT_GEO_BRAND_PRESENCE: 'detect:geo-brand-presence',
  DETECT_GEO_BRAND_PRESENCE_DAILY: 'detect:geo-brand-presence-daily',
  GEO_BRAND_PRESENCE_TRIGGER_REFRESH: 'geo-brand-presence-trigger-refresh',
  GUIDANCE_GEO_FAQ: 'guidance:geo-faq',

  // Accessibility Sub-types
  A11Y_ASSISTIVE: 'a11y-assistive',
  COLOR_CONTRAST: 'a11y-color-contrast',

  // Security
  SECURITY_XSS: 'security-xss',

  // Generic Opportunity
  GENERIC_OPPORTUNITY: 'generic-opportunity',

  // Paid Cookie Consent
  PAID_COOKIE_CONSENT: 'paid-cookie-consent',

  // Offsite Analysis (LLMO)
  CITED_ANALYSIS: 'cited-analysis',
  REDDIT_ANALYSIS: 'reddit-analysis',
  WIKIPEDIA_ANALYSIS: 'wikipedia-analysis',
  YOUTUBE_ANALYSIS: 'youtube-analysis',
  INFO_GAIN: 'info-gain',
});

export const DEFAULT_CPC_VALUE = 1.5;

/**
 * Kinds of source text in `opportunity_semantic_embedding.source_type`. The semantic lookup writer
 * and reader reject any other value; add a kind here before indexing or searching it.
 */
export const OPPORTUNITY_SEMANTIC_SOURCE_TYPES = Object.freeze({
  TOPIC: 'topic',
});

/**
 * Opportunity types allowed in `opportunity_semantic_embedding.entity_type`. The writer and reader
 * reject any other value; add a type here before indexing or filtering by it.
 */
export const OPPORTUNITY_SEMANTIC_ENTITY_TYPES = Object.freeze({
  CITED_ANALYSIS: OPPORTUNITY_TYPES.CITED_ANALYSIS,
  REDDIT_ANALYSIS: OPPORTUNITY_TYPES.REDDIT_ANALYSIS,
  YOUTUBE_ANALYSIS: OPPORTUNITY_TYPES.YOUTUBE_ANALYSIS,
});

/**
 * Kinds of source text in `suggestion_semantic_embedding.source_type`: the suggestion's derived
 * topics and its title. Same enforcement as `OPPORTUNITY_SEMANTIC_SOURCE_TYPES`.
 */
export const SUGGESTION_SEMANTIC_SOURCE_TYPES = Object.freeze({
  TOPIC: 'topic',
  TITLE: 'title',
});

/**
 * Parent opportunity types allowed in `suggestion_semantic_embedding.entity_type`. Same
 * enforcement as `OPPORTUNITY_SEMANTIC_ENTITY_TYPES`.
 */
export const SUGGESTION_SEMANTIC_ENTITY_TYPES = Object.freeze({
  CITED_ANALYSIS: OPPORTUNITY_TYPES.CITED_ANALYSIS,
  REDDIT_ANALYSIS: OPPORTUNITY_TYPES.REDDIT_ANALYSIS,
  YOUTUBE_ANALYSIS: OPPORTUNITY_TYPES.YOUTUBE_ANALYSIS,
});
