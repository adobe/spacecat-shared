/*
 * Copyright 2026 Adobe. All rights reserved.
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
import UrlPresenceCalculator from '../../src/experiment-success/measurements/generic/url-presence.js';

function makeRun(phase, platform, citedUrls = []) {
  return { phase, platform, citedUrls };
}

describe('UrlPresenceCalculator', () => {
  let calculator;
  const targetUrls = ['https://example.com/a', 'https://example.com/b'];

  beforeEach(() => {
    calculator = new UrlPresenceCalculator({});
  });

  it('has the correct MEASUREMENT_KEY', () => {
    expect(UrlPresenceCalculator.MEASUREMENT_KEY).to.equal('urlPresence');
  });

  it('returns key urlPresence in the result', async () => {
    const result = await calculator.compute({ runs: [], targetUrls: [] });
    expect(result.key).to.equal('urlPresence');
  });

  it('classifies a URL as gained when it appears in post but not baseline', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', []),
      makeRun('post', 'chatgpt_paid', ['https://example.com/a']),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: ['https://example.com/a'] });
    expect(value.summary.gained).to.equal(1);
    expect(value.byUrl['https://example.com/a'].chatgpt_paid.status).to.equal('gained');
  });

  it('classifies a URL as lost when it appears in baseline but not post', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', ['https://example.com/a']),
      makeRun('post', 'chatgpt_paid', []),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: ['https://example.com/a'] });
    expect(value.summary.lost).to.equal(1);
    expect(value.byUrl['https://example.com/a'].chatgpt_paid.status).to.equal('lost');
  });

  it('classifies a URL as maintained when it appears in both baseline and post', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', ['https://example.com/a']),
      makeRun('post', 'chatgpt_paid', ['https://example.com/a']),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: ['https://example.com/a'] });
    expect(value.summary.maintained).to.equal(1);
    expect(value.byUrl['https://example.com/a'].chatgpt_paid.status).to.equal('maintained');
  });

  it('classifies a URL as absent when it does not appear in either phase', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', []),
      makeRun('post', 'chatgpt_paid', []),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: ['https://example.com/a'] });
    expect(value.summary.absent).to.equal(1);
    expect(value.byUrl['https://example.com/a'].chatgpt_paid.status).to.equal('absent');
  });

  it('computes correct summary counts across multiple URLs and platforms', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', ['https://example.com/a']), // a maintained
      makeRun('post', 'chatgpt_paid', ['https://example.com/a', 'https://example.com/b']), // b gained
    ];
    const { value } = await calculator.compute({ runs, targetUrls });
    expect(value.summary.maintained).to.equal(1);
    expect(value.summary.gained).to.equal(1);
  });

  it('correctly computes pre/post/delta values', async () => {
    const runs = [
      makeRun('baseline', 'perplexity', ['https://example.com/a']),
      makeRun('post', 'perplexity', []),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: ['https://example.com/a'] });
    const entry = value.byUrl['https://example.com/a'].perplexity;
    expect(entry.pre).to.equal(1);
    expect(entry.post).to.equal(0);
    expect(entry.delta).to.equal(-1);
  });

  it('handles targetUrls not present in any run as absent', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_free', []),
      makeRun('post', 'chatgpt_free', []),
    ];
    const { value } = await calculator.compute({ runs, targetUrls: ['https://example.com/missing'] });
    expect(value.byUrl['https://example.com/missing'].chatgpt_free.status).to.equal('absent');
  });

  it('handles multiple platforms independently', async () => {
    const runs = [
      makeRun('baseline', 'chatgpt_paid', []),
      makeRun('post', 'chatgpt_paid', ['https://example.com/a']), // gained on chatgpt_paid
      makeRun('baseline', 'perplexity', ['https://example.com/a']),
      makeRun('post', 'perplexity', []), // lost on perplexity
    ];
    const { value } = await calculator.compute({ runs, targetUrls: ['https://example.com/a'] });
    expect(value.byUrl['https://example.com/a'].chatgpt_paid.status).to.equal('gained');
    expect(value.byUrl['https://example.com/a'].perplexity.status).to.equal('lost');
  });

  it('returns empty byUrl and zero summary for empty inputs', async () => {
    const { value } = await calculator.compute({ runs: [], targetUrls: [] });
    expect(value.byUrl).to.deep.equal({});
    expect(value.summary).to.deep.equal({
      gained: 0, lost: 0, maintained: 0, absent: 0,
    });
  });
});
