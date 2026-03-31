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

/* eslint-env mocha */

import { expect } from 'chai';
import { getHelixFetch, resetHelixFetchClient } from '../src/helix-fetch.js';

describe('helix-fetch', () => {
  afterEach(() => {
    resetHelixFetchClient();
    // Restore setup-env.js default so nock-based suites keep HTTP/1 fetch.
    process.env.HELIX_FETCH_FORCE_HTTP1 = 'true';
  });

  it('returns the same fetch binding until reset', () => {
    const a = getHelixFetch();
    const b = getHelixFetch();
    expect(a).to.equal(b);
  });

  it('re-initializes fetch when HELIX_FETCH_FORCE_HTTP1 is set after reset', () => {
    const defaultFetch = getHelixFetch();
    resetHelixFetchClient();
    process.env.HELIX_FETCH_FORCE_HTTP1 = '1';
    const h1Fetch = getHelixFetch();
    expect(h1Fetch).to.be.a('function');
    expect(h1Fetch).to.not.equal(defaultFetch);
  });

  it('resetHelixFetchClient allows switching back to default stack', () => {
    process.env.HELIX_FETCH_FORCE_HTTP1 = '1';
    const h1Fetch = getHelixFetch();
    resetHelixFetchClient();
    delete process.env.HELIX_FETCH_FORCE_HTTP1;
    const again = getHelixFetch();
    expect(again).to.be.a('function');
    expect(again).to.not.equal(h1Fetch);
  });
});
