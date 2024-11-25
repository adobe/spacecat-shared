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

import { expect } from 'chai';
import cwv from '../src/functions/cwv.js';
import bundles from './fixtures/cwv/bundles-for-grouped-urls.json' assert { type: 'json' };
import expectedResult from './fixtures/cwv/result-bundles-for-grouped-urls.json' assert { type: 'json' };

describe('CWV Queries', () => {
  it('should correctly process CWV data and match expected result', async () => {
    const groupedURLs = [
      { name: 'Catalog', pattern: 'https://www.aem.live/catalog/*' },
      { name: 'Static Pages', pattern: 'https://www.aem.live/pages/*' },
    ];

    const cwvResult = cwv.handler(bundles.rumBundles, groupedURLs);
    expect(cwvResult).to.deep.equal(expectedResult);
  });
});
