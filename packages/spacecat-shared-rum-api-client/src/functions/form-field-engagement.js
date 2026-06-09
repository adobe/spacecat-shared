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

// Per-field form engagement helper. NOT a RUM query — invoked from form-vitals.js to
// attach a `fieldEngagement` property to each form-vitals entry (like trafficacquisition).

import { FORM_KEYWORDS_TO_FILTER, isFormSource } from '../utils.js';

const average = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

const isSearchEvent = (event) => FORM_KEYWORDS_TO_FILTER.some(
  (kw) => event.source?.toLowerCase().includes(kw) || event.target?.toLowerCase().includes(kw),
);

/**
 * Average time (in seconds) spent on a field before the next interaction.
 * Direct port of time_spent_in_seconds() from forms-analysis-automation:
 * within each bundle, sort events by timeDelta; for every click/fill on this
 * selector, take the gap to the next event; average the gaps and convert ms → s.
 */
function timeSpentInSeconds(urlBundles, selector) {
  const deltaDiffs = [];
  for (const bundle of urlBundles) {
    const sortedEvents = [...bundle.events].sort((a, b) => a.timeDelta - b.timeDelta);
    for (let i = 0; i < sortedEvents.length - 1; i += 1) {
      const event = sortedEvents[i];
      if ((event.checkpoint === 'click' || event.checkpoint === 'fill')
        && event.source === selector) {
        deltaDiffs.push(sortedEvents[i + 1].timeDelta - event.timeDelta);
      }
    }
  }
  return Math.round((average(deltaDiffs) / 1000) * 100) / 100;
}

/** Average absolute timeDelta of a field's click/fill events — used for output ordering. */
function avgInteractionTime(urlBundles, selector) {
  const times = [];
  for (const bundle of urlBundles) {
    for (const event of bundle.events) {
      if ((event.checkpoint === 'click' || event.checkpoint === 'fill')
        && event.source === selector && event.timeDelta != null) {
        times.push(event.timeDelta);
      }
    }
  }
  return average(times);
}

/**
 * Single-traversal collection of weighted click/fill counts per field selector.
 * Returns a Map<source, { clicks, fills }> for all form-scoped field events.
 */
function getFieldMetrics(urlBundles, formSourceKey) {
  const metricsMap = new Map();
  for (const bundle of urlBundles) {
    for (const event of bundle.events) {
      if ((event.checkpoint === 'click' || event.checkpoint === 'fill')
        && event.source && !isSearchEvent(event)
        && isFormSource(formSourceKey, event.source)) {
        if (!metricsMap.has(event.source)) {
          metricsMap.set(event.source, { clicks: 0, fills: 0 });
        }
        const metrics = metricsMap.get(event.source);
        if (event.checkpoint === 'click') {
          metrics.clicks += bundle.weight;
        } else {
          metrics.fills += bundle.weight;
        }
      }
    }
  }
  return metricsMap;
}

/**
 * Computes per-field engagement for a single form on a page.
 *
 * @param {Array} urlBundles - RUM bundles already filtered to the form's page URL
 * @param {string} formSourceKey - form key extracted from the form source (e.g. 'abc'
 *   for 'form#abc'), or 'unknown'
 * @returns {Array<{source: string, clicks: number, fills: number, avg_time_spend: number}>}
 *   fields ordered by average absolute timeDelta (natural form interaction order)
 */
export function computeFieldEngagement(urlBundles, formSourceKey) {
  const fieldMetrics = getFieldMetrics(urlBundles, formSourceKey);

  return [...fieldMetrics.keys()]
    .map((source) => ({
      source,
      clicks: fieldMetrics.get(source).clicks,
      fills: fieldMetrics.get(source).fills,
      avg_time_spend: timeSpentInSeconds(urlBundles, source),
    }))
    .sort((a, b) => avgInteractionTime(urlBundles, a.source)
      - avgInteractionTime(urlBundles, b.source));
}
