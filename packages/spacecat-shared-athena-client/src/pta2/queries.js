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
