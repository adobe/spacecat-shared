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
import { getTemporalCondition } from '@adobe/spacecat-shared-utils';
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
    'pageViewThreshold',
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
 * @param {number} params.month - Month number (1-12).
 * @param {number} params.year - The year (e.g. 2025).
 * @param {string} params.siteId - UUID of the site.
 * @param {string[]} [params.dimensions] - Dimensions to group by (e.g. ['utm_campaign', 'device']).
 * @param {string} params.tableName - The name of the source table.
 * @param {string} params.pageTypeMatchColumn - The pageTypeMatchColumn of the source table.
 * @param {Object|null} [params.pageTypes=null] - Optional pageType rules for CASE generation.
 * @param {string[]|null} [params.trfTypes] - Traffic type to filter by before
 *  grouping (e.g ['paid']).
 * @param {number} [params.pageViewThreshold=1000] - Minimum total pageviews for a path to include.
 * @returns {Object} Template values for SQL generation.
 */
export function getTrafficAnalysisQueryPlaceholdersFilled({
  week,
  month,
  year,
  siteId,
  dimensions = [],
  tableName,
  pageTypes = null,
  pageTypeMatchColumn = 'path',
  trfTypes = null,
  temporalCondition = null,
  pageViewThreshold = 1000,
  numTemporalSeries = 1,
}) {
  if (!siteId || !tableName) {
    throw new Error('Missing required parameters: siteId, or tableName');
  }

  if (!temporalCondition && ((!week && !month) || !year)) {
    throw new Error('Missing required parameters: week, month or year');
  }

  if (numTemporalSeries > 1 && week && week > 0) {
    dimensions.push('week');
  } else if (numTemporalSeries > 1 && month && month > 0) {
    dimensions.push('month');
  }
  const dimensionColumns = dimensions.join(', ');
  const dimensionColumnsPrefixed = dimensions.map((col) => `a.${col}`).join(', ');

  let tempCondition = null;
  if (!temporalCondition) {
    tempCondition = getTemporalCondition({
      week,
      month,
      year,
      numSeries: numTemporalSeries,
    });
  }

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
    temporalCondition: tempCondition,
    pageTypeCase,
    trfTypeCondition,
    pageViewThreshold,
  };
}

/**
 * Generates the top 3 pages with traffic lost SQL query with consent and referrer parameters.
 * @param {Object} params - Template parameters
 * @param {string} params.siteId - Site ID
 * @param {string} params.tableName - Table name
 * @param {string} params.temporalCondition - Temporal condition
 * @param {string} params.dimensionColumns - Dimension columns
 * @param {string} params.groupBy - Group by clause
 * @param {string} params.dimensionColumnsPrefixed - Prefixed dimension columns
 * @param {number} params.pageViewThreshold - Minimum total pageviews for path to include
 * @param {number} params.limit - Limit the number of results
 * @returns {string} The SQL query string
 */
export function getTop3PagesWithTrafficLostTemplate({
  siteId,
  tableName,
  temporalCondition,
  dimensionColumns,
  groupBy,
  dimensionColumnsPrefixed,
  pageViewThreshold,
  limit,
}) {
  return `
WITH min_totals AS (
    SELECT
        path AS min_key,
        CAST(SUM(pageviews) AS BIGINT) AS total_pageviews
    FROM ${tableName}
    WHERE siteid = '${siteId}' AND consent='show'
    AND (${temporalCondition})
    GROUP BY path
    HAVING SUM(pageviews) >= ${pageViewThreshold}
),
raw AS (
    SELECT
        week,
        month,
        path,
        trf_type,
        trf_channel,
        trf_platform,
        device,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
        consent,
        notfound,
        pageviews,
        clicked,
        engaged,
        latest_scroll,
        CASE WHEN latest_scroll >= 10000 THEN 1 ELSE 0 END AS engaged_scroll,
        lcp,
        cls,
        inp
    FROM ${tableName} m
    JOIN min_totals t ON m.path = t.min_key
    WHERE m.siteid = '${siteId}' AND consent='show'
    AND (${temporalCondition})
),
agg AS (
    SELECT
        ${dimensionColumns},
        COUNT(*)                          AS row_count,
        CAST(SUM(pageviews) AS BIGINT)   AS pageviews,
        CAST(SUM(clicked) AS BIGINT)     AS clicks,
        CAST(SUM(engaged) AS BIGINT)     AS engagements,
        CAST(SUM(engaged_scroll) AS BIGINT) AS engaged_scroll,
        approx_percentile(latest_scroll, 0.70) AS p70_scroll,
        approx_percentile(lcp, 0.70)     AS p70_lcp,
        approx_percentile(cls, 0.70)     AS p70_cls,
        approx_percentile(inp, 0.70)     AS p70_inp
    FROM raw
    GROUP BY ${groupBy}
),
grand_total AS (
    SELECT CAST(SUM(pageviews) AS BIGINT) AS total_pv FROM agg
)
SELECT
    ${dimensionColumnsPrefixed},
    CAST(a.pageviews AS DOUBLE) * (1 - CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0)) AS traffic_loss,
    1 - CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0)  AS bounce_rate,
    a.pageviews,
    CAST(a.pageviews AS DOUBLE) / NULLIF(t.total_pv, 0)         AS pct_pageviews,
    CAST(a.clicks AS DOUBLE)      / NULLIF(a.row_count, 0)      AS click_rate,
    CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0)      AS engagement_rate,
    CAST(a.engaged_scroll AS DOUBLE) / NULLIF(a.row_count, 0) AS engaged_scroll_rate,
    a.p70_scroll,
    a.p70_lcp,
    a.p70_cls,
    a.p70_inp
FROM agg a
CROSS JOIN grand_total t
ORDER BY traffic_loss DESC
${limit ? `LIMIT ${limit}` : ''}
`.trim();
}

/**
 * Generates the top 3 pages with traffic lost SQL query with consent and referrer parameters.
 * @param {Object} params - Template parameters
 * @param {string} params.siteId - Site ID
 * @param {string} params.tableName - Table name
 * @param {string} params.temporalCondition - Temporal condition
 * @param {string} params.dimensionColumns - Dimension columns
 * @param {string} params.groupBy - Group by clause
 * @param {string} params.dimensionColumnsPrefixed - Prefixed dimension columns
 * @param {number} params.pageViewThreshold - Minimum total pageviews for path to include
 * @param {number} params.limit - Limit the number of results
 * @returns {string} The SQL query string
 */
export function getTrafficTypeAnalysisTemplate({
  siteId,
  tableName,
  temporalCondition,
  dimensionColumns,
  groupBy,
  dimensionColumnsPrefixed,
  pageViewThreshold,
  limit,
}) {
  return `
WITH min_totals AS (
    SELECT
        path AS min_key,
        CAST(SUM(pageviews) AS BIGINT) AS total_pageviews
    FROM ${tableName}
    WHERE siteid = '${siteId}'
    AND (${temporalCondition})
    GROUP BY path
    HAVING SUM(pageviews) >= ${pageViewThreshold}
),
raw AS (
    SELECT
        week,
        month,
        path,
        trf_type,
        trf_channel,
        trf_platform,
        device,
        utm_source,
        utm_medium,
        utm_campaign,
        referrer,
        consent,
        notfound,
        pageviews,
        clicked,
        engaged,
        latest_scroll,
        CASE WHEN latest_scroll >= 10000 THEN 1 ELSE 0 END AS engaged_scroll,
        lcp,
        cls,
        inp
    FROM ${tableName} m
    JOIN min_totals t ON m.path = t.min_key
    WHERE m.siteid = '${siteId}'
    AND (${temporalCondition})
),
agg AS (
    SELECT
        ${dimensionColumns},
        COUNT(*)                          AS row_count,
        CAST(SUM(pageviews) AS BIGINT)   AS pageviews,
        CAST(SUM(clicked) AS BIGINT)     AS clicks,
        CAST(SUM(engaged) AS BIGINT)     AS engagements,
        CAST(SUM(engaged_scroll) AS BIGINT) AS engaged_scroll,
        approx_percentile(latest_scroll, 0.70) AS p70_scroll,
        approx_percentile(lcp, 0.70)     AS p70_lcp,
        approx_percentile(cls, 0.70)     AS p70_cls,
        approx_percentile(inp, 0.70)     AS p70_inp
    FROM raw
    GROUP BY ${groupBy}
),
grand_total AS (
    SELECT CAST(SUM(pageviews) AS BIGINT) AS total_pv FROM agg
)
SELECT
    ${dimensionColumnsPrefixed},
    CAST(a.pageviews AS DOUBLE) * (1 - CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0)) AS traffic_loss,
    1 - CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0)  AS bounce_rate,
    a.pageviews,
    CAST(a.pageviews AS DOUBLE) / NULLIF(t.total_pv, 0)         AS pct_pageviews,
    CAST(a.clicks AS DOUBLE)      / NULLIF(a.row_count, 0)      AS click_rate,
    CAST(a.engagements AS DOUBLE) / NULLIF(a.row_count, 0)      AS engagement_rate,
    CAST(a.engaged_scroll AS DOUBLE) / NULLIF(a.row_count, 0) AS engaged_scroll_rate,
    a.p70_scroll,
    a.p70_lcp,
    a.p70_cls,
    a.p70_inp
FROM agg a
CROSS JOIN grand_total t
ORDER BY traffic_loss DESC
${limit ? `LIMIT ${limit}` : ''}
`.trim();
}
