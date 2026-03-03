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

import { ensureCapability } from '../../../src/util/auth.js';

describe('ensureCapability', () => {
  it('passes through when s2sCtx is empty (end-user)', () => {
    expect(() => ensureCapability({}, 'site:read')).to.not.throw();
  });

  it('passes through when s2sCtx is null', () => {
    expect(() => ensureCapability(null, 'site:read')).to.not.throw();
  });

  it('passes through when s2sCtx is undefined', () => {
    expect(() => ensureCapability(undefined, 'site:read')).to.not.throw();
  });

  it('passes through when S2S consumer has the required capability', () => {
    const s2sCtx = {
      clientId: 'test-client',
      capabilities: ['site:read', 'site:write'],
      scopedOrgId: 'org1',
    };
    expect(() => ensureCapability(s2sCtx, 'site:read')).to.not.throw();
  });

  it('throws when S2S consumer is missing the required capability', () => {
    const s2sCtx = {
      clientId: 'test-client',
      capabilities: ['site:read'],
      scopedOrgId: 'org1',
    };
    expect(() => ensureCapability(s2sCtx, 'site:write'))
      .to.throw('Forbidden: S2S consumer is missing required capability: site:write');
  });

  it('throws when S2S consumer has no capabilities', () => {
    const s2sCtx = {
      clientId: 'test-client',
      capabilities: [],
      scopedOrgId: 'org1',
    };
    expect(() => ensureCapability(s2sCtx, 'site:read'))
      .to.throw('Forbidden: S2S consumer is missing required capability: site:read');
  });

  it('throws when S2S consumer capabilities is undefined', () => {
    const s2sCtx = {
      clientId: 'test-client',
      scopedOrgId: 'org1',
    };
    expect(() => ensureCapability(s2sCtx, 'site:read'))
      .to.throw('Forbidden: S2S consumer is missing required capability: site:read');
  });
});
