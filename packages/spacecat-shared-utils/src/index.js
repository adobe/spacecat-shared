/*
 * Copyright 2023 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

export {
  arrayEquals,
  dateAfterDays,
  deepEqual,
  hasText,
  isArray,
  isBoolean,
  isInteger,
  isIsoDate,
  isIsoTimeOffsetsDate,
  isNonEmptyArray,
  isNonEmptyObject,
  isNumber,
  isObject,
  isString,
  isValidDate,
  isValidUrl,
  isValidUUID,
  isValidIMSOrgId,
  isValidHelixPreviewUrl,
  toBoolean,
} from './functions.js';

export {
  resolveSecretsName,
  resolveCustomerSecretsName,
  generateCSVFile,
  replacePlaceholders,
  getPrompt,
  getQuery,
} from './helpers.js';

export {
  isAWSLambda,
} from './runtimes.js';

export { sqsWrapper } from './sqs.js';
export { sqsEventAdapter } from './sqs.js';

export { logWrapper } from './log-wrapper.js';
export { instrumentAWSClient } from './xray.js';

export {
  composeBaseURL,
  composeAuditURL,
  prependSchema,
  stripPort,
  stripTrailingDot,
  stripTrailingSlash,
  stripWWW,
} from './url-helpers.js';

export { getStoredMetrics, storeMetrics } from './metrics-store.js';

export { s3Wrapper } from './s3.js';

export { fetch } from './adobe-fetch.js';
export { tracingFetch, SPACECAT_USER_AGENT } from './tracing-fetch.js';
export {
  getHighFormViewsLowConversionMetrics,
  getHighPageViewsLowFormViewsMetrics,
  getHighPageViewsLowFormCtrMetrics,
  FORMS_AUDIT_INTERVAL,
} from './formcalc.js';

export { retrievePageAuthentication } from './auth.js';

/**
 * Computes CPC and related metrics from organic traffic and RUM data.
 * @param {Object} params
 * @param {Object} params.current - Current RUM metrics ({ totalPageViews, totalClicks, totalCTR })
 * @param {Object} params.total - Total RUM metrics for a longer period ({ totalPageViews, totalClicks, totalCTR })
 * @param {Array} params.organicTraffic - Array of organic traffic metrics ({ cost, value })
 * @returns {Object} - { pageViewsChange, ctrChange, projectedTrafficValue, cpc }
 */
function computeCPCMetrics({ current, total, organicTraffic }) {
  let pageViewsChange = 0;
  let ctrChange = 0;
  let projectedTrafficValue = 0;
  let cpc = 0;

  if (
    current &&
    total &&
    typeof current.totalPageViews === 'number' &&
    typeof total.totalPageViews === 'number' &&
    typeof current.totalClicks === 'number' &&
    typeof total.totalClicks === 'number' &&
    typeof current.totalCTR === 'number' &&
    typeof total.totalCTR === 'number'
  ) {
    const previousPageViews = total.totalPageViews - current.totalPageViews;
    const previousCTR = previousPageViews > 0
      ? (total.totalClicks - current.totalClicks) / previousPageViews
      : 0;

    pageViewsChange = previousPageViews > 0
      ? ((current.totalPageViews - previousPageViews) / previousPageViews) * 100
      : 0;

    ctrChange = previousCTR !== 0
      ? ((current.totalCTR - previousCTR) / previousCTR) * 100
      : 0;

    if (Array.isArray(organicTraffic) && organicTraffic.length > 0) {
      const metric = organicTraffic[organicTraffic.length - 1];
      if (metric && typeof metric.cost === 'number' && typeof metric.value === 'number' && metric.value !== 0) {
        cpc = metric.cost / metric.value;
      }
    }

    projectedTrafficValue = pageViewsChange * cpc;
  }

  return {
    pageViewsChange,
    ctrChange,
    projectedTrafficValue,
    cpc,
  };
}

module.exports.computeCPCMetrics = computeCPCMetrics;
