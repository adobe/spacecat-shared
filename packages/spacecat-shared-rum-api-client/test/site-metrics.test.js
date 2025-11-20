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
import siteMetrics from '../src/functions/site-metrics.js';

describe('siteMetrics', () => {
  it.skip('calculates site-wide metrics correctly', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        cwvLCP: 2500,
        events: [
          { checkpoint: 'click', timeDelta: 2000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page2',
        weight: 50,
        cwvLCP: 3000,
        events: [
          { checkpoint: 'viewmedia', timeDelta: 1000 },
          { checkpoint: 'viewmedia', timeDelta: 2000 },
          { checkpoint: 'viewmedia', timeDelta: 3000 },
          { checkpoint: 'viewblock', timeDelta: 4000 },
        ],
      },
      {
        id: 'bundle3',
        url: 'https://example.com/page3',
        weight: 200,
        cwvLCP: 2000,
        events: [],
      },
    ];

    const result = siteMetrics.handler(mockBundles);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(350);
    // P75 LCP calculated from distribution
    expect(result.siteSpeed).to.be.a('number');
    expect(result.siteSpeed).to.be.greaterThan(0);
    // Engagement: (100 + 50) / 350 * 100 = 42.86%
    expect(result.avgEngagement).to.be.closeTo(42.86, 0.01);
  });

  it('handles empty bundles array', () => {
    const result = siteMetrics.handler([]);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(0);
    expect(result.siteSpeed).to.be.null;
    expect(result.avgEngagement).to.be.null;
  });

  it('handles bundles with no LCP data', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [
          { checkpoint: 'click', timeDelta: 2000 },
        ],
      },
    ];

    const result = siteMetrics.handler(mockBundles);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(100);
    expect(result.siteSpeed).to.be.null;
    expect(result.avgEngagement).to.equal(100);
  });

  it('handles bundles with no engagement', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        cwvLCP: 2500,
        events: [],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page2',
        weight: 50,
        cwvLCP: 3000,
        events: [
          { checkpoint: 'viewmedia', timeDelta: 1000 },
        ],
      },
    ];

    const result = siteMetrics.handler(mockBundles);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(150);
    // P75 LCP calculated from distribution
    expect(result.siteSpeed).to.be.a('number');
    expect(result.siteSpeed).to.be.greaterThan(0);
    expect(result.avgEngagement).to.equal(0);
  });

  it.skip('calculates engagement with click events', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        cwvLCP: 2500,
        events: [
          { checkpoint: 'click', timeDelta: 2000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page2',
        weight: 50,
        cwvLCP: 3000,
        events: [],
      },
    ];

    const result = siteMetrics.handler(mockBundles);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(150);
    // Engagement: 100 / 150 * 100 = 66.67%
    expect(result.avgEngagement).to.be.closeTo(66.67, 0.01);
  });

  it.skip('calculates engagement with content views (4+ viewmedia/viewblock)', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        cwvLCP: 2500,
        events: [
          { checkpoint: 'viewmedia', timeDelta: 1000 },
          { checkpoint: 'viewmedia', timeDelta: 2000 },
          { checkpoint: 'viewmedia', timeDelta: 3000 },
          { checkpoint: 'viewblock', timeDelta: 4000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page2',
        weight: 50,
        cwvLCP: 3000,
        events: [
          { checkpoint: 'viewmedia', timeDelta: 1000 },
          { checkpoint: 'viewmedia', timeDelta: 2000 },
        ],
      },
    ];

    const result = siteMetrics.handler(mockBundles);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(150);
    // Engagement: 100 / 150 * 100 = 66.67% (only bundle1 has 4+ content views)
    expect(result.avgEngagement).to.be.closeTo(66.67, 0.01);
  });

  it.skip('calculates engagement with both clicks and content views', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        cwvLCP: 2500,
        events: [
          { checkpoint: 'click', timeDelta: 2000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page2',
        weight: 50,
        cwvLCP: 3000,
        events: [
          { checkpoint: 'viewmedia', timeDelta: 1000 },
          { checkpoint: 'viewmedia', timeDelta: 2000 },
          { checkpoint: 'viewmedia', timeDelta: 3000 },
          { checkpoint: 'viewblock', timeDelta: 4000 },
        ],
      },
      {
        id: 'bundle3',
        url: 'https://example.com/page3',
        weight: 200,
        cwvLCP: 2000,
        events: [],
      },
    ];

    const result = siteMetrics.handler(mockBundles);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(350);
    // Engagement: (100 + 50) / 350 * 100 = 42.86%
    expect(result.avgEngagement).to.be.closeTo(42.86, 0.01);
  });

  it('handles bundles with only partial LCP data', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        cwvLCP: 2500,
        events: [
          { checkpoint: 'click', timeDelta: 2000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page2',
        weight: 50,
        events: [
          { checkpoint: 'click', timeDelta: 3000 },
        ],
      },
    ];

    const result = siteMetrics.handler(mockBundles);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(150);
    // Only bundle1 has LCP data, P75 will be based on that single value
    expect(result.siteSpeed).to.be.a('number');
    expect(result.siteSpeed).to.be.greaterThan(0);
    expect(result.avgEngagement).to.equal(100);
  });

  it('returns engagementCount along with other metrics', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        cwvLCP: 2500,
        events: [{ checkpoint: 'click', timeDelta: 2000 }],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page2',
        weight: 50,
        cwvLCP: 3000,
        events: [{ checkpoint: 'click', timeDelta: 1500 }],
      },
      {
        id: 'bundle3',
        url: 'https://example.com/page3',
        weight: 200,
        cwvLCP: 2000,
        events: [],
      },
    ];

    const result = siteMetrics.handler(mockBundles);

    expect(result).to.be.an('object');
    expect(result.pageviews).to.equal(350);
    expect(result.engagementCount).to.equal(150); // 100 + 50
    expect(result.avgEngagement).to.be.closeTo(42.86, 0.01); // (150/350) * 100
    expect(result.conversions).to.equal(150); // 100 + 50 (both have clicks)
    expect(result.conversionRate).to.be.closeTo(42.86, 0.01); // (150/350) * 100
    expect(result.siteSpeed).to.be.a('number');
  });

  it('has correct checkpoints', () => {
    expect(siteMetrics.checkpoints).to.deep.equal([]);
  });
});
