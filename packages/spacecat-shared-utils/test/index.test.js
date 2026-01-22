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

/* eslint-env mocha */

import { expect } from 'chai';
import * as allExports from '../src/index.js';

describe('Index Exports', () => {
  const expectedExports = [
    'addTraceIdHeader',
    'arrayEquals',
    'AUTHORING_TYPES',
    'buildAggregationKey',
    'buildAggregationKeyFromSuggestion',
    'buildIndividualKey',
    'buildKey',
    'buildSuggestionKey',
    'calculateCPCValue',
    'composeAuditURL',
    'composeBaseURL',
    'dateAfterDays',
    'deepEqual',
    'DEFAULT_CPC_VALUE',
    'DELIVERY_TYPES',
    'detectAEMVersion',
    'detectBotBlocker',
    'detectLocale',
    'determineAEMCSPageId',
    'ensureHttps',
    'extractUrlsFromOpportunity',
    'extractUrlsFromSuggestion',
    'fetch',
    'FORMS_AUDIT_INTERVAL',
    'generateCSVFile',
    'getDateRanges',
    'getGranularityForIssueType',
    'getHighFormViewsLowConversionMetrics',
    'getHighPageViewsLowFormCtrMetrics',
    'getHighPageViewsLowFormViewsMetrics',
    'getLastNumberOfWeeks',
    'getMonthInfo',
    'getObjectFromKey',
    'getPageEditUrl',
    'getPrompt',
    'getQuery',
    'getSpacecatRequestHeaders',
    'getStaticContent',
    'getStoredMetrics',
    'getTemporalCondition',
    'getTraceId',
    'getWeekInfo',
    'GRANULARITY_KEY_BUILDERS',
    'Granularity',
    'hasNonWWWSubdomain',
    'hasText',
    'instrumentAWSClient',
    'isArray',
    'isAWSLambda',
    'isBoolean',
    'isInteger',
    'isIsoDate',
    'isIsoTimeOffsetsDate',
    'isNonEmptyArray',
    'isNonEmptyObject',
    'isNumber',
    'isObject',
    'isString',
    'isValidDate',
    'isValidEmail',
    'isValidHelixPreviewUrl',
    'isValidIMSOrgId',
    'isValidUrl',
    'isValidUUID',
    'ISSUE_GRANULARITY_MAP',
    'isoCalendarWeek',
    'isoCalendarWeekMonday',
    'isoCalendarWeekSunday',
    'llmoConfig',
    'llmoStrategy',
    'logWrapper',
    'OPPORTUNITY_TYPES',
    'prependSchema',
    'prettifyLogForwardingConfig',
    'replacePlaceholders',
    'resolveCanonicalUrl',
    'resolveCustomerSecretsName',
    'resolveSecretsName',
    's3Wrapper',
    'schemas',
    'SPACECAT_USER_AGENT',
    'sqsEventAdapter',
    'sqsWrapper',
    'storeMetrics',
    'stripPort',
    'stripTrailingDot',
    'stripTrailingSlash',
    'stripWWW',
    'toBoolean',
    'toggleWWWHostname',
    'tracingFetch',
    'urlMatchesFilter',
    'wwwUrlResolver',
  ];

  it('exports all expected functions', () => {
    expect(Object.keys(allExports)).to.have.members(expectedExports);
  });

  it('does not export anything unexpected', () => {
    expect(Object.keys(allExports)).to.have.lengthOf(expectedExports.length);
  });
});
