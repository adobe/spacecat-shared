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

// Checkpoints fetched from the RUM bundler. Broad set so the "next event" used to
// measure dwell time (avg_time_spend) can be any interaction type (navigate, formsubmit,
// …) — mirrors the Python time_spent_in_seconds, which considers every event in a bundle.
const CHECKPOINTS = ['viewblock', 'click', 'fill', 'formsubmit', 'navigate', 'viewmedia', 'experiment'];
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

function handler(bundles) {
  // Map each page URL to the set of form sources seen in its viewblock events.
  const formSourcesByUrl = new Map();
  for (const bundle of bundles) {
    for (const event of bundle.events) {
      if (event.checkpoint === 'viewblock' && event.source) {
        if (!formSourcesByUrl.has(bundle.url)) {
          formSourcesByUrl.set(bundle.url, new Set());
        }
        formSourcesByUrl.get(bundle.url).add(event.source);
      }
    }
  }

  const results = [];
  for (const [url, fullSources] of formSourcesByUrl) {
    const urlBundles = bundles.filter((b) => b.url === url);

    for (const fullSource of fullSources) {
      // Extract the key used for matching field events (mirrors form-vitals.js).
      const match = fullSource.match(/form[#.]((?:\\[0-9a-fA-F]{1,6}\s?|\w|-)+)/);
      const formSourceKey = match ? match[1] : 'unknown';
      // Strip 'dialog ' prefix to match the formsource stored in formVitals (formcalc.js).
      const formsource = fullSource.startsWith('dialog') ? fullSource.replace('dialog ', '') : fullSource;

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

      if (fields.length > 0) {
        fields.sort((a, b) => b.avg_time_spend - a.avg_time_spend);
        results.push({ url, formsource, fields });
      }
    }
  }

  return results;
}

export default { handler, checkpoints: CHECKPOINTS };
