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
import ContentInsightsCalculator from '../../src/experiment-success/measurements/generic/content-insights.js';

function makeRun(phase, platform, citedLines = {}) {
  return { phase, platform, citedLines };
}

describe('ContentInsightsCalculator', () => {
  let calculator;
  const url = 'https://example.com/page';

  beforeEach(() => {
    calculator = new ContentInsightsCalculator({});
  });

  it('has the correct MEASUREMENT_KEY', () => {
    expect(ContentInsightsCalculator.MEASUREMENT_KEY).to.equal('contentInsights');
  });

  it('returns key contentInsights in the result', async () => {
    const result = await calculator.compute({ runs: [], targetUrls: [] });
    expect(result.key).to.equal('contentInsights');
  });

  it('detects new lines that appeared only in post phase', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', { [url]: ['line-a'] }),
      makeRun('post', 'chatgpt_paid', { [url]: ['line-a', 'line-b'] }),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: [url] });
    expect(value.byUrl[url].chatgpt_paid.newLines).to.deep.equal(['line-b']);
    expect(value.byUrl[url].chatgpt_paid.count).to.equal(1);
  });

  it('computes totalNewInsights across all URLs and platforms', async () => {
    const url2 = 'https://example.com/page2';
    const runs = [
      makeRun('baseline', 'chatgpt_paid', { [url]: ['a'] }),
      makeRun('post', 'chatgpt_paid', { [url]: ['a', 'b'], [url2]: ['c'] }), // 1 new for url, 1 new for url2
    ];
    const { value } = await calculator.compute({ runs, targetUrls: [url, url2] });
    expect(value.totalNewInsights).to.equal(2);
  });

  it('counts urlsWithNewInsights correctly', async () => {
    const url2 = 'https://example.com/page2';
    const runs = [
      makeRun('baseline', 'chatgpt_paid', {}),
      makeRun('post', 'chatgpt_paid', { [url]: ['new-line'] }), // url has new; url2 has none
    ];
    const { value } = await calculator.compute({ runs, targetUrls: [url, url2] });
    expect(value.urlsWithNewInsights).to.equal(1);
  });

  it('does not count baseline-only lines as new', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', { [url]: ['old-line'] }),
      makeRun('post', 'chatgpt_paid', { [url]: [] }),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: [url] });
    expect(value.byUrl[url].chatgpt_paid.newLines).to.deep.equal([]);
    expect(value.totalNewInsights).to.equal(0);
  });

  it('lines present in both baseline and post are not considered new', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', { [url]: ['shared-line'] }),
      makeRun('post', 'chatgpt_paid', { [url]: ['shared-line', 'new-line'] }),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: [url] });
    expect(value.byUrl[url].chatgpt_paid.newLines).to.deep.equal(['new-line']);
    expect(value.totalNewInsights).to.equal(1);
  });

  it('handles multiple platforms independently', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', { [url]: ['line-a'] }),
      makeRun('post', 'chatgpt_paid', { [url]: ['line-a', 'line-b'] }), // 1 new on chatgpt_paid
      makeRun('baseline', 'perplexity', { [url]: [] }),
      makeRun('post', 'perplexity', { [url]: ['line-c', 'line-d'] }), // 2 new on perplexity
    ];
    const { value } = await calculator.compute({ runs, targetUrls: [url] });
    expect(value.byUrl[url].chatgpt_paid.count).to.equal(1);
    expect(value.byUrl[url].perplexity.count).to.equal(2);
    expect(value.totalNewInsights).to.equal(3);
  });

  it('returns zero counts for empty inputs', async () => {
    const { value } = await calculator.compute({ runs: [], targetUrls: [] });
    expect(value.totalNewInsights).to.equal(0);
    expect(value.urlsWithNewInsights).to.equal(0);
    expect(value.byUrl).to.deep.equal({});
  });

  it('returns empty newLines when URL is not in any run citedLines', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', {}),
      makeRun('post', 'chatgpt_paid', {}),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: [url] });
    expect(value.byUrl[url].chatgpt_paid.newLines).to.deep.equal([]);
    expect(value.byUrl[url].chatgpt_paid.count).to.equal(0);
  });
});
