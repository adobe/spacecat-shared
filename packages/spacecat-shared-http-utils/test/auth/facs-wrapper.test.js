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

// New top-level shape: { INTERNAL_ROUTES, PRODUCTS_ROUTES }.
// Each product map's values are fully-qualified permission strings — no
// runtime composition.
const routeFacsCapabilities = {
  INTERNAL_ROUTES: [
    'GET /admin/users/:userId',
    'POST /configurations/audits',
  ],
  PRODUCTS_ROUTES: {
    LLMO: {
      'GET /insights': 'llmo/can_read',
      'GET /insights/:insightId': 'llmo/can_read',
      'POST /configurations': 'llmo/can_manage',
    },
    // ACO is populated but absent from FF_MAC_FACS_PERMISSIONS — used to
    // exercise the "no flag configured for product" bypass.
    ACO: {
      'GET /insights': 'aco/view',
    },
  },
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
      expect(() => facsWrapper(handler))
        .to.throw('facsWrapper: routeFacsCapabilities is required');
    });

    it('throws when routeFacsCapabilities is null', () => {
      expect(() => facsWrapper(handler, { routeFacsCapabilities: null }))
        .to.throw('facsWrapper: routeFacsCapabilities is required');
    });

    it('throws when PRODUCTS_ROUTES is missing', () => {
      expect(() => facsWrapper(handler, { routeFacsCapabilities: { INTERNAL_ROUTES: [] } }))
        .to.throw('facsWrapper: routeFacsCapabilities.PRODUCTS_ROUTES is required');
    });

    it('throws when PRODUCTS_ROUTES is not an object', () => {
      expect(() => facsWrapper(handler, { routeFacsCapabilities: { PRODUCTS_ROUTES: 'oops' } }))
        .to.throw('facsWrapper: routeFacsCapabilities.PRODUCTS_ROUTES is required');
    });

    it('accepts a config with PRODUCTS_ROUTES and no INTERNAL_ROUTES', () => {
      expect(() => facsWrapper(handler, { routeFacsCapabilities: { PRODUCTS_ROUTES: {} } }))
        .to.not.throw();
    });
  });

  describe('missing authInfo on non-OPTIONS', () => {
    it('does not crash; bypasses via no-x-product when no auth is present', async () => {
      delete context.attributes;
      context.pathInfo = { method: 'GET', suffix: '/insights', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('CORS preflight bypass', () => {
    it('bypasses OPTIONS even when x-product is present and route is unmapped', async () => {
      // Reproduces the deployment behaviour where Fastly forwards x-product
      // on the preflight. Without the OPTIONS bypass, this request would
      // reach deny-by-default (OPTIONS verb isn't in the product map).
      delete context.attributes;
      context.pathInfo = {
        method: 'OPTIONS',
        suffix: '/v2/regions',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(result).to.deep.equal({ status: 200 });
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
    beforeEach(() => {
      context.env = {
        FACS_EXCEPTION_INTERNAL_ORGS: '8C6043F15F43B6390A49401A, 908936ED5D35CC220A495CD4',
      };
    });

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

  describe('INTERNAL_ROUTES is accepted but not acted on', () => {
    // The wrapper accepts INTERNAL_ROUTES (callers use it for a coverage
    // invariant elsewhere) but does NOT bypass on it. External customers
    // hitting an internal route fall through to deny-by-default; internal
    // identities are already covered by the identity / org bypass above.

    it('does not bypass an external customer hitting a route listed in INTERNAL_ROUTES', async () => {
      const ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
      });
      context.pathInfo = {
        method: 'POST',
        suffix: '/configurations/audits', // listed in INTERNAL_ROUTES above
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mod.facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('still bypasses for an internal identity hitting a route listed in INTERNAL_ROUTES', async () => {
      context.attributes.authInfo = makeAuthInfo({ isAdmin: () => true });
      context.pathInfo = {
        method: 'POST',
        suffix: '/configurations/audits',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('missing x-product header', () => {
    it('bypasses (treats request as not enrolled in FACS)', async () => {
      context.pathInfo = { method: 'GET', suffix: '/insights', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(result).to.deep.equal({ status: 200 });
    });
  });

  describe('product not enrolled', () => {
    it('bypasses when the product is absent from PRODUCTS_ROUTES', async () => {
      context.pathInfo.headers = { 'x-product': 'unknown-product' };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(logStub.debug.calledWithMatch({ tag: 'facs' }, 'Product not enrolled in FACS — bypassing')).to.be.true;
    });

    it('bypasses when the product map is empty', async () => {
      const cfg = {
        INTERNAL_ROUTES: [],
        PRODUCTS_ROUTES: { LLMO: {} },
      };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities: cfg });
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
      expect(logStub.debug.calledWithMatch({ tag: 'facs' }, 'FACS flag disabled — bypassing')).to.be.true;
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

    it('bypasses when LaunchDarklyClient.createFrom throws (fail-open on missing LD config)', async () => {
      // IT environments and many test harnesses do not configure
      // LD_SDK_KEY; `createFrom` throws in that case. Must not crash the
      // wrapper — treat as flag unavailable → bypass.
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sinon.stub().throws(new Error('LaunchDarkly SDK key is required')),
          },
        },
      });
      const wrapped = mod.facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(result).to.deep.equal({ status: 200 });
      expect(logStub.debug.calledWithMatch({ tag: 'facs' }, 'LaunchDarkly client unavailable — bypassing FACS flag check')).to.be.true;
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
      expect(flagKey).to.equal('FF_LLMO-3026');
      expect(imsOrgId).to.equal('ORG-ABC@AdobeOrg');
    });

    it('bypasses (without calling LD) when product has no FACS flag configured', async () => {
      // ACO is in PRODUCTS_ROUTES but absent from FF_MAC_FACS_PERMISSIONS.
      context.pathInfo.headers = { 'x-product': 'aco' };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(ldClient.isFlagEnabledForIMSOrg.called).to.be.false;
      expect(logStub.debug.calledWithMatch({ tag: 'facs' }, 'No FACS flag configured for product — bypassing')).to.be.true;
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

    it('returns 403 for an unmapped route within an enrolled product', async () => {
      context.pathInfo = {
        method: 'DELETE',
        suffix: '/unknown',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(logStub.warn.calledWithMatch({ tag: 'facs' }, 'Route not in PRODUCTS_ROUTES — denying FACS user')).to.be.true;
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

    it('uses the full permission from the product map as-is (no runtime composition)', async () => {
      let capturedPermission;
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => {
          capturedPermission = p;
          return true;
        },
      });
      context.pathInfo = {
        method: 'POST',
        suffix: '/configurations',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      // The value stored in PRODUCTS_ROUTES.LLMO['POST /configurations'] is
      // 'llmo/can_manage' — passed through verbatim, not composed at runtime.
      expect(capturedPermission).to.equal('llmo/can_manage');
    });

    it('looks up the product in PRODUCTS_ROUTES case-insensitively (UPPER vs lower)', async () => {
      let capturedPermission;
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => {
          capturedPermission = p;
          return true;
        },
      });
      context.pathInfo = {
        method: 'GET',
        suffix: '/insights',
        headers: { 'x-product': 'LLMO' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(capturedPermission).to.equal('llmo/can_read');
    });

    it('resolves parameterised routes correctly', async () => {
      context.pathInfo = {
        method: 'GET',
        suffix: '/insights/abc-123',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('user identifier resolution in logs', () => {
    let ldClient;
    let mockedWrapper;
    let captured;

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mod.facsWrapper;
      captured = {};
      logStub.warn = (obj) => {
        captured.warn = obj;
      };
    });

    async function runDenied(profile) {
      context.attributes.authInfo = makeAuthInfo({
        getProfile: () => profile,
        hasFacsPermission: () => false,
      });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
    }

    it('prefers profile.sub when present (JWT session token)', async () => {
      await runDenied({ sub: 'ABC123@orgId', email: 'ravverma@adobe.com' });
      expect(captured.warn.user).to.equal('ABC123@orgId');
    });

    it('falls back to profile.email when sub is missing (IMS bearer token)', async () => {
      await runDenied({ email: 'ABC123@AdobeID' });
      expect(captured.warn.user).to.equal('ABC123@AdobeID');
    });

    it('returns undefined when no identifier field is present', async () => {
      await runDenied({});
      expect(captured.warn.user).to.equal(undefined);
    });

    it('returns undefined when authInfo.getProfile is missing', async () => {
      context.attributes.authInfo = {
        isAuthenticated: () => true,
        isAdmin: () => false,
        isS2SAdmin: () => false,
        isS2SConsumer: () => false,
        isReadOnlyAdmin: () => false,
        getTenantIds: () => ['CUST-ORG-123'],
        hasFacsPermission: () => false,
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(captured.warn.user).to.equal(undefined);
    });
  });

  describe('Phase 2 state-layer check (direct postgrestClient)', () => {
    let ldClient;
    let findFacsAccessMappingStub;
    let mockedWrapper;
    const phase2Config = {
      ...routeFacsCapabilities,
      PRODUCTS_ROUTES: {
        ...routeFacsCapabilities.PRODUCTS_ROUTES,
        LLMO: {
          ...routeFacsCapabilities.PRODUCTS_ROUTES.LLMO,
          'GET /brands/:brandId': 'llmo/can_read',
          'POST /brands': 'llmo/can_manage',
          'GET /insights': 'llmo/can_read',
        },
      },
      PRODUCTS_FACS_RESOURCE_PARAM_ALIASES: {
        LLMO: { brand: ['brandId'] },
      },
    };
    const dummyPostgrest = { from: () => {} }; // not called, just present.

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      findFacsAccessMappingStub = sinon.stub();
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
        '../../src/auth/facs-state-layer.js': {
          findFacsAccessMapping: findFacsAccessMappingStub,
        },
      });
      mockedWrapper = mod.facsWrapper;
      context.dataAccess = { services: { postgrestClient: dummyPostgrest } };
    });

    it('does not call the state-layer reader when route has no resolvable resource', async () => {
      findFacsAccessMappingStub.resolves({ id: 'm1' });
      context.pathInfo = {
        method: 'GET',
        suffix: '/insights',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(findFacsAccessMappingStub.called).to.be.false;
    });

    it('allows when a user-scoped mapping is found', async () => {
      findFacsAccessMappingStub.resolves({ id: 'm1' });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(findFacsAccessMappingStub.calledOnce).to.be.true;
      const [pg, keys] = findFacsAccessMappingStub.firstCall.args;
      expect(pg).to.equal(dummyPostgrest);
      expect(keys.subjectType).to.equal('user');
      expect(keys.resourceType).to.equal('brand');
      expect(keys.resourceId).to.equal('abc-123');
      expect(keys.facsPermission).to.equal('llmo/can_read');
    });

    it('falls back to org-scoped mapping when user-scoped is missing', async () => {
      findFacsAccessMappingStub.onCall(0).resolves(null);
      findFacsAccessMappingStub.onCall(1).resolves({ id: 'm2' });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(findFacsAccessMappingStub.calledTwice).to.be.true;
      expect(findFacsAccessMappingStub.secondCall.args[1].subjectType).to.equal('org');
    });

    it('denies with 403 when neither user-scoped nor org-scoped mapping exists', async () => {
      findFacsAccessMappingStub.resolves(null);
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.warn.calledWithMatch(
        { tag: 'facs' },
        'FACS state-layer mapping not found — denying',
      )).to.be.true;
    });

    it('fails closed (403) when the state-layer read throws', async () => {
      findFacsAccessMappingStub.rejects(new Error('postgrest down'));
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'facs' },
        'FACS state-layer read failed — denying',
      )).to.be.true;
    });

    it('resolves resource from body when route has no ReBAC URL params', async () => {
      findFacsAccessMappingStub.resolves({ id: 'm3' });
      context.pathInfo = {
        method: 'POST',
        suffix: '/brands',
        headers: { 'x-product': 'llmo' },
        params: {},
      };
      context.data = { brandId: 'b-from-body' };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      await wrapped({}, context);
      const keys = findFacsAccessMappingStub.firstCall.args[1];
      expect(keys.resourceType).to.equal('brand');
      expect(keys.resourceId).to.equal('b-from-body');
    });

    it('skips user-scoped lookup when no user identifier is resolvable; checks only org-scoped', async () => {
      findFacsAccessMappingStub.resolves({ id: 'm4' });
      context.attributes.authInfo = makeAuthInfo({
        getProfile: () => ({}),
        getTenantIds: () => ['CUST-ORG-123'],
      });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      await wrapped({}, context);
      expect(findFacsAccessMappingStub.calledOnce).to.be.true;
      expect(findFacsAccessMappingStub.firstCall.args[1].subjectType).to.equal('org');
    });

    it('skips the state-layer check when postgrestClient is not on context', async () => {
      delete context.dataAccess;
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(findFacsAccessMappingStub.called).to.be.false;
      expect(logStub.debug.calledWithMatch(
        { tag: 'facs' },
        'postgrestClient not on context — skipping state-layer check',
      )).to.be.true;
    });

    it('throws at wrapper construction if an alias is declared under multiple resources for a product', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          ...routeFacsCapabilities,
          PRODUCTS_FACS_RESOURCE_PARAM_ALIASES: {
            LLMO: { brand: ['brandId'], site: ['brandId'] },
          },
        },
      })).to.throw(/declared under multiple resources for product 'LLMO'/);
    });
  });
});
