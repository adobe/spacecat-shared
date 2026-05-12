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
import sinon from 'sinon';
import esmock from 'esmock';

import { facsWrapper } from '../../src/auth/facs-wrapper.js';

const routeFacsCapabilities = {
  'GET /insights': 'can_read',
  'GET /insights/:insightId': 'can_read',
  'POST /configurations': 'can_manage',
};

function makeAuthInfo(overrides = {}) {
  return {
    isAuthenticated: () => true,
    isAdmin: () => false,
    isS2SAdmin: () => false,
    isS2SConsumer: () => false,
    isReadOnlyAdmin: () => false,
    getTenantIds: () => ['CUST-ORG-123'],
    getProfile: () => ({ sub: 'user@example.com' }),
    hasFacsPermission: () => true,
    ...overrides,
  };
}

describe('facsWrapper', () => {
  let logStub;
  let handler;
  let context;

  beforeEach(() => {
    logStub = {
      debug: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
    };
    handler = sinon.stub().resolves({ status: 200 });
    context = {
      log: logStub,
      pathInfo: {
        method: 'GET',
        suffix: '/insights',
        headers: { 'x-product': 'llmo' },
      },
      attributes: { authInfo: makeAuthInfo() },
    };
  });

  afterEach(() => sinon.restore());

  describe('creation-time guards', () => {
    it('throws when routeFacsCapabilities is not provided', () => {
      expect(() => facsWrapper(handler)).to.throw('facsWrapper: routeFacsCapabilities is required');
    });

    it('throws when routeFacsCapabilities is null', () => {
      expect(() => facsWrapper(handler, { routeFacsCapabilities: null }))
        .to.throw('facsWrapper: routeFacsCapabilities is required');
    });

    it('throws when routeFacsCapabilities is an empty object', () => {
      expect(() => facsWrapper(handler, { routeFacsCapabilities: {} }))
        .to.throw('facsWrapper: routeCapabilities must be a non-empty object');
    });
  });

  describe('unauthenticated passthrough', () => {
    it('passes through when authInfo is absent', async () => {
      delete context.attributes;
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('passes through when isAuthenticated returns false', async () => {
      context.attributes.authInfo = makeAuthInfo({ isAuthenticated: () => false });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('internal identity bypass', () => {
    it('bypasses for isAdmin', async () => {
      context.attributes.authInfo = makeAuthInfo({ isAdmin: () => true });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('bypasses for isS2SAdmin', async () => {
      context.attributes.authInfo = makeAuthInfo({ isS2SAdmin: () => true });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('bypasses for isS2SConsumer', async () => {
      context.attributes.authInfo = makeAuthInfo({ isS2SConsumer: () => true });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('bypasses for isReadOnlyAdmin', async () => {
      context.attributes.authInfo = makeAuthInfo({ isReadOnlyAdmin: () => true });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('internal org bypass', () => {
    it('bypasses for Adobe internal stag org ID', async () => {
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => ['8C6043F15F43B6390A49401A'],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(logStub.debug.calledWithMatch({ tag: 'facs' }, 'Internal Adobe org — bypassing FACS')).to.be.true;
    });

    it('bypasses for Adobe internal prod org ID', async () => {
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => ['908936ED5D35CC220A495CD4'],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('feature flag gate', () => {
    let ldClient;
    let mockedWrapper;

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mod.facsWrapper;
    });

    it('bypasses when flag is disabled for the org', async () => {
      ldClient.isFlagEnabledForIMSOrg.resolves(false);
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(logStub.debug.calledWithMatch({ tag: 'facs' }, 'FT_MAC_FACS_PERMISSIONS disabled — bypassing')).to.be.true;
    });

    it('bypasses when ldClient is null (fail-open on flag unavailability)', async () => {
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(null) },
        },
      });
      const wrapped = mod.facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('bypasses when isFlagEnabledForIMSOrg rejects (fail-open on flag unavailability)', async () => {
      ldClient.isFlagEnabledForIMSOrg.rejects(new Error('LD unavailable'));
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('skips flag check and enforces when orgId is absent', async () => {
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => [],
        hasFacsPermission: () => false,
      });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(ldClient.isFlagEnabledForIMSOrg.called).to.be.false;
    });

    it('evaluates flag with correct org ID and flag key', async () => {
      context.attributes.authInfo = makeAuthInfo({ getTenantIds: () => ['ORG-ABC'] });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      const [flagKey, imsOrgId] = ldClient.isFlagEnabledForIMSOrg.firstCall.args;
      expect(flagKey).to.equal('FT_MAC_FACS_PERMISSIONS');
      expect(imsOrgId).to.equal('ORG-ABC@AdobeOrg');
    });
  });

  describe('route resolution and permission enforcement', () => {
    let ldClient;
    let mockedWrapper;

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mod.facsWrapper;
    });

    it('returns 403 for an unmapped route', async () => {
      context.pathInfo = { method: 'DELETE', suffix: '/unknown', headers: { 'x-product': 'llmo' } };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(logStub.warn.calledWithMatch({ tag: 'facs' }, 'Route not in routeFacsCapabilities — denying FACS user')).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('returns 400 when x-product header is missing', async () => {
      context.pathInfo = { method: 'GET', suffix: '/insights', headers: {} };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(400);
      const body = await result.json();
      expect(body.message).to.equal('x-product header is required');
      expect(logStub.warn.calledWithMatch({ tag: 'facs' }, 'Missing x-product header for FACS-gated route')).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('returns 403 when the user lacks the required FACS permission', async () => {
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(logStub.warn.calledWithMatch({ tag: 'facs', permission: 'llmo/can_read' }, 'FACS permission denied')).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('passes through when the user holds the required FACS permission', async () => {
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('composes permission as <product>/<action> from header and route map', async () => {
      let capturedPermission;
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => {
          capturedPermission = p;
          return true;
        },
      });
      context.pathInfo = { method: 'POST', suffix: '/configurations', headers: { 'x-product': 'aso' } };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(capturedPermission).to.equal('aso/can_manage');
    });

    it('lowercases the product code from the x-product header', async () => {
      let capturedPermission;
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => {
          capturedPermission = p;
          return true;
        },
      });
      context.pathInfo = { method: 'GET', suffix: '/insights', headers: { 'x-product': 'LLMO' } };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(capturedPermission).to.equal('llmo/can_read');
    });

    it('resolves parameterised routes correctly', async () => {
      context.pathInfo = { method: 'GET', suffix: '/insights/abc-123', headers: { 'x-product': 'llmo' } };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });
  });
});
