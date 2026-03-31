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

import { expect } from 'chai';

import * as core from '../src/core.js';
import * as aws from '../src/aws.js';
import * as locale from '../src/locale.js';
import * as calendar from '../src/calendar.js';
import * as schemas from '../src/schemas.js';
import * as constants from '../src/constants.js';

const EXPECTED_CORE_EXPORTS = [
  'arrayEquals', 'dateAfterDays', 'deepEqual', 'hasText',
  'isArray', 'isBoolean', 'isInteger', 'isIsoDate', 'isIsoTimeOffsetsDate',
  'isNonEmptyArray', 'isNonEmptyObject', 'isNumber', 'isObject', 'isString',
  'isValidDate', 'isValidHelixPreviewUrl', 'isValidIMSOrgId', 'isValidUrl',
  'isValidUUID', 'toBoolean',
];

const EXPECTED_AWS_EXPORTS = [
  's3Wrapper', 'getObjectFromKey',
  'sqsWrapper', 'sqsEventAdapter',
  'instrumentAWSClient', 'getTraceId', 'addTraceIdHeader',
  'logWrapper', 'isAWSLambda',
  'fetch', 'resetFetchContext', 'clearFetchCache',
  'tracingFetch', 'SPACECAT_USER_AGENT',
  'getStoredMetrics', 'storeMetrics', 'calculateCPCValue',
];

const EXPECTED_LOCALE_EXPORTS = [
  'detectLocale',
];

const EXPECTED_CALENDAR_EXPORTS = [
  'getDateRanges', 'getLastNumberOfWeeks', 'getMonthInfo',
  'getTemporalCondition', 'getWeekInfo',
  'isoCalendarWeek', 'isoCalendarWeekMonday', 'isoCalendarWeekSunday',
];

const EXPECTED_SCHEMAS_EXPORTS = [
  'llmoConfig',
];

const EXPECTED_CONSTANTS_EXPORTS = [
  'DEFAULT_CPC_VALUE', 'OPPORTUNITY_TYPES',
];

describe('sub-path barrel shape checks', () => {
  it('core exports exactly the expected list', () => {
    expect([...Object.keys(core)].sort()).to.deep.equal(
      [...EXPECTED_CORE_EXPORTS].sort(),
      'Core exports changed. If you added a function to functions.js, update EXPECTED_CORE_EXPORTS in test/subpaths.test.js.',
    );
  });

  it('aws exports exactly the expected list', () => {
    expect([...Object.keys(aws)].sort()).to.deep.equal(
      [...EXPECTED_AWS_EXPORTS].sort(),
      'AWS exports changed. Update EXPECTED_AWS_EXPORTS in test/subpaths.test.js to match the new barrel.',
    );
  });

  it('locale exports exactly the expected list', () => {
    expect([...Object.keys(locale)].sort()).to.deep.equal(
      [...EXPECTED_LOCALE_EXPORTS].sort(),
      'Locale exports changed. Update EXPECTED_LOCALE_EXPORTS in test/subpaths.test.js.',
    );
  });

  it('calendar exports exactly the expected list', () => {
    expect([...Object.keys(calendar)].sort()).to.deep.equal(
      [...EXPECTED_CALENDAR_EXPORTS].sort(),
      'Calendar exports changed. Update EXPECTED_CALENDAR_EXPORTS in test/subpaths.test.js.',
    );
  });

  it('schemas exports exactly the expected list', () => {
    expect([...Object.keys(schemas)].sort()).to.deep.equal(
      [...EXPECTED_SCHEMAS_EXPORTS].sort(),
      'Schemas exports changed. Update EXPECTED_SCHEMAS_EXPORTS in test/subpaths.test.js.',
    );
  });

  it('constants exports exactly the expected list', () => {
    expect([...Object.keys(constants)].sort()).to.deep.equal(
      [...EXPECTED_CONSTANTS_EXPORTS].sort(),
      'Constants exports changed. Update EXPECTED_CONSTANTS_EXPORTS in test/subpaths.test.js.',
    );
  });
});
