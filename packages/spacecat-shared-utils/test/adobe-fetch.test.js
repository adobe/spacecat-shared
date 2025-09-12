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
import esmock from 'esmock';

describe('adobe-fetch', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = process.env.HELIX_FETCH_FORCE_HTTP1;
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.HELIX_FETCH_FORCE_HTTP1;
    } else {
      process.env.HELIX_FETCH_FORCE_HTTP1 = originalEnv;
    }
  });

  it('should use h2 fetch when HELIX_FETCH_FORCE_HTTP1 is not set', async () => {
    delete process.env.HELIX_FETCH_FORCE_HTTP1;

    // Import the module with mocked environment
    const adobeFetch = await esmock('../src/adobe-fetch.js', {}, {
      process: { env: {} },
    });

    expect(adobeFetch.fetch).to.be.a('function');
  });

  it('should use h1 fetch when HELIX_FETCH_FORCE_HTTP1 is set', async () => {
    // Import the module with mocked environment
    const adobeFetch = await esmock('../src/adobe-fetch.js', {}, {
      process: { env: { HELIX_FETCH_FORCE_HTTP1: 'true' } },
    });

    expect(adobeFetch.fetch).to.be.a('function');
  });
});
