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
        formengagement: { total: 4300, desktop: 4000, mobile: 300 },
        formsubmit: { total: 0, desktop: 0, mobile: 0 },
        formview: { total: 300, desktop: 0, mobile: 300 },
        pageview: { total: 8670, desktop: 4670, mobile: 4000 },
        url: 'https://www.surest.com/info/win',
        trafficacquisition: {},
      },
      {
        formengagement: { total: 300, desktop: 0, mobile: 300 },
        formsubmit: { total: 0, desktop: 0, mobile: 0 },
        formview: { total: 300, desktop: 0, mobile: 300 },
        pageview: { total: 8670, desktop: 4670, mobile: 4000 },
        url: 'https://www.surest.com/newsletter',
        trafficacquisition: {},
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
        pageview: { total: 8670, desktop: 4670, mobile: 4000 },
        formview: { total: 300, desktop: 0, mobile: 300 },
        formengagement: { total: 300, desktop: 0, mobile: 300 },
        formsubmit: { total: 0, desktop: 0, mobile: 0 },
        trafficacquisition: {},
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
