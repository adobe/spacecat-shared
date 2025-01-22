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
import bundlesForUrls from './fixtures/bundles.json' with { type: 'json' };
import resultForUrls from './fixtures/cwv/result-for-urls.json' with { type: 'json' };
import bundlesForPatterns from './fixtures/cwv/bundles-for-url-patterns.json' with { type: 'json' };
import resultForPatterns from './fixtures/cwv/result-for-url-patterns.json' with { type: 'json' };

describe('CWV Queries', () => {
  it('crunches CWV data', async () => {
    const result = cwv.handler(bundlesForUrls.rumBundles);
    expect(result).to.deep.equal(resultForUrls);
  });

  it('crunches CWV data based on url patterns', async () => {
    const groupedURLs = [
      { name: 'Catalog', pattern: 'https://www.aem.live/catalog/*' },
    ];

    const result = cwv.handler(bundlesForPatterns.rumBundles, { groupedURLs });
    expect(result).to.deep.equal(resultForPatterns);
  });
});
