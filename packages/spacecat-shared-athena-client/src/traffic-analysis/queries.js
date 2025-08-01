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
import { getDateRanges } from '@adobe/spacecat-shared-utils';
import { getTrafficAnalysisTemplate } from './traffic-analysis-template.js';

/**
 * Loads the traffic analysis query template and applies placeholders.
 * @param {Object} placeholders - Key-value pairs to replace in the query template.
 * @param {Object} log - Logger (optional)
 * @returns {string} The templated SQL string.
 */
export function getTrafficAnalysisQuery(placeholders = {}) {
  return getTrafficAnalysisTemplate(placeholders);
}

/**
 * Returns a sorted array of unique placeholder keys used in the template.
 * @returns {string[]} Array of unique placeholder keys found in the template.
 */
export function getTrafficAnalysisQueryPlaceholders() {
  // Return the known placeholders used in the template
  return [
    'dimensionColumns',
    'dimensionColumnsPrefixed',
    'groupBy',
    'pageTypeCase',
    'siteId',
    'tableName',
    'temporalCondition',
    'trfTypeCondition',
  ];
}

/**
 * Returns case statement for pattern matching field to pageTypes
 * @param {list} pageTypes - List containing name and pattern to use
 * @param {string} column - Column to use for mapping.
 * @returns {string|null} - Athena SQL case statement to project new column based on patterns.
 */
export function buildPageTypeCase(pageTypes, column) {
  if (!pageTypes || !pageTypes.length) {
    return null;
  }

  const caseLines = [
    'CASE',
    ...pageTypes.map(({ name, pattern }) => `    WHEN REGEXP_LIKE(${column}, '${pattern}') THEN '${name.replace(/'/g, "''")}'`),
    "    ELSE 'other | Other Pages'",
    'END AS page_type',
  ];

  return caseLines.join('\n');
}

/**
 * Builds the placeholder values for the traffic analysis SQL template.
 *
 * @param {Object} params - Input parameters.
 * @param {number} params.week - The ISO week number (1–53).
 * @param {number} params.year - The year (e.g. 2025).
 * @param {string} params.siteId - UUID of the site.
 * @param {string[]} [params.dimensions] - Dimensions to group by (e.g. ['utm_campaign', 'device']).
 * @param {string} params.tableName - The name of the source table.
 * @param {string} params.pageTypeMatchColumn - The pageTypeMatchColumn of the source table.
 * @param {Object|null} [params.pageTypes=null] - Optional pageType rules for CASE generation.
 * @param {string[]|null} [params.trfTypes] - Traffic type to filter by before
 *  grouping (e.g ['paid']).
 * @returns {Object} Template values for SQL generation.
 */
export function getTrafficAnalysisQueryPlaceholdersFilled({
  week,
  year,
  siteId,
  dimensions,
  tableName,
  pageTypes = null,
  pageTypeMatchColumn = 'path',
  trfTypes = null,
}) {
  if (!week || !year || !siteId || !tableName) {
    throw new Error('Missing required parameters: week, year, siteId, or tableName');
  }

  if (!Array.isArray(dimensions) || dimensions.length === 0) {
    throw new Error('Missing dimension to group by');
  }

  const dimensionColumns = dimensions.join(', ');
  const dimensionColumnsPrefixed = dimensions.map((col) => `a.${col}`).join(', ');

  const dateRanges = getDateRanges(week, year);
  const temporalCondition = dateRanges
    .map((r) => `(year=${r.year} AND month=${r.month} AND week=${week})`)
    .join(' OR ');

  let pageTypeCase = 'NULL as page_type';
  if (dimensions.includes('page_type') && pageTypes) {
    pageTypeCase = buildPageTypeCase(pageTypes, pageTypeMatchColumn);
  }

  let trfTypeCondition = 'TRUE';
  if (trfTypes && trfTypes.length > 0) {
    const quotedTypes = trfTypes.map((type) => `'${type}'`).join(', ');
    trfTypeCondition = `trf_type IN (${quotedTypes})`;
  }

  return {
    siteId,
    groupBy: dimensionColumns,
    dimensionColumns,
    dimensionColumnsPrefixed,
    tableName,
    temporalCondition,
    pageTypeCase,
    trfTypeCondition,
  };
}
