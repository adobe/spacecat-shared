/*
 * Copyright 2024 Adobe. All rights reserved.
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
/* eslint-disable object-curly-newline */

import chai from 'chai';
import { classifyTrafficSource } from '../../src/common/traffic.js';

const { expect } = chai;
describe('Traffic classification', () => {
  const url = 'https://www.test.com/some/page';

  it('paid search', async () => {
    const fixtures = [
      { referrer: 'https://www.bing.com/', utmSource: '', utmMedium: 'paidsearch', tracking: [] },
      { referrer: 'https://www.google.co.uk/', utmSource: '', utmMedium: 'sea', tracking: [] },
      { referrer: 'https://yahoo.com/', utmSource: '', utmMedium: 'paidsearch', tracking: [] },
      { referrer: 'https://google.com/', utmSource: '', utmMedium: 'paidsearch', tracking: 'paid' },
    ];

    for (const f of fixtures) {
      const result = classifyTrafficSource(url, f.referrer, f.utmSource, f.utmMedium, f.tracking);
      expect(result).to.eql({ type: 'paid', category: 'search' });
    }
  });
});
