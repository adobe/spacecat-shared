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
    'arrayEquals',
    'composeAuditURL',
    'composeBaseURL',
    'dateAfterDays',
    'deepEqual',
    'fetch',
    'generateCSVFile',
    'getStoredMetrics',
    'replacePlaceholders',
    'getPrompt',
    'getQuery',
    'hasText',
    'isArray',
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
    'isValidUrl',
    'isValidUUID',
    'isValidIMSOrgId',
    'logWrapper',
    'prependSchema',
    'resolveCustomerSecretsName',
    'resolveSecretsName',
    's3Wrapper',
    'sqsEventAdapter',
    'sqsWrapper',
    'storeMetrics',
    'stripPort',
    'stripTrailingDot',
    'stripTrailingSlash',
    'stripWWW',
    'toBoolean',
    'tracingFetch',
    'getHighFormViewsLowConversionMetrics',
    'getHighPageViewsLowFormViewsMetrics',
    'getHighPageViewsLowFormCtrMetrics',
    'FORMS_AUDIT_INTERVAL',
    'SPACECAT_USER_AGENT',
    'isAWSLambda',
    'instrumentAWSClient',
  ];

  it('exports all expected functions', () => {
    expect(Object.keys(allExports)).to.have.members(expectedExports);
  });

  it('does not export anything unexpected', () => {
    expect(Object.keys(allExports)).to.have.lengthOf(expectedExports.length);
  });
});
