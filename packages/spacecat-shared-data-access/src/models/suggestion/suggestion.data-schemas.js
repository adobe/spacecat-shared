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

/**
 * @fileoverview Type-specific data schemas for suggestion opportunity types.
 * Defines validation schemas and projection configurations.
 *
 * Validation schemas should be used in audit-worker when creating/updating suggestions
 * to ensure data structure consistency before writing to the database.
 *
 * Each schema defines:
 * - Required fields (those in minimal projection) used for listing page in ASO UI
 * - Optional fields for additional data
 * - Projection configurations for minimal views
 */

import Joi from 'joi';
import { OPPORTUNITY_TYPES } from '@adobe/spacecat-shared-utils';

/**
 * Data schemas configuration per opportunity type.
 *
 * @typedef {Object} OpportunityTypeSchema
 * @property {import('joi').Schema} schema - Joi validation schema for the data field
 * @property {Object} projections - Projection configurations
 * @property {Object} projections.minimal - Minimal view configuration
 * @property {string[]} projections.minimal.fields - Fields to include in minimal view
 * @property {Object<string, string>} projections.minimal.transformers - Field transformers to apply
 *
 * @type {Object<string, OpportunityTypeSchema>}
 *
 * @example Adding a new opportunity type
 * [OPPORTUNITY_TYPES.YOUR_TYPE]: {
 *   schema: Joi.object({
 *     url: Joi.string().uri().required(),        // Required - in minimal view
 *     customField: Joi.string().required(),      // Required - in minimal view
 *     optionalField: Joi.string().optional()     // Optional - not in minimal view
 *   }).unknown(true),
 *   projections: {
 *     minimal: {
 *       fields: ['url', 'customField'],
 *       transformers: { customField: 'myTransformerName' }
 *     }
 *   }
 * }
 */
export const DATA_SCHEMAS = {
  [OPPORTUNITY_TYPES.STRUCTURED_DATA]: {
    schema: Joi.object({
      url: Joi.string().uri().required(),
      type: Joi.string().optional(),
      errors: Joi.array().items(Joi.object()).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.COLOR_CONTRAST]: {
    schema: Joi.object({
      type: Joi.string().optional(),
      url: Joi.string().uri().required(),
      issues: Joi.array().items(
        Joi.object({
          wcagLevel: Joi.string().optional(),
          severity: Joi.string().optional(),
          occurrences: Joi.number().optional(),
          htmlWithIssues: Joi.array().items(Joi.object()).optional(),
          failureSummary: Joi.string().optional(),
          wcagRule: Joi.string().optional(),
          description: Joi.string().optional(),
          type: Joi.string().optional(),
        }).unknown(true),
      ).required(),
      jiraLink: Joi.string().uri().allow(null).optional(),
      aggregationKey: Joi.string().optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url', 'issues'],
        transformers: {
          issues: 'filterIssuesOccurrences',
        },
      },
    },
  },
  [OPPORTUNITY_TYPES.A11Y_ASSISTIVE]: {
    schema: Joi.object({
      type: Joi.string().optional(),
      url: Joi.string().uri().required(),
      issues: Joi.array().items(
        Joi.object({
          wcagLevel: Joi.string().optional(),
          severity: Joi.string().optional(),
          occurrences: Joi.number().optional(),
          htmlWithIssues: Joi.array().items(Joi.object()).optional(),
          failureSummary: Joi.string().optional(),
          wcagRule: Joi.string().optional(),
          description: Joi.string().optional(),
          type: Joi.string().optional(),
        }).unknown(true),
      ).required(),
      jiraLink: Joi.string().uri().allow(null).optional(),
      aggregationKey: Joi.string().optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url', 'issues'],
        transformers: {
          issues: 'filterIssuesOccurrences',
        },
      },
    },
  },
  [OPPORTUNITY_TYPES.CWV]: {
    schema: Joi.object({
      type: Joi.string().required(),
      url: Joi.string().uri().required(),
      pageviews: Joi.number().optional(),
      organic: Joi.number().optional(),
      metrics: Joi.array().items(
        Joi.object({
          deviceType: Joi.string().optional(),
          pageviews: Joi.number().optional(),
          clsCount: Joi.number().optional(),
          ttfbCount: Joi.number().optional(),
          lcp: Joi.number().optional(),
          inpCount: Joi.number().optional(),
          inp: Joi.number().optional(),
          ttfb: Joi.number().optional(),
          cls: Joi.number().optional(),
          lcpCount: Joi.number().optional(),
          organic: Joi.number().optional(),
        }).unknown(true),
      ).required(),
      issues: Joi.array().items(Joi.object()).required(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url', 'type', 'metrics', 'issues'],
        transformers: {
          metrics: 'filterCwvMetrics',
        },
      },
    },
  },
  [OPPORTUNITY_TYPES.ALT_TEXT]: {
    schema: Joi.object({
      recommendations: Joi.array().items(
        Joi.object({
          isAppropriate: Joi.boolean().optional(),
          isDecorative: Joi.boolean().optional(),
          xpath: Joi.string().optional(),
          altText: Joi.string().optional(),
          imageUrl: Joi.string().uri().optional(),
          pageUrl: Joi.string().uri().optional(),
          language: Joi.string().optional(),
          id: Joi.string().optional(),
        }).unknown(true),
      ).required(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['recommendations'],
        transformers: {
          recommendations: 'extractPageUrlFromRecommendations',
        },
      },
    },
  },
  [OPPORTUNITY_TYPES.SECURITY_PERMISSIONS]: {
    schema: Joi.object({
      principal: Joi.string().optional(),
      path: Joi.string().required(),
      issue: Joi.string().optional(),
      permissions: Joi.array().items(Joi.string()).optional(),
      recommended_permissions: Joi.array().items(Joi.string()).optional(),
      acl: Joi.array().items(Joi.string()).optional(),
      otherPermissions: Joi.array().optional(),
      rationale: Joi.string().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['path'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.SECURITY_VULNERABILITIES]: {
    schema: Joi.object({
      current_version: Joi.string().optional(),
      library: Joi.string().optional(),
      recommended_version: Joi.string().allow(null).optional(),
      cves: Joi.array().items(
        Joi.object({
          summary: Joi.string().optional(),
          score: Joi.number().optional(),
          score_text: Joi.string().optional(),
          cve_id: Joi.string().optional(),
          url: Joi.string().uri().optional(),
        }).unknown(true),
      ).required(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['cves'],
        transformers: {
          cves: 'extractCveUrls',
        },
      },
    },
  },
  [OPPORTUNITY_TYPES.FORM_ACCESSIBILITY]: {
    schema: Joi.object({
      source: Joi.string().required(),
      type: Joi.string().optional(),
      aiGenerated: Joi.boolean().optional(),
      url: Joi.string().uri().required(),
      issues: Joi.array().items(
        Joi.object({
          wcagLevel: Joi.string().optional(),
          severity: Joi.string().optional(),
          occurrences: Joi.number().optional(),
          htmlWithIssues: Joi.array().items(Joi.object()).optional(),
          failureSummary: Joi.string().optional(),
          wcagRule: Joi.string().optional(),
          understandingUrl: Joi.string().uri().optional(),
          description: Joi.string().optional(),
          type: Joi.string().optional(),
        }).unknown(true),
      ).required(),
      jiraLink: Joi.string().uri().allow(null).optional(),
      isCodeChangeAvailable: Joi.boolean().optional(),
      patchContent: Joi.string().optional(),
      aggregationKey: Joi.string().optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url', 'source', 'issues'],
        transformers: {
          issues: 'filterIssuesOccurrences',
        },
      },
    },
  },
  [OPPORTUNITY_TYPES.CANONICAL]: {
    schema: Joi.object({
      url: Joi.string().uri().required(),
      checkType: Joi.string().optional(),
      type: Joi.string().optional(),
      suggestion: Joi.string().optional(),
      recommendedAction: Joi.string().optional(),
      explanation: Joi.string().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.HEADINGS]: {
    schema: Joi.object({
      url: Joi.string().uri().required(),
      type: Joi.string().optional(),
      checkType: Joi.string().optional(),
      explanation: Joi.string().optional(),
      recommendedAction: Joi.string().optional(),
      checkTitle: Joi.string().optional(),
      isAISuggested: Joi.boolean().optional(),
      transformRules: Joi.object().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.HREFLANG]: {
    schema: Joi.object({
      url: Joi.string().uri().required(),
      type: Joi.string().optional(),
      checkType: Joi.string().optional(),
      explanation: Joi.string().optional(),
      recommendedAction: Joi.string().optional(),
      suggestion: Joi.string().allow(null).optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.INVALID_OR_MISSING_METADATA]: {
    schema: Joi.object({
      url: Joi.string().uri().required(),
      tagName: Joi.string().optional(),
      issue: Joi.string().optional(),
      tagContent: Joi.string().allow('', null).optional(),
      rank: Joi.number().optional(),
      seoRecommendation: Joi.string().optional(),
      issueDetails: Joi.string().optional(),
      seoImpact: Joi.string().optional(),
      aiRationale: Joi.string().optional(),
      aiSuggestion: Joi.string().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.SITEMAP]: {
    schema: Joi.object({
      sitemapUrl: Joi.string().uri().required(),
      pageUrl: Joi.string().uri().required(),
      type: Joi.string().valid('url', 'error').optional(),
      statusCode: Joi.number().optional(),
      urlsSuggested: Joi.string().uri().optional(),
      recommendedAction: Joi.string().optional(),
      error: Joi.string().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['sitemapUrl', 'pageUrl'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.BROKEN_BACKLINKS]: {
    schema: Joi.object({
      url_from: Joi.string().uri().optional(),
      urlFrom: Joi.string().uri().optional(),
      url_to: Joi.string().uri().optional(),
      urlTo: Joi.string().uri().optional(),
      title: Joi.string().optional(),
      traffic_domain: Joi.number().optional(),
      aiRationale: Joi.string().optional(),
      urlsSuggested: Joi.array().items(Joi.string().uri()).optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    })
      .or('url_from', 'urlFrom') // At least one of these must be present
      .or('url_to', 'urlTo') // At least one of these must be present
      .unknown(true),
    projections: {
      minimal: {
        fields: ['url_from', 'url_to', 'urlFrom', 'urlTo'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.BROKEN_INTERNAL_LINKS]: {
    schema: Joi.object({
      // Support both naming conventions (snake_case and camelCase)
      url_from: Joi.string().uri().optional(),
      urlFrom: Joi.string().uri().optional(),
      url_to: Joi.string().uri().optional(),
      urlTo: Joi.string().uri().optional(),
      title: Joi.string().optional(),
      urlsSuggested: Joi.array().items(Joi.string().uri()).optional(),
      aiRationale: Joi.string().optional(),
      trafficDomain: Joi.number().optional(),
      priority: Joi.string().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    })
      .or('url_from', 'urlFrom') // At least one of these must be present
      .or('url_to', 'urlTo') // At least one of these must be present
      .unknown(true),
    projections: {
      minimal: {
        fields: ['url_from', 'url_to', 'urlFrom', 'urlTo'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.PRERENDER]: {
    schema: Joi.object({
      url: Joi.string().uri().required(),
      contentGainRatio: Joi.number().optional(),
      wordCountBefore: Joi.number().optional(),
      wordCountAfter: Joi.number().optional(),
      originalHtmlKey: Joi.string().optional(),
      prerenderedHtmlKey: Joi.string().optional(),
      organicTraffic: Joi.number().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.HIGH_ORGANIC_LOW_CTR]: {
    schema: Joi.object({
      url: Joi.string().uri().optional(),
      clicks: Joi.number().optional(),
      impressions: Joi.number().optional(),
      ctr: Joi.number().optional(),
      position: Joi.number().optional(),
      variations: Joi.array().items(
        Joi.object({
          id: Joi.string().optional(),
          name: Joi.string().optional(),
          screenshotUrl: Joi.string().uri().optional(),
          variationPageUrl: Joi.string().uri().optional(),
          variationEditPageUrl: Joi.string().uri().allow(null).optional(),
          variationMdPageUrl: Joi.string().uri().allow(null).optional(),
          previewImage: Joi.string().uri().optional(),
          explanation: Joi.string().allow(null).optional(),
          projectedImpact: Joi.number().optional(),
          changes: Joi.array().optional(),
          variationChanges: Joi.object({
            changes: Joi.object({
              type: Joi.string().optional(),
              mdUrl: Joi.string().uri().optional(),
              md: Joi.string().optional(),
            }).unknown(true).optional(),
          }).unknown(true).optional(),
        }).unknown(true),
      ).optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: [],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.LLM_BLOCKED]: {
    schema: Joi.object({
      affectedUserAgents: Joi.array().items(Joi.string()).optional(),
      lineNumber: Joi.number().optional(),
      items: Joi.array().items(
        Joi.object({
          url: Joi.string().uri().optional(),
          agent: Joi.string().optional(),
        }).unknown(true),
      ).optional(),
      robotsTxtHash: Joi.string().optional(),
      url: Joi.string().uri().optional(),
      pattern: Joi.string().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: [],
        transformers: {},
      },
    },
  },
  // ========== SCHEMAS NEED VALIDATION ==========
  // The following schemas exist (taken from audit-worker structure) but have NOT been
  // validated against actual suggestion data yet.
  //
  // TODO: When these opportunity types generate suggestions:
  //   1. Validate the schema against real suggestion data
  //   2. Update minimal projection fields to match actual requirements
  //   3. Add Suggestion.validateData() call in audit-worker when creating suggestions
  //   4. Make required fields properly marked based on minimal projection
  //
  // Schemas needing validation:
  // - SITEMAP_PRODUCT_COVERAGE
  // - REDIRECT_CHAINS
  [OPPORTUNITY_TYPES.SITEMAP_PRODUCT_COVERAGE]: {
    schema: Joi.object({
      locale: Joi.string().optional(),
      url: Joi.string().uri().optional(),
      recommendedAction: Joi.string().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['url'],
        transformers: {},
      },
    },
  },
  [OPPORTUNITY_TYPES.REDIRECT_CHAINS]: {
    schema: Joi.object({
      key: Joi.string().optional(),
      fixType: Joi.string().optional(),
      fix: Joi.string().optional(),
      canApplyFixAutomatically: Joi.boolean().optional(),
      redirectsFile: Joi.string().optional(),
      redirectCount: Joi.number().optional(),
      httpStatusCode: Joi.number().optional(),
      sourceUrl: Joi.string().uri().optional(),
      sourceUrlFull: Joi.string().uri().optional(),
      destinationUrl: Joi.string().uri().optional(),
      destinationUrlFull: Joi.string().uri().optional(),
      finalUrl: Joi.string().uri().optional(),
      finalUrlFull: Joi.string().uri().optional(),
      ordinalDuplicate: Joi.number().optional(),
      redirectChain: Joi.array().items(Joi.object()).optional(),
      errorMsg: Joi.string().optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['sourceUrl', 'destinationUrl', 'finalUrl'],
        transformers: {},
      },
    },
  },

  // consent-banner opportunity type.
  // Note: The DB stores opportunity type as 'consent-banner', NOT the OPPORTUNITY_TYPES
  // constant PAID_COOKIE_CONSENT ('paid-cookie-consent'). Using string literal to match DB.
  'consent-banner': {
    schema: Joi.object({
      mobile: Joi.string().allow(null).optional(),
      desktop: Joi.string().allow(null).optional(),
      recommendations: Joi.array().items(
        Joi.object({
          pageUrl: Joi.string().uri().optional(),
          id: Joi.string().optional(),
        }).unknown(true),
      ).optional(),
      impact: Joi.object({
        business: Joi.string().allow(null).optional(),
        user: Joi.string().allow(null).optional(),
      }).unknown(true).optional(),
      aggregationKey: Joi.string().allow(null).optional(),
    }).unknown(true),
    projections: {
      minimal: {
        fields: ['mobile', 'desktop', 'recommendations', 'impact'],
        transformers: {},
      },
    },
  },

  // ========== SCHEMAS TO BE ADDED ==========
  // TODO: The following opportunity types need schemas to be added.
  // Research actual suggestion data for these types and add schemas following the pattern:
  //   1. Get real suggestion data examples
  //   2. Define schema with proper field types
  //   3. Make minimal projection fields required (urls used for filtering on ASO UI)
  //   4. Validate against actual data
  //
  // Opportunity types pending schema implementation:
  // - ACCESSIBILITY (parent type - may use A11Y_ASSISTIVE and COLOR_CONTRAST schemas)
  // - NOTFOUND (404 pages)
  // - RAGECLICK
  // - HIGH_INORGANIC_HIGH_BOUNCE_RATE
  // - HIGH_FORM_VIEWS_LOW_CONVERSIONS
  // - HIGH_PAGE_VIEWS_LOW_FORM_NAV
  // - HIGH_PAGE_VIEWS_LOW_FORM_VIEWS
  // - DETECT_GEO_BRAND_PRESENCE
  // - DETECT_GEO_BRAND_PRESENCE_DAILY
  // - GEO_BRAND_PRESENCE_TRIGGER_REFRESH
  // - GUIDANCE_GEO_FAQ
  // - SECURITY_CSP (data.findings[].url - for URL filtering)
  // - SECURITY_XSS (data.link - for URL filtering,
  //                 may use SECURITY_CSP schema or need separate schema)
  // - SECURITY_PERMISSIONS_REDUNDANT (may use SECURITY_PERMISSIONS schema
  //                                   or need separate schema)
  // - GENERIC_OPPORTUNITY
  // - WIKIPEDIA_ANALYSIS
};
