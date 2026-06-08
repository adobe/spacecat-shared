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

const KEYWORDS_TO_FILTER = ['search'];

const average = (nums) => (nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0);

const isSearchEvent = (event) => KEYWORDS_TO_FILTER.some(
  (kw) => event.source?.toLowerCase().includes(kw) || event.target?.toLowerCase().includes(kw),
);

/**
 * Checks whether an event's source belongs to the given form source key.
 * Mirrors the isFormSource logic used in form-vitals.js.
 */
function isFormSource(formSourceKey, eventSource) {
  const excludeSrc = ['form.', 'form#'];
  if (formSourceKey === 'unknown') {
    return /\bform\b/.test(eventSource?.toLowerCase())
      && !excludeSrc.some((exclude) => eventSource?.includes(exclude));
  }
  return eventSource?.includes(formSourceKey);
}

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
  return average(deltaDiffs) / 1000;
}

/** Weighted count of events of a given checkpoint on a selector. */
function weightedCount(urlBundles, checkpoint, selector) {
  let total = 0;
  for (const bundle of urlBundles) {
    for (const event of bundle.events) {
      if (event.checkpoint === checkpoint && event.source === selector) {
        total += bundle.weight;
      }
    }
  }
  return total;
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

/** Unique field selectors (click/fill sources) belonging to a form on this page. */
function getFieldSelectors(urlBundles, formSourceKey) {
  const selectors = new Set();
  for (const bundle of urlBundles) {
    for (const event of bundle.events) {
      if ((event.checkpoint === 'click' || event.checkpoint === 'fill')
        && event.source && !isSearchEvent(event)
        && isFormSource(formSourceKey, event.source)) {
        selectors.add(event.source);
      }
    }
  }
  return [...selectors];
}

/**
 * Computes per-field engagement for a single form on a page.
 *
 * @param {Array} urlBundles - RUM bundles already filtered to the form's page URL
 * @param {string} formSourceKey - form key extracted from the form source (e.g. 'abc'
 *   for 'form#abc'), or 'unknown'
 * @returns {Array<{source: string, clicks: number, fills: number, avg_time_spend: string}>}
 *   fields ordered by avg_time_spend descending
 */
export function computeFieldEngagement(urlBundles, formSourceKey) {
  const fields = getFieldSelectors(urlBundles, formSourceKey)
    .map((source) => ({
      source,
      clicks: weightedCount(urlBundles, 'click', source),
      fills: weightedCount(urlBundles, 'fill', source),
      avg_time_spend: timeSpentInSeconds(urlBundles, source).toFixed(2),
    }))
    // order fields by when users interacted with them (natural form sequence)
    .sort((a, b) => avgInteractionTime(urlBundles, a.source)
      - avgInteractionTime(urlBundles, b.source));

  fields.sort((a, b) => b.avg_time_spend - a.avg_time_spend);
  return fields;
}
