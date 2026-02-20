/*
 * Copyright 2025 Adobe. All rights reserved.
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
import userEngagement from '../src/functions/user-engagement.js';

describe('userEngagement', () => {
  it('calculates user engagement metrics correctly', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [
          { checkpoint: 'enter' },
          { checkpoint: 'click', timeDelta: 2000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page1',
        weight: 50,
        events: [
          { checkpoint: 'enter' },
          // No click event
        ],
      },
      {
        id: 'bundle3',
        url: 'https://example.com/page2',
        weight: 200,
        events: [
          { checkpoint: 'enter' },
          { checkpoint: 'click', timeDelta: 1200 },
          { checkpoint: 'click', timeDelta: 1500 },
        ],
      },
    ];

    const result = userEngagement.handler(mockBundles);

    expect(result).to.be.an('array');
    expect(result).to.have.length(2);

    // Check page2 (higher totalTraffic, should be first)
    const page2 = result[1];
    expect(page2.url).to.equal('https://example.com/page2');
    expect(page2.totalTraffic).to.equal(200);
    expect(page2.engagementPercentage).to.equal(100);
    expect(page2.totalOrganicTraffic).to.equal(200);
    expect(page2.engagementTrafficOrganic).to.equal(200);
    expect(page2.engagementPercentageOrganic).to.equal(100);

    // Check page1
    const page1 = result[0];
    expect(page1.url).to.equal('https://example.com/page1');
    expect(page1.totalTraffic).to.equal(150);
    expect(page1.engagementPercentage).to.equal(67);
    expect(page1.totalOrganicTraffic).to.equal(150);
    expect(page1.engagementTrafficOrganic).to.equal(100);
    expect(page1.engagementPercentageOrganic).to.equal(67);
  });

  it('handles empty bundles array', () => {
    const result = userEngagement.handler([]);
    expect(result).to.be.an('array');
    expect(result).to.have.length(0);
  });

  it('handles bundles with no click events', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [{ checkpoint: 'enter' }],
      },
    ];

    const result = userEngagement.handler(mockBundles);

    expect(result).to.be.an('array');
    expect(result).to.have.length(1);

    const page = result[0];
    expect(page.url).to.equal('https://example.com/page1');
    expect(page.totalTraffic).to.equal(100);
    expect(page.engagementPercentage).to.equal(0);
    expect(page.totalOrganicTraffic).to.equal(100);
    expect(page.engagementTrafficOrganic).to.equal(0);
    expect(page.engagementPercentageOrganic).to.equal(0);
  });

  it('handles content engagement (viewmedia/viewblock)', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [
          { checkpoint: 'enter' },
          { checkpoint: 'viewmedia', timeDelta: 1000 },
          { checkpoint: 'viewmedia', timeDelta: 2000 },
          { checkpoint: 'viewmedia', timeDelta: 3000 },
          { checkpoint: 'viewmedia', timeDelta: 4000 },
        ],
      },
    ];

    const result = userEngagement.handler(mockBundles);

    expect(result).to.be.an('array');
    expect(result).to.have.length(1);

    const page = result[0];
    expect(page.url).to.equal('https://example.com/page1');
    expect(page.totalTraffic).to.equal(100);
    expect(page.engagementPercentage).to.equal(100);
    expect(page.totalOrganicTraffic).to.equal(100);
    expect(page.engagementTrafficOrganic).to.equal(100);
    expect(page.engagementPercentageOrganic).to.equal(100);
  });

  it('handles mixed click and content engagement', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [
          { checkpoint: 'enter' },
          { checkpoint: 'click', timeDelta: 1000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page1',
        weight: 50,
        events: [
          { checkpoint: 'enter' },
          { checkpoint: 'viewmedia', timeDelta: 1000 },
          { checkpoint: 'viewmedia', timeDelta: 2000 },
          { checkpoint: 'viewmedia', timeDelta: 3000 },
          { checkpoint: 'viewmedia', timeDelta: 4000 },
        ],
      },
    ];

    const result = userEngagement.handler(mockBundles);

    expect(result).to.be.an('array');
    expect(result).to.have.length(1);

    const page = result[0];
    expect(page.url).to.equal('https://example.com/page1');
    expect(page.totalTraffic).to.equal(150);
    expect(page.engagementPercentage).to.equal(100);
    expect(page.totalOrganicTraffic).to.equal(150);
    expect(page.engagementTrafficOrganic).to.equal(150);
    expect(page.engagementPercentageOrganic).to.equal(100);
  });

  it('excludes paid traffic from organic engagement', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [
          { checkpoint: 'enter' },
          { checkpoint: 'paid', source: 'cpc', target: 'google' },
          { checkpoint: 'click', timeDelta: 1000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page1',
        weight: 50,
        events: [
          { checkpoint: 'enter' },
          // no acquisition = organic
          { checkpoint: 'click', timeDelta: 500 },
        ],
      },
    ];

    const result = userEngagement.handler(mockBundles);

    expect(result).to.have.length(1);
    const page = result[0];
    expect(page.url).to.equal('https://example.com/page1');
    expect(page.totalTraffic).to.equal(150);
    expect(page.engagementTraffic).to.equal(150);
    expect(page.engagementPercentage).to.equal(100);
    expect(page.totalOrganicTraffic).to.equal(50);
    expect(page.engagementTrafficOrganic).to.equal(50);
    expect(page.engagementPercentageOrganic).to.equal(100);
  });

  it('has correct checkpoints', () => {
    expect(userEngagement.checkpoints).to.deep.equal([
      'click', 'viewmedia', 'viewblock', 'enter', 'utm', 'paid', 'email',
    ]);
  });

  it('ensures organic engagement never exceeds organic traffic', () => {
    const mockBundles = [
      {
        id: 'bundle1',
        url: 'https://example.com/page1',
        weight: 100,
        events: [
          { checkpoint: 'enter' },
          { checkpoint: 'click', timeDelta: 1000 },
        ],
      },
      {
        id: 'bundle2',
        url: 'https://example.com/page1',
        weight: 200,
        events: [
          { checkpoint: 'enter' },
          { checkpoint: 'paid', source: 'cpc', target: 'google' },
          { checkpoint: 'click', timeDelta: 500 },
        ],
      },
    ];

    const result = userEngagement.handler(mockBundles);

    expect(result).to.have.length(1);
    const page = result[0];
    expect(page.totalTraffic).to.equal(300);
    expect(page.engagementTraffic).to.equal(300);
    expect(page.totalOrganicTraffic).to.equal(100);
    expect(page.engagementTrafficOrganic).to.equal(100);
    expect(page.engagementTrafficOrganic).to.be.at.most(page.totalOrganicTraffic);
    expect(page.engagementPercentageOrganic).to.equal(100);
  });
});
