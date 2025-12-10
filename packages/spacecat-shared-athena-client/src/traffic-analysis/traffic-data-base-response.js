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
 * Data transfer object for Marketing Channel Response.
 */
export const TrafficDataResponseDto = {
  /**
   * Converts a traffic data object into a JSON object.
   * @param {object} data - traffic data object.
   * @returns {{
   *   type: string,
   *   channel: string,
   *   platform: string,
   *   campaign: string,
   *   referrer: string,
   *   pageviews: number,
   *   pct_pageviews: number,
   *   click_rate: number,
   *   engagement_rate: number,
   *   bounce_rate: number,
   *   engaged_scroll_rate: number,
   *   p70_scroll: number,
   * }} JSON object.
   */
  toJSON: (data) => ({
    week: data.week,
    month: data.month,
    type: data.trf_type,
    channel: data.trf_channel,
    platform: data.trf_platform,
    device: data.device,
    utm_source: data.utm_source,
    utm_medium: data.utm_medium,
    campaign: data.utm_campaign,
    referrer: data.referrer,
    pageviews: data.pageviews,
    pct_pageviews: data.pct_pageviews,
    click_rate: data.click_rate,
    engagement_rate: data.engagement_rate,
    bounce_rate: data.bounce_rate,
    engaged_scroll_rate: data.engaged_scroll_rate,
    p70_scroll: data.p70_scroll,
  }),
};
