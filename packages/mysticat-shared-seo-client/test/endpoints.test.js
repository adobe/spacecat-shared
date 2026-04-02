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

import { expect } from 'chai';

import { ENDPOINTS } from '../src/endpoints.js';

describe('ENDPOINTS', () => {
  const expectedKeys = [
    'topPages',
    'topPagesKeywords',
    'paidPages',
    'metrics',
    'organicTraffic',
    'organicKeywords',
    'brokenBacklinksPages',
    'brokenBacklinks',
    'backlinks',
    'metricsByCountry',
  ];

  it('exports all endpoint definitions', () => {
    expect(Object.keys(ENDPOINTS)).to.have.members(expectedKeys);
  });

  expectedKeys.forEach((key) => {
    it(`${key} has type, columns, and defaultParams`, () => {
      expect(ENDPOINTS[key]).to.have.property('type').that.is.a('string');
      expect(ENDPOINTS[key]).to.have.property('columns').that.is.a('string');
      expect(ENDPOINTS[key]).to.have.property('defaultParams').that.is.an('object');
    });
  });

  it('implemented endpoints have non-empty type', () => {
    const implemented = ['topPages', 'topPagesKeywords', 'paidPages', 'metrics', 'organicTraffic', 'organicKeywords', 'brokenBacklinksPages', 'brokenBacklinks'];
    implemented.forEach((key) => {
      expect(ENDPOINTS[key].type).to.not.equal('');
    });
  });

  it('stub endpoints have empty type', () => {
    const stubs = ['backlinks', 'metricsByCountry'];
    stubs.forEach((key) => {
      expect(ENDPOINTS[key].type).to.equal('');
    });
  });
});
