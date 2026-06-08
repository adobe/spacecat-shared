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
import formFieldVitals from '../src/functions/form-field-vitals.js';
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

  it('crunches form field vitals from existing fixture', () => {
    const result = formFieldVitals.handler(bundlesWithForm.rumBundles);
    // The fixture has fill+click events for form#abc on the jp magento-commerce URL
    const entry = result.find((r) => r.formsource === 'form#abc');
    expect(entry).to.exist;
    expect(entry.url).to.equal('https://business.adobe.com/jp/products/magento/magento-commerce.html');
    const ageField = entry.fields.find((f) => f.source === 'form#abc input[type=number] age');
    expect(ageField).to.exist;
    expect(ageField.fills).to.equal(100);
    expect(ageField.clicks).to.equal(0);
    // avg_time_spend: diff to next event in bundle (ms) / 1000 → seconds, formatted to 2dp
    // age fill at 2662ms; next event in bundle at 2662+344=3006ms → diff=344ms → 0.344s → '0.34'
    expect(ageField.avg_time_spend).to.equal('0.34');
    const nameField = entry.fields.find((f) => f.source === 'form#abc input[type=text] firstName');
    expect(nameField).to.exist;
    expect(nameField.clicks).to.equal(200);
    expect(nameField.fills).to.equal(0);
    expect(nameField.avg_time_spend).to.equal('0.00');
    expect(entry.fields[0].source).to.equal('form#abc input[type=number] age');
    expect(entry.fields[1].source).to.equal('form#abc input[type=text] firstName');
  });

  it('returns empty array when bundles have no form field events', () => {
    const minimalBundles = [{
      id: 'x1',
      url: 'https://example.com/page',
      weight: 100,
      userAgent: 'desktop:windows',
      events: [{ checkpoint: 'viewblock', source: 'form.contact', timeDelta: 500 }],
    }];
    const result = formFieldVitals.handler(minimalBundles);
    expect(result).to.deep.equal([]);
  });

  it('groups per-field click and fill counts, weighted by bundle weight', () => {
    const testBundles = [
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
    const result = formFieldVitals.handler(testBundles);
    expect(result).to.have.lengthOf(1);
    const entry = result[0];
    expect(entry.url).to.equal('https://example.com/contact');
    expect(entry.formsource).to.equal('form.contact');
    const emailField = entry.fields.find((f) => f.source === 'form.contact input[name="email"]');
    expect(emailField.fills).to.equal(150);
    expect(emailField.clicks).to.equal(0);
    expect(emailField.avg_time_spend).to.equal('4.00');
    const submitField = entry.fields.find((f) => f.source === 'form.contact button[type="submit"]');
    expect(submitField.clicks).to.equal(50);
    expect(submitField.fills).to.equal(0);
    // submit click@8000 is last event in b2 → no diff → 0s → '0.00'
    expect(submitField.avg_time_spend).to.equal('0.00');
    // fields sorted by avg_time_spend descending (email=4.00 > submit=0.00)
    expect(entry.fields[0].source).to.equal('form.contact input[name="email"]');
    expect(entry.fields[1].source).to.equal('form.contact button[type="submit"]');
  });

  it('excludes events not matching the form source', () => {
    const testBundles = [{
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
    const result = formFieldVitals.handler(testBundles);
    expect(result).to.have.lengthOf(1);
    expect(result[0].fields).to.have.lengthOf(1);
    expect(result[0].fields[0].source).to.equal('form.contact input[name="email"]');
  });

  it('strips dialog prefix from formsource', () => {
    const testBundles = [{
      id: 'b1',
      url: 'https://example.com/page',
      weight: 100,
      userAgent: 'desktop:windows',
      events: [
        { checkpoint: 'viewblock', source: 'dialog form', timeDelta: 200 },
        { checkpoint: 'fill', source: 'form input[name="email"]', timeDelta: 3000 },
      ],
    }];
    const result = formFieldVitals.handler(testBundles);
    expect(result).to.have.lengthOf(1);
    expect(result[0].formsource).to.equal('form');
  });

  it('excludes entries whose fields are empty (no matching events)', () => {
    const testBundles = [{
      id: 'b1',
      url: 'https://example.com/contact',
      weight: 100,
      userAgent: 'desktop:windows',
      events: [
        { checkpoint: 'viewblock', source: 'form.contact', timeDelta: 200 },
        { checkpoint: 'viewblock', source: 'form.other', timeDelta: 300 },
        { checkpoint: 'fill', source: 'form.contact input[name="email"]', timeDelta: 3000 },
      ],
    }];
    const result = formFieldVitals.handler(testBundles);
    // form.other has no field events → excluded; only form.contact is in results
    expect(result.every((r) => r.fields.length > 0)).to.be.true;
    expect(result.find((r) => r.formsource === 'form.other')).to.not.exist;
  });
});
