/*
 * Copyright 2024 Adobe. All rights reserved.
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
 *     url: Joi.string().uri().optional(),
 *     customField: Joi.string().optional()
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
      url: Joi.string().uri().optional(),
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
      url: Joi.string().uri().optional(),
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
      ).optional(),
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
      url: Joi.string().uri().optional(),
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
      ).optional(),
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
      type: Joi.string().optional(),
      url: Joi.string().uri().optional(),
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
      ).optional(),
      issues: Joi.array().items(Joi.object()).optional(),
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
      ).optional(),
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
      path: Joi.string().optional(),
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
      ).optional(),
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
      source: Joi.string().optional(),
      type: Joi.string().optional(),
      aiGenerated: Joi.boolean().optional(),
      url: Joi.string().uri().optional(),
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
      ).optional(),
      jiraLink: Joi.string().uri().allow(null).optional(),
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
};
