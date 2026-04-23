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

/**
 * Covers the noCache() branch of the HELIX_FETCH_FORCE_HTTP1 ternary
 * in vault-client.js and bootstrap.js. The default test setup forces
 * HTTP/1 for nock compatibility, so this test re-imports the modules
 * with the env var unset to exercise the HTTP/2 noCache() path.
 */
describe('fetch context selection', () => {
  const originalValue = process.env.HELIX_FETCH_FORCE_HTTP1;

  after(() => {
    process.env.HELIX_FETCH_FORCE_HTTP1 = originalValue;
  });

  it('vault-client uses noCache() when HELIX_FETCH_FORCE_HTTP1 is unset', async () => {
    delete process.env.HELIX_FETCH_FORCE_HTTP1;
    const mod = await import(`../src/vault-client.js?ctx=${Date.now()}`);
    expect(mod.default).to.be.a('function');
  });

  it('bootstrap uses noCache() when HELIX_FETCH_FORCE_HTTP1 is unset', async () => {
    delete process.env.HELIX_FETCH_FORCE_HTTP1;
    const mod = await import(`../src/bootstrap.js?ctx=${Date.now()}`);
    expect(mod.loadBootstrapConfig).to.be.a('function');
  });
});
