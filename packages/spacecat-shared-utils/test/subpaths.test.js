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

const EXPECTED_CORE_EXPORTS = [
  'arrayEquals', 'dateAfterDays', 'deepEqual', 'hasText',
  'isArray', 'isBoolean', 'isInteger', 'isIsoDate', 'isIsoTimeOffsetsDate',
  'isNonEmptyArray', 'isNonEmptyObject', 'isNumber', 'isObject', 'isString',
  'isValidDate', 'isValidHelixPreviewUrl', 'isValidIMSOrgId', 'isValidUrl',
  'isValidUUID', 'toBoolean',
];

describe('sub-path barrel shape checks', () => {
  it('core exports exactly the expected list', () => {
    expect(Object.keys(core).sort()).to.deep.equal(
      EXPECTED_CORE_EXPORTS.sort(),
      'Core exports changed. If you added a function to functions.js, update EXPECTED_CORE_EXPORTS in test/subpaths.test.js.',
    );
  });
});
