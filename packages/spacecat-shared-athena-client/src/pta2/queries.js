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

/**
 * Calculates the previous period (week or month) for trend comparison.
 * @param {Object} params - Period parameters
 * @param {number} params.week - Week number (optional)
 * @param {number} params.month - Month number (optional)
 * @param {number} params.year - Year number
 * @returns {Object} Previous period with week/month and year
 */
export function getPreviousPeriod({ week, month, year }) {
  // Check if week is defined and valid (prioritize week over month)
  if (Number.isInteger(week)) {
    // Calculate previous week
    const prevWeek = week - 1;
    if (prevWeek < 1) {
      // Move to previous year's last week
      const prevYear = year - 1;
      // Approximate last week (52 or 53)
      return { week: 52, year: prevYear };
    }
    return { week: prevWeek, year };
  }

  if (Number.isInteger(month)) {
    // Calculate previous month
    const prevMonth = month - 1;
    if (prevMonth < 1) {
      // Move to previous year's December
      return { month: 12, year: year - 1 };
    }
    return { month: prevMonth, year };
  }

  throw new Error('Either week or month must be provided');
}

/**
 * Generates the PTA summary query template using template literals.
 * @param {Object} params - Template parameters
 * @param {string} params.siteId - Site ID
 * @param {string} params.tableName - Table name
 * @param {string} params.temporalCondition - Temporal condition
 * @param {number} params.week - Week number (either week or month must be provided)
 * @param {number} params.month - Month number (either week or month year must be provided)
 * @param {number} params.year - Year number
 * @returns {string} The SQL query string
 */
export function getPTASummaryQuery({
  siteId,
  tableName,
  week,
  month,
  year,
}) {
  if (!siteId || !tableName) {
    throw new Error('Missing required parameters: siteId, or tableName');
  }

  if ((!week && !month) || !year) {
    throw new Error('Missing required parameters: week, month or year');
  }

  const temporalCondition = getTemporalCondition({ week, month, year });

  return `
  SELECT
        CAST(SUM(pageviews) AS BIGINT) AS total_pageviews,
        CAST(SUM(clicked) AS BIGINT) AS total_clicks,
        CAST(SUM(engaged) AS BIGINT) AS total_engaged,
        COUNT(*) AS total_rows,
        CAST(SUM(clicked) AS DOUBLE) / NULLIF(COUNT(*), 0) AS click_rate,
        CAST(SUM(engaged) AS DOUBLE) / NULLIF(COUNT(*), 0) AS engagement_rate,
        1 - CAST(SUM(engaged) AS DOUBLE) / NULLIF(COUNT(*), 0) AS bounce_rate
    FROM ${tableName}
    WHERE siteid = '${siteId}'
        AND (${temporalCondition})
        AND trf_type = 'paid'
  `;
}

/**
 * Generates a PTA summary query that includes both current and previous period data
 * for trend analysis. More efficient than making two separate queries.
 * @param {Object} params - Template parameters
 * @param {string} params.siteId - Site ID
 * @param {string} params.tableName - Table name
 * @param {number} params.week - Week number (either week or month must be provided)
 * @param {number} params.month - Month number (either week or month must be provided)
 * @param {number} params.year - Year number
 * @returns {string} The SQL query string with both current and previous period data
 */
export function getPTASummaryWithTrendQuery({
  siteId,
  tableName,
  week,
  month,
  year,
}) {
  if (!siteId || !tableName) {
    throw new Error('Missing required parameters: siteId, or tableName');
  }

  if ((!week && !month) || !year) {
    throw new Error('Missing required parameters: week, month or year');
  }

  const currentTemporalCondition = getTemporalCondition({ week, month, year });
  const previousPeriod = getPreviousPeriod({ week, month, year });
  const previousTemporalCondition = getTemporalCondition(previousPeriod);

  return `
  SELECT
        period,
        CAST(SUM(pageviews) AS BIGINT) AS total_pageviews,
        CAST(SUM(clicked) AS BIGINT) AS total_clicks,
        CAST(SUM(engaged) AS BIGINT) AS total_engaged,
        COUNT(*) AS total_rows,
        CAST(SUM(clicked) AS DOUBLE) / NULLIF(COUNT(*), 0) AS click_rate,
        CAST(SUM(engaged) AS DOUBLE) / NULLIF(COUNT(*), 0) AS engagement_rate,
        1 - CAST(SUM(engaged) AS DOUBLE) / NULLIF(COUNT(*), 0) AS bounce_rate
    FROM (
        SELECT *, 'current' as period FROM ${tableName}
        WHERE siteid = '${siteId}'
            AND (${currentTemporalCondition})
            AND trf_type = 'paid'
        UNION ALL
        SELECT *, 'previous' as period FROM ${tableName}
        WHERE siteid = '${siteId}'
            AND (${previousTemporalCondition})
            AND trf_type = 'paid'
    )
    GROUP BY period
  `;
}

export const PTASummaryResponseDto = {
  /**
   * Converts a traffic data object into a JSON object.
   * @param {object} data - traffic data object.
   * @returns {{
   *   pageviews: number,
   *   click_rate: number,
   *   engagement_rate: number,
   *   bounce_rate: number
   * }} JSON object.
   */
  toJSON: (data) => ({
    pageviews: data.total_pageviews,
    click_rate: data.click_rate,
    engagement_rate: data.engagement_rate,
    bounce_rate: data.bounce_rate,
  }),
};

export const PTASummaryWithTrendResponseDto = {
  /**
   * Converts trend data (array with current and previous periods)
   * into a JSON object with current metrics and trends.
   * @param {Array<object>} data - Array of traffic data objects with 'period' field.
   * @returns {{
   *   pageviews: number,
   *   click_rate: number,
   *   engagement_rate: number,
   *   bounce_rate: number,
   *   trends: {
   *     pageviews: number,
   *     click_rate: number,
   *     engagement_rate: number,
   *     bounce_rate: number
   *   }
   * }} JSON object with current metrics and trend percentages.
   */
  toJSON: (data) => {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Expected an array with at least one period');
    }

    const currentData = data.find((row) => row.period === 'current');
    const previousData = data.find((row) => row.period === 'previous');

    if (!currentData) {
      throw new Error('Current period data not found');
    }

    const current = {
      pageviews: currentData.total_pageviews,
      click_rate: currentData.click_rate,
      engagement_rate: currentData.engagement_rate,
      bounce_rate: currentData.bounce_rate,
    };

    // Calculate trend percentages (null if no previous data)
    const trends = previousData ? {
      pageviews: previousData.total_pageviews > 0
        ? ((current.pageviews - previousData.total_pageviews) / previousData.total_pageviews) * 100
        : null,
      click_rate: previousData.click_rate > 0
        ? ((current.click_rate - previousData.click_rate) / previousData.click_rate) * 100
        : null,
      engagement_rate: previousData.engagement_rate > 0
        ? ((current.engagement_rate - previousData.engagement_rate)
          / previousData.engagement_rate) * 100
        : null,
      bounce_rate: previousData.bounce_rate > 0
        ? ((current.bounce_rate - previousData.bounce_rate) / previousData.bounce_rate) * 100
        : null,
    } : null;

    return {
      ...current,
      trends,
    };
  },
};
