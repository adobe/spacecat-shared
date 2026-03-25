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
    'analyzeBotProtection',
    'addTraceIdHeader',
    'arrayEquals',
    'AUDIT_OPPORTUNITY_MAP',
    'AUTHORING_TYPES',
    'buildAggregationKey',
    'buildAggregationKeyFromSuggestion',
    'buildIndividualKey',
    'buildKey',
    'buildSuggestionKey',
    'calculateCPCValue',
    'canonicalizeUrl',
    'composeAuditURL',
    'composeBaseURL',
    'dateAfterDays',
    'deepEqual',
    'DEFAULT_CPC_VALUE',
    'DELIVERY_TYPES',
    'DEPENDENCY_SOURCES',
    'detectAEMVersion',
    'detectBotBlocker',
    'detectLocale',
    'determineAEMCSPageId',
    'ensureHttps',
    'extractUrlsFromOpportunity',
    'extractUrlsFromSuggestion',
    'clearFetchCache',
    'fetch',
    'formatAllowlistMessage',
    'FORMS_AUDIT_INTERVAL',
    'generateCSVFile',
    'getAuditsForOpportunity',
    'getAllAuditTypes',
    'getAllOpportunityTypes',
    'getCurrentCycle',
    'getDateRanges',
    'getDependenciesForOpportunity',
    'getGranularityForIssueType',
    'getHighFormViewsLowConversionMetrics',
    'getHighPageViewsLowFormCtrMetrics',
    'getHighPageViewsLowFormViewsMetrics',
    'getLastNumberOfWeeks',
    'getMonthInfo',
    'getObjectFromKey',
    'getOpportunitiesForAudit',
    'getOpportunitiesForSource',
    'getOpportunityTitle',
    'getPageEditUrl',
    'getPrompt',
    'getQuery',
    'getSpacecatBotIps',
    'getSpacecatRequestHeaders',
    'getStaticContent',
    'getStoredMetrics',
    'getTemporalCondition',
    'getTokenGrantConfig',
    'getTokenGrantConfigByOpportunity',
    'getTokenTypeForOpportunity',
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
    'OPPORTUNITY_DEPENDENCY_MAP',
    'OPPORTUNITY_GRANT_CONFIG',
    'OPPORTUNITY_TITLES',
    'OPPORTUNITY_TYPES',
    'prependSchema',
    'prettifyLogForwardingConfig',
    'replacePlaceholders',
    'resolveCanonicalUrl',
    'resetFetchContext',
    'resolveCustomerSecretsName',
    'resolveSecretsName',
    's3Wrapper',
    'schemas',
    'SPACECAT_BOT_USER_AGENT',
    'SPACECAT_USER_AGENT',
    'sqsEventAdapter',
    'sqsWrapper',
    'storeMetrics',
    'stripPort',
    'stripTrailingDot',
    'stripTrailingSlash',
    'stripWWW',
    'TOKEN_GRANT_CONFIG',
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
