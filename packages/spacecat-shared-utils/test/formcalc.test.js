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
import {
  getHighFormViewsLowConversionMetrics,
} from '../src/index.js';

describe('Form Calc functions', () => {
  it('getHighFormViewsLowConversion', () => {
    const formVitalsCollection = [
      {
        url: 'https://www.surest.com/contact-us',
        formsubmit: {
          'desktop:windows': 100,
        },
        formview: {},
        formengagement: {
          'desktop:windows': 700,
          'mobile:ios': 300,
        },
        pageview: {
          'desktop:windows': 5690,
          'mobile:ios': 1000,
        },
      },
      {
        url: 'https://www.surest.com/info/win',
        formsubmit: {
        },
        formview: {},
        formengagement: {
          'desktop:windows': 4000,
          'mobile:ios': 300,
        },
        pageview: {
          'desktop:windows': 4670,
          'mobile:ios': 1000,
        },
      },
    ];

    const result = getHighFormViewsLowConversionMetrics(formVitalsCollection, 7);
    expect(result).to.eql([
      {
        url: 'https://www.surest.com/contact-us',
        pageViews: 6690,
        formViews: 6690,
        formEngagement: 1000,
        formSubmit: 100,
      },
    ]);
  });
});
