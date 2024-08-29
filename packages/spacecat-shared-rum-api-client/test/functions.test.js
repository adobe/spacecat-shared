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
import notfound from '../src/functions/404.js';
import experiment from '../src/functions/experiment.js';
import trafficAcquisition from '../src/functions/traffic-acquisition.js';
import highInorganicHighBounce from '../src/functions/opportunities/high-inorganic-high-bounce-rate.js';
import highOrganicLowCTR from '../src/functions/opportunities/high-organic-low-ctr.js';
import variant from '../src/functions/variant.js';
import bundles from './fixtures/bundles.json' assert { type: 'json' };
import bundlesForVariant from './fixtures/bundles_for_variant.json' assert { type: 'json' };
import expectedCwvResult from './fixtures/cwv.json' assert { type: 'json' };
import expected404Result from './fixtures/notfound.json' assert { type: 'json' };
import expectedExperimentsResult from './fixtures/experiments.json' assert { type: 'json' };
import expectedTrafficSourcesResult from './fixtures/trafficSources.json' assert { type: 'json' };
import expectedVariantResult from './fixtures/variant.json' assert { type: 'json' };

describe('Query functions', () => {
  it('crunches cwv data', async () => {
    const cwvResult = cwv.handler(bundles.rumBundles);
    expect(expectedCwvResult).to.eql(cwvResult);
  });

  it('crunches 404 data', async () => {
    const notfoundResult = notfound.handler(bundles.rumBundles);
    expect(expected404Result).to.eql(notfoundResult);
  });

  it('crunches experiment data', async () => {
    const experimentsResult = experiment.handler(bundles.rumBundles);
    expect(expectedExperimentsResult).to.eql(experimentsResult);
  });

  it('crunches variant data', async () => {
    const variantResult = variant.handler(bundlesForVariant.rumBundles);
    expect(expectedVariantResult).to.eql(variantResult);
  });

  it('crunches traffic acquisition', async () => {
    const trafficSourcesResult = await trafficAcquisition.handler(bundles.rumBundles);
    expect(expectedTrafficSourcesResult).to.eql(trafficSourcesResult);
  });

  xit('crunches oppty/high-inorganic-high-bounce', async () => {
    const highInorganicHighBounceResult = highInorganicHighBounce.handler(bundles.rumBundles);
    expect({}).to.eql(highInorganicHighBounceResult);
  });

  xit('crunches oppty/high-organic-low-ctr', async () => {
    const highInorganicHighBounceResult = highOrganicLowCTR.handler(
      bundles.rumBundles,
      { interval: 7 },
    );
    expect({}).to.eql(highInorganicHighBounceResult);
  });
});
