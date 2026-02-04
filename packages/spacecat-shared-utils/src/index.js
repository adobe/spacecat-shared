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
  isValidEmail,
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
  getStaticContent,
  getPrompt,
  getQuery,
} from './helpers.js';

export {
  isAWSLambda,
} from './runtimes.js';

export { sqsWrapper } from './sqs.js';
export { sqsEventAdapter } from './sqs.js';

export { logWrapper } from './log-wrapper.js';
export { instrumentAWSClient, getTraceId, addTraceIdHeader } from './xray.js';

export {
  composeBaseURL,
  composeAuditURL,
  prependSchema,
  stripPort,
  stripTrailingDot,
  stripTrailingSlash,
  stripWWW,
  resolveCanonicalUrl,
  getSpacecatRequestHeaders,
  ensureHttps,
  urlMatchesFilter,
  hasNonWWWSubdomain,
  toggleWWWHostname,
  wwwUrlResolver,
} from './url-helpers.js';

export {
  extractUrlsFromOpportunity,
  extractUrlsFromSuggestion,
} from './url-extractors.js';

export { getStoredMetrics, storeMetrics, calculateCPCValue } from './metrics-store.js';

export { s3Wrapper, getObjectFromKey } from './s3.js';

export { OPPORTUNITY_TYPES, DEFAULT_CPC_VALUE } from './constants.js';

export { fetch } from './adobe-fetch.js';
export { tracingFetch, SPACECAT_USER_AGENT } from './tracing-fetch.js';
export {
  getHighFormViewsLowConversionMetrics,
  getHighPageViewsLowFormViewsMetrics,
  getHighPageViewsLowFormCtrMetrics,
  FORMS_AUDIT_INTERVAL,
} from './formcalc.js';

export {
  getDateRanges,
  getLastNumberOfWeeks,
  getWeekInfo,
  getMonthInfo,
  getTemporalCondition,
  isoCalendarWeek,
  isoCalendarWeekSunday,
  isoCalendarWeekMonday,
} from './calendar-week-helper.js';

export { detectAEMVersion, DELIVERY_TYPES, AUTHORING_TYPES } from './aem.js';

export { determineAEMCSPageId, getPageEditUrl } from './aem-content-api-utils.js';

export * as llmoConfig from './llmo-config.js';
export * as llmoStrategy from './llmo-strategy.js';
export * as schemas from './schemas.js';

export { detectLocale } from './locale-detect/locale-detect.js';
export {
  detectBotBlocker,
  analyzeBotProtection,
  SPACECAT_BOT_USER_AGENT,
  getSpacecatBotIps,
  formatAllowlistMessage,
} from './bot-blocker-detect/bot-blocker-detect.js';
export { prettifyLogForwardingConfig } from './cdn-helpers.js';

export {
  buildAggregationKey,
  buildAggregationKeyFromSuggestion,
  buildSuggestionKey,
  buildIndividualKey,
  buildKey,
  getGranularityForIssueType,
  Granularity,
  GRANULARITY_KEY_BUILDERS,
  ISSUE_GRANULARITY_MAP,
} from './aggregation/aggregation-strategies.js';
