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

const DAILY_PAGEVIEW_THRESHOLD = 200;
const CR_THRESHOLD_RATIO = 0.2;
const MOBILE = 'mobile';
const DESKTOP = 'desktop';

/**
 * Aggregates the form vitals by device type.
 *
 * @param {*} formVitalsCollection - form vitals collection
 * @returns {object} - aggregated form vitals by device type
 */
function aggregateFormVitalsByDevice(formVitalsCollection) {
  const resultMap = new Map();

  formVitalsCollection.forEach((item) => {
    const {
      url, formview = {}, formengagement = {}, pageview = {}, formsubmit = {},
    } = item;

    const totals = {
      formview: { total: 0, desktop: 0, mobile: 0 },
      formengagement: { total: 0, desktop: 0, mobile: 0 },
      pageview: { total: 0, desktop: 0, mobile: 0 },
      formsubmit: { total: 0, desktop: 0, mobile: 0 },
    };

    const calculateSums = (metric, initialTarget) => {
      const updatedTarget = { ...initialTarget }; // Create a new object to store the updated totals
      Object.entries(metric).forEach(([key, value]) => {
        updatedTarget.total += value;
        if (key.startsWith(DESKTOP)) {
          updatedTarget.desktop += value;
        } else if (key.startsWith(MOBILE)) {
          updatedTarget.mobile += value;
        }
      });
      return updatedTarget; // Return the updated target
    };

    totals.formview = calculateSums(formview, totals.formview);
    totals.formengagement = calculateSums(formengagement, totals.formengagement);
    totals.pageview = calculateSums(pageview, totals.pageview);
    totals.formsubmit = calculateSums(formsubmit, totals.formsubmit);

    resultMap.set(url, totals);
  });

  return resultMap;
}

function hasHighPageViews(interval, pageViews) {
  return pageViews > DAILY_PAGEVIEW_THRESHOLD * interval;
}

function hasLowerConversionRate(formSubmit, formViews) {
  return formSubmit / formViews < CR_THRESHOLD_RATIO;
}

/**
 * Returns the form urls with high form views and low conversion rate
 *
 * @param {*} formVitalsCollection - form vitals collection
 * @returns {Array} - urls with high form views and low conversion rate
 */
export function getHighFormViewsLowConversionMetrics(formVitalsCollection, interval) {
  const resultMap = aggregateFormVitalsByDevice(formVitalsCollection);
  const urls = [];
  resultMap.forEach((metrics, url) => {
    const pageViews = metrics.pageview.total;
    // Default to pageViews if formViews are not available
    const formViews = metrics.formview.total || pageViews;
    const formEngagement = metrics.formengagement.total;
    const formSubmit = metrics.formsubmit.total || formEngagement;

    if (hasHighPageViews(interval, pageViews) && hasLowerConversionRate(formSubmit, formViews)) {
      urls.push({
        url,
        pageViews,
        formViews,
        formEngagement,
        formSubmit,
      });
    }
  });
  return urls;
}
