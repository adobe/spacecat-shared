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
 * @fileoverview Utility functions and configurations for suggestion data projections.
 */

/**
 * Reusable field transformation functions for projecting suggestion data.
 * Referenced by name in DATA_SCHEMAS transformer configurations.
 *
 * @type {Object<string, Function>}
 *
 * @example Usage in DATA_SCHEMAS
 * projections: {
 *   minimal: {
 *     fields: ['issues'],
 *     transformers: {
 *       // References FIELD_TRANSFORMERS['filterIssuesOccurrences']
 *       issues: 'filterIssuesOccurrences'
 *     }
 *   }
 * }
 */
export const FIELD_TRANSFORMERS = {
  /**
   * Filters issues array to only include occurrences count.
   * Used for accessibility-related opportunity types.
   */
  filterIssuesOccurrences: (issues) => {
    if (!Array.isArray(issues)) return issues;
    return issues.map((issue) => ({
      occurrences: issue.occurrences,
    }));
  },
  /**
   * Filters metrics array to only include essential CWV fields.
   * Used for Core Web Vitals opportunity type.
   */
  filterCwvMetrics: (metrics) => {
    if (!Array.isArray(metrics)) return metrics;
    return metrics.map((metric) => ({
      deviceType: metric.deviceType,
      lcp: metric.lcp,
      inp: metric.inp,
      cls: metric.cls,
    }));
  },
  /**
   * Extracts pageUrl from recommendations array.
   * Used for alt-text opportunity type.
   */
  extractPageUrlFromRecommendations: (recommendations) => {
    if (!Array.isArray(recommendations)) return recommendations;
    return recommendations.map((rec) => ({
      pageUrl: rec.pageUrl,
    }));
  },
  /**
   * Extracts URLs from CVEs array.
   * Used for security vulnerability opportunity types.
   */
  extractCveUrls: (cves) => {
    if (!Array.isArray(cves)) return cves;
    return cves.map((cve) => ({
      url: cve.url,
    }));
  },
};

/**
 * Default projection configuration for opportunity types without explicit schemas.
 * Includes common URL-related fields and standard metadata fields.
 *
 * @type {Object}
 * @property {Object} minimal - Minimal view configuration
 * @property {string[]} minimal.fields - Common fields for undefined opportunity types
 * @property {Object} minimal.transformers - No transformers applied by default
 */
export const FALLBACK_PROJECTION = {
  minimal: {
    fields: [
      'url', 'urls', 'urlFrom', 'urlTo', 'url_from', 'url_to',
      'pageUrl', 'sitemapUrl', 'pattern', 'link', 'path',
      'sourceUrl', 'destinationUrl', 'recommendations',
      'cves', 'findings', 'form', 'page', 'accessibility',
      'urlsSuggested', 'metrics', 'type', 'pageviews', 'issues',
    ],
    transformers: {},
  },
};
