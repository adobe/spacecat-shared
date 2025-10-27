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

const OPPORTUNITY_TYPES = {
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
};

/**
 * Default CPC (Cost Per Click) value in dollars used when Ahrefs organic traffic data
 * is not available or invalid.
 */
const DEFAULT_CPC_VALUE = 1.5;

export {
  OPPORTUNITY_TYPES,
  DEFAULT_CPC_VALUE,
};
