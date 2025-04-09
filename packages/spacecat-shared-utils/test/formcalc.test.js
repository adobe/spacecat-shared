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

/* eslint-env mocha */

import { expect } from 'chai';
import { formVitalsCollection, formVitalsCollection2 } from './fixtures/formcalcaudit.js';
import {
  getHighFormViewsLowConversionMetrics,
  getHighPageViewsLowFormCtrMetrics,
  getHighPageViewsLowFormViewsMetrics,
} from '../src/index.js';

describe('Form Calc functions', () => {
  it('getHighFormViewsLowConversion', () => {
    const result = getHighFormViewsLowConversionMetrics(formVitalsCollection);
    expect(result).to.eql([
      {
        url: 'https://www.surest.com/contact-us',
        pageViews: {
          desktop: 5690,
          mobile: 1000,
          total: 6690,
        },
        formViews: {
          desktop: 5690,
          mobile: 1000,
          total: 6690,
        },
        formEngagement: {
          desktop: 700,
          mobile: 300,
          total: 1000,
        },
        formSubmit: {
          desktop: 100,
          mobile: 0,
          total: 100,
        },
        trafficacquisition: {
          total: 1000,
          paid: 500,
          owned: 500,
          earned: 100,
        },
      },
    ]);
  });

  it('getHighPageViewsLowFormViews', () => {
    const result = getHighPageViewsLowFormViewsMetrics(formVitalsCollection);
    expect(result).to.eql([
      {
        url: 'https://www.surest.com/info/win',
        pageViews: 8670,
        formViews: 300,
        formEngagement: 4300,
      },
      {
        url: 'https://www.surest.com/newsletter',
        pageViews: 8670,
        formViews: 300,
        formEngagement: 300,
      },
    ]);
  });

  it('getHighPageViewsLowFormCtr', () => {
    const result = getHighPageViewsLowFormCtrMetrics(formVitalsCollection);
    expect(result).to.eql([
      {
        url: 'https://www.surest.com/newsletter',
        pageViews: {
          desktop: 4670,
          mobile: 4000,
          total: 8670,
        },
        formViews: {
          desktop: 0,
          mobile: 300,
          total: 300,
        },
        formEngagement: {
          desktop: 0,
          mobile: 300,
          total: 300,
        },
        formSubmit: {
          desktop: 0,
          mobile: 0,
          total: 0,
        },
        trafficacquisition: {
          total: null,
          paid: null,
          owned: null,
          earned: null,
        },
        CTA: {
          url: 'https://www.surest.com/about-us',
          source: '#teaser-related02 .cmp-teaser__action-link',
        },
      },
    ]);
  });

  it('getHighPageViewsLowFormCtr-2', () => {
    const result = getHighPageViewsLowFormCtrMetrics(formVitalsCollection2);
    expect(result).to.eql([]);
  });
});
