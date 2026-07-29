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
import { expect } from 'chai';
import notfound from '../src/functions/404.js';
import internalLinks404 from '../src/functions/404-internal-links.js';
import experiment from '../src/functions/experiment.js';
import trafficAcquisition from '../src/functions/traffic-acquisition.js';
import highInorganicHighBounce from '../src/functions/opportunities/high-inorganic-high-bounce-rate.js';
import highOrganicLowCTR from '../src/functions/opportunities/high-organic-low-ctr.js';
import variant from '../src/functions/variant.js';
import formVitals from '../src/functions/form-vitals.js';
import { computeFieldEngagement } from '../src/functions/form-field-engagement.js';
import pageviews from '../src/functions/pageviews.js';
import trafficAnalysis from '../src/functions/traffic-analysis.js';
import bundles from './fixtures/bundles.json' with { type: 'json' };
import bundlesWithTraffic from './fixtures/bundles-with-traffic-source.json' with { type: 'json' };
import bundlesWithForm from './fixtures/bundles-for-form-vitals.json' with { type: 'json' };
import bundlesTrafficAnalysis from './fixtures/bundles-for-traffic-analysis.json' with { type: 'json' };
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
import expectedTrafficAnalysisResult from './fixtures/expected-traffic-analysis-result.json' with { type: 'json' };

describe('Query functions', () => {
  it('crunches form vitals', async () => {
    const formVitalsResult = await formVitals.handler(bundlesWithForm.rumBundles);
    expect(expectedFormVitalsResult).to.deep.members(formVitalsResult);
  });

  it('attaches fieldEngagement to each form vitals entry', async () => {
    const formVitalsResult = await formVitals.handler(bundlesWithForm.rumBundles);
    // every entry carries a fieldEngagement array (like trafficacquisition)
    expect(formVitalsResult.every((e) => Array.isArray(e.fieldEngagement))).to.be.true;
    // the form#abc form on the jp magento-commerce URL has per-field engagement
    const entry = formVitalsResult.find(
      (e) => e.formsource === 'form#abc'
        && e.url === 'https://business.adobe.com/jp/products/magento/magento-commerce.html'
        && e.fieldEngagement.length > 0,
    );
    expect(entry).to.exist;
    const ageField = entry.fieldEngagement.find((f) => f.source === 'form#abc input[type=number] age');
    expect(ageField).to.deep.equal({
      source: 'form#abc input[type=number] age',
      clicks: 0,
      fills: 100,
      avg_time_spend: 0.34,
    });
    const nameField = entry.fieldEngagement.find((f) => f.source === 'form#abc input[type=text] firstName');
    expect(nameField).to.deep.equal({
      source: 'form#abc input[type=text] firstName',
      clicks: 200,
      fills: 0,
      avg_time_spend: 0,
    });
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
    let highOrganicLowCtrResult = highOrganicLowCTR.handler(
      bundlesWithTraffic.rumBundles,
      { interval: 7 },
    );
    expect(highOrganicLowCtrResult).to.eql(expectedHighOrganicLowCTRResult);
    highOrganicLowCtrResult = highOrganicLowCTR.handler([], { interval: 7 });
    expect(highOrganicLowCtrResult).to.eql([]);
  });

  it('high-organic-low-ctr returns max opportunities if configured', async () => {
    const highOrganicLowCtrResult = highOrganicLowCTR.handler(
      bundlesWithTraffic.rumBundles,
      { interval: 7, maxOpportunities: 1 },
    );
    expect(highOrganicLowCtrResult).to.eql(expectedHighOrganicLowCTRResult.slice(0, 1));
  });

  it('crunches pageviews', async () => {
    const result = pageviews.handler(
      bundles.rumBundles,
      { interval: 7 },
    );
    expect(result).to.eql({ pageviews: 24173 });
  });

  it('crunches traffic analysis', async () => {
    const trafficAnalysisResult = await trafficAnalysis.handler(bundlesTrafficAnalysis.rumBundles);
    expect(expectedTrafficAnalysisResult).to.eql(trafficAnalysisResult);
  });

  it('computeFieldEngagement: groups per-field click and fill counts, weighted by bundle weight', () => {
    const urlBundles = [
      {
        id: 'b1',
        url: 'https://example.com/contact',
        weight: 100,
        userAgent: 'desktop:windows',
        events: [
          { checkpoint: 'viewblock', source: 'form.contact', timeDelta: 200 },
          { checkpoint: 'fill', source: 'form.contact input[name="email"]', timeDelta: 3000 },
        ],
      },
      {
        id: 'b2',
        url: 'https://example.com/contact',
        weight: 50,
        userAgent: 'mobile:ios',
        events: [
          { checkpoint: 'viewblock', source: 'form.contact', timeDelta: 300 },
          { checkpoint: 'fill', source: 'form.contact input[name="email"]', timeDelta: 4000 },
          { checkpoint: 'click', source: 'form.contact button[type="submit"]', timeDelta: 8000 },
        ],
      },
    ];
    const fields = computeFieldEngagement(urlBundles, 'contact');
    const emailField = fields.find((f) => f.source === 'form.contact input[name="email"]');
    expect(emailField.fills).to.equal(150);
    expect(emailField.clicks).to.equal(0);
    // b2: fill@4000, next click@8000 → diff=4000ms → 4s (b1 fill is last event, no diff)
    expect(emailField.avg_time_spend).to.equal(4);
    const submitField = fields.find((f) => f.source === 'form.contact button[type="submit"]');
    expect(submitField.clicks).to.equal(50);
    expect(submitField.fills).to.equal(0);
    // submit click@8000 is last event in b2 → no diff → 0s
    expect(submitField.avg_time_spend).to.equal(0);
    // fields sorted by avg interaction time ascending (email avg=3500ms < submit avg=8000ms)
    expect(fields[0].source).to.equal('form.contact input[name="email"]');
    expect(fields[1].source).to.equal('form.contact button[type="submit"]');
  });

  it('computeFieldEngagement: returns empty array when no form field events', () => {
    const urlBundles = [{
      id: 'x1',
      url: 'https://example.com/page',
      weight: 100,
      userAgent: 'desktop:windows',
      events: [{ checkpoint: 'viewblock', source: 'form.contact', timeDelta: 500 }],
    }];
    expect(computeFieldEngagement(urlBundles, 'contact')).to.deep.equal([]);
  });

  it('computeFieldEngagement: excludes events not matching the form source', () => {
    const urlBundles = [{
      id: 'b1',
      url: 'https://example.com/contact',
      weight: 100,
      userAgent: 'desktop:windows',
      events: [
        { checkpoint: 'viewblock', source: 'form.contact', timeDelta: 200 },
        { checkpoint: 'click', source: 'nav a.logo', timeDelta: 1000 },
        { checkpoint: 'fill', source: 'form.contact input[name="email"]', timeDelta: 3000 },
      ],
    }];
    const fields = computeFieldEngagement(urlBundles, 'contact');
    expect(fields).to.have.lengthOf(1);
    expect(fields[0].source).to.equal('form.contact input[name="email"]');
  });

  it('computeFieldEngagement: matches generic form fields with unknown form key', () => {
    const urlBundles = [{
      id: 'b1',
      url: 'https://example.com/page',
      weight: 100,
      userAgent: 'desktop:windows',
      events: [
        { checkpoint: 'viewblock', source: 'dialog form', timeDelta: 200 },
        { checkpoint: 'fill', source: 'form input[name="email"]', timeDelta: 3000 },
      ],
    }];
    const fields = computeFieldEngagement(urlBundles, 'unknown');
    expect(fields).to.have.lengthOf(1);
    expect(fields[0].source).to.equal('form input[name="email"]');
  });
});
