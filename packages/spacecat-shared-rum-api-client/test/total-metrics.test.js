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
import totalMetrics from '../src/functions/total-metrics.js';
import bundlesForUrls from './fixtures/bundles.json' with { type: 'json' };
/* eslint-env mocha */

describe('Total Metrics Queries', () => {
  it('crunches CWV data', async () => {
    const result = totalMetrics.handler(bundlesForUrls.rumBundles);
    expect(result).to.have.property('totalCTR', 0.2027468663384768);
    expect(result).to.have.property('totalClicks', 4901);
    expect(result).to.have.property('totalPageViews', 24173);
    expect(result).to.have.property('totalLCP');
    expect(result).to.have.property('totalEngagement');
    expect(result.totalEngagement).to.be.a('number');
  });

  it('calculates engagement metrics correctly', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [
          { checkpoint: 'click', timeDelta: 2000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page1',
        weight: 100,
        events: [],
      },
    ];

    const result = totalMetrics.handler(mockBundles);
    expect(result).to.have.property('totalEngagement', 100);
    expect(result).to.have.property('totalPageViews', 200);
  });

  it('calculates engagement with content engagement', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [
          { checkpoint: 'viewmedia', timeDelta: 1000 },
          { checkpoint: 'viewmedia', timeDelta: 2000 },
          { checkpoint: 'viewmedia', timeDelta: 3000 },
          { checkpoint: 'viewmedia', timeDelta: 4000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page2',
        weight: 100,
        events: [],
      },
    ];

    const result = totalMetrics.handler(mockBundles);
    expect(result).to.have.property('totalEngagement', 100);
  });

  it('handles zero page views for engagement', () => {
    const result = totalMetrics.handler([]);
    expect(result).to.have.property('totalEngagement', 0);
  });
});
