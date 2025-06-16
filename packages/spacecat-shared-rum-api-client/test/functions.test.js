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
import notfound from '../src/functions/404.js';
import internalLinks404 from '../src/functions/404-internal-links.js';
import experiment from '../src/functions/experiment.js';
import trafficAcquisition from '../src/functions/traffic-acquisition.js';
import highInorganicHighBounce from '../src/functions/opportunities/high-inorganic-high-bounce-rate.js';
import highOrganicLowCTR from '../src/functions/opportunities/high-organic-low-ctr.js';
import variant from '../src/functions/variant.js';
import formVitals from '../src/functions/form-vitals.js';
import pageviews from '../src/functions/pageviews.js';
import bundles from './fixtures/bundles.json' with { type: 'json' };
import bundlesWithTraffic from './fixtures/bundles-with-traffic-source.json' with { type: 'json' };
import bundlesWithForm from './fixtures/bundles-for-form-vitals.json' with { type: 'json' };
import bundlesForVariant from './fixtures/bundles_for_variant.json' with { type: 'json' };
import bundlesFor404InternalLinks from './fixtures/bundles-for-404-internal-links.json' with { type: 'json' };
import expected404Result from './fixtures/notfound.json' with { type: 'json' };
import expected404InternalLinksResult from './fixtures/404-internal-links-result.json' with { type: 'json' };
import expectedExperimentsResult from './fixtures/experiments.json' with { type: 'json' };
import expectedTrafficSourcesResult from './fixtures/trafficSources.json' with { type: 'json' };
import expectedVariantResult from './fixtures/variant.json' with { type: 'json' };
import expectedHighInorganicHighBounceResult from './fixtures/high-inorganic-high-bounce.json' with { type: 'json' };
import expectedHighOrganicLowCTRResult from './fixtures/high-organic-low-ctr.json' with { type: 'json' };
import expectedFormVitalsResult from './fixtures/expected-form-vitals-result.json' with { type: 'json' };

describe('Query functions', () => {
  it('crunches form vitals', async () => {
    const formVitalsResult = await formVitals.handler(bundlesWithForm.rumBundles);
    expect(expectedFormVitalsResult).to.deep.members(formVitalsResult);
  });

  it('crunches 404 data', async () => {
    const notfoundResult = notfound.handler(bundles.rumBundles);
    expect(expected404Result).to.eql(notfoundResult);
  });

  it('crunches 404 internal links data', async () => {
    const internalLinks404Result = internalLinks404.handler(bundlesFor404InternalLinks.rumBundles);
    expect(expected404InternalLinksResult).to.eql(internalLinks404Result);
  });

  it('crunches experiment data', async () => {
    const experimentsResult = experiment.handler(bundles.rumBundles);
    expect(experimentsResult).to.eql(expectedExperimentsResult);
  });

  it('crunches variant data', async () => {
    const variantResult = variant.handler(bundlesForVariant.rumBundles);
    expect(expectedVariantResult).to.eql(variantResult);
  });

  it('crunches traffic acquisition', async () => {
    const trafficSourcesResult = await trafficAcquisition.handler(bundles.rumBundles);
    expect(expectedTrafficSourcesResult).to.eql(trafficSourcesResult);
  });

  it('crunches oppty/high-inorganic-high-bounce', async () => {
    const highInorganicHighBounceResult = highInorganicHighBounce.handler(
      bundlesWithTraffic.rumBundles,
      { interval: 7 },
    );
    expect(expectedHighInorganicHighBounceResult).to.eql(highInorganicHighBounceResult);
  });

  it('crunches oppty/high-organic-low-ctr', async () => {
    const highInorganicHighBounceResult = highOrganicLowCTR.handler(
      bundlesWithTraffic.rumBundles,
      { interval: 7 },
    );
    expect(highInorganicHighBounceResult).to.eql(expectedHighOrganicLowCTRResult);
  });

  it('crunches pageviews', async () => {
    const result = pageviews.handler(
      bundles.rumBundles,
      { interval: 7 },
    );
    expect(result).to.eql({ pageviews: 24173 });
  });
});
