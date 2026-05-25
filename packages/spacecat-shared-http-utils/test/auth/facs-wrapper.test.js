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
      'GET /insights': ['llmo/can_read'],
      'GET /insights/:insightId': ['llmo/can_read'],
      'POST /configurations': ['llmo/can_manage'],
    },
    // ACO is populated but absent from FT_MAC_FACS_PERMISSIONS — used to
    // exercise the "no flag configured for product" bypass.
    ACO: {
      'GET /insights': ['aco/view'],
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
    it('does not crash; fails closed (403) when no auth and route is FACS-governed', async () => {
      // Under the new fail-closed contract: route IS in some product map
      // (GET /insights is in LLMO + ACO) but request has no x-product →
      // 403, not bypass. Test asserts the wrapper survives missing authInfo
      // and reaches the fail-closed branch without crashing.
      delete context.attributes;
      context.pathInfo = { method: 'GET', suffix: '/insights', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('does not crash; bypasses when no auth and route is not FACS-governed', async () => {
      delete context.attributes;
      context.pathInfo = { method: 'GET', suffix: '/non-facs/path', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(result).to.deep.equal({ status: 200 });
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

    it('bypasses for legacyApiKey auth type (api-keys are internal trust)', async () => {
      // Legacy api-key handler sets withType('legacyApiKey') and a profile
      // like { user_id: 'admin' } — NO is_admin flag. Without the auth-type
      // bypass this would fall through to the FACS-governance gate and 403
      // on every FACS-mapped route.
      context.attributes.authInfo = makeAuthInfo({ getType: () => 'legacyApiKey' });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('bypasses for scopedApiKey auth type', async () => {
      context.attributes.authInfo = makeAuthInfo({ getType: () => 'scopedApiKey' });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('tenant assertion', () => {
    it('fails closed (500) when authInfo.getTenantIds() returns more than one tenant', async () => {
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => ['ORG-A', 'ORG-B'],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(500);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'facs', tenantCount: 2 },
        'authInfo.getTenantIds() returned more than one tenant — failing closed',
      )).to.be.true;
    });

    it('proceeds normally when getTenantIds() returns exactly one tenant', async () => {
      // Sanity check that the assertion is one-sided (only > 1 fails).
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => ['ORG-A'],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      // Exact downstream outcome depends on LD, but the assertion did not fire.
      expect(result.status).to.not.equal(500);
    });

    it('proceeds normally when getTenantIds() returns an empty array', async () => {
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => [],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.not.equal(500);
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
      expect(logStub.info.calledWithMatch({ tag: 'facs' }, 'FACS bypass: Adobe internal IMS org')).to.be.true;
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

  describe('INTERNAL_ROUTES — controllers gate, wrapper bypasses', () => {
    // INTERNAL_ROUTES is disjoint from every product sub-map (coverage
    // invariant enforced by the api-service capability test). Under the
    // new fail-closed bypass ladder, a route that's not in any product
    // map — including every INTERNAL_ROUTES entry — bypasses the wrapper.
    // Controllers gate via hasAdminAccess / equivalent (see mac-state-layer.md
    // §"Controllers are not modified by this design").

    it('bypasses an external customer hitting a route listed in INTERNAL_ROUTES (controllers gate)', async () => {
      const ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
      });
      context.pathInfo = {
        method: 'POST',
        suffix: '/configurations/audits', // listed in INTERNAL_ROUTES above, NOT in any product map
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mod.facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      // Wrapper bypasses; the controller's hasAdminAccess / equivalent is
      // expected to deny the external customer downstream.
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('bypasses an internal identity hitting a route listed in INTERNAL_ROUTES', async () => {
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

  describe('missing x-product header — fail-closed', () => {
    it('returns 403 when route IS in some product map but x-product is absent', async () => {
      // GET /insights is in PRODUCTS_ROUTES.LLMO and PRODUCTS_ROUTES.ACO.
      // No x-product means the wrapper can't pick a policy → fail-closed.
      context.pathInfo = { method: 'GET', suffix: '/insights', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.warn.calledWithMatch(
        { tag: 'facs' },
        'FACS-governed route called without matching x-product — denying',
      )).to.be.true;
    });

    it('bypasses when route is NOT in any product map and x-product is absent', async () => {
      context.pathInfo = { method: 'GET', suffix: '/non-facs/path', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('unknown / wrong x-product — fail-closed when route is FACS-governed', () => {
    it('returns 403 when x-product names an unknown product but route IS in some other product map', async () => {
      // GET /insights IS in LLMO + ACO. x-product='unknown-product' means
      // the wrapper can't pick a policy → fail-closed.
      context.pathInfo.headers = { 'x-product': 'unknown-product' };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('bypasses when route map for the named product is empty AND no other product claims the route', async () => {
      // Empty LLMO sub-map means LLMO is not enrolled; no other product
      // claims this route either → not FACS-governed → bypass.
      const cfg = {
        INTERNAL_ROUTES: [],
        PRODUCTS_ROUTES: { LLMO: {} },
      };
      context.pathInfo = { method: 'GET', suffix: '/anything', headers: { 'x-product': 'llmo' } };
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
      expect(logStub.info.calledWithMatch({ tag: 'facs' }, 'FACS bypass: LaunchDarkly flag disabled for org')).to.be.true;
    });

    it('returns 503 (fail-closed) when LaunchDarklyClient.createFrom throws', async () => {
      // IT environments and many test harnesses do not configure
      // LD_SDK_KEY. Under the new fail-closed contract, the wrapper cannot
      // determine flag state, so it cannot make a defensible decision —
      // return 503 rather than silently downgrading enforcement.
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sinon.stub().throws(new Error('LaunchDarkly SDK key is required')),
          },
        },
      });
      const wrapped = mod.facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(503);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'facs' },
        'LaunchDarkly client unavailable — failing closed',
      )).to.be.true;
    });

    it('returns 503 (fail-closed) when createFrom returns null and the flag eval throws', async () => {
      // `createFrom` returning null without throwing is rare but possible
      // in misconfigured deployments. The next-line .isFlagEnabledForIMSOrg
      // call will then throw, which the wrapper catches as fail-closed.
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(null) },
        },
      });
      const wrapped = mod.facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(503);
      expect(handler.called).to.be.false;
    });

    it('returns 503 (fail-closed) when isFlagEnabledForIMSOrg rejects', async () => {
      ldClient.isFlagEnabledForIMSOrg.rejects(new Error('LD unavailable'));
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(503);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'facs' },
        'LD flag evaluation failed — failing closed',
      )).to.be.true;
    });

    it('denies (403) when no tenant is available for FACS evaluation', async () => {
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

    it('skips LD evaluation and proceeds to enforcement when flag entry is absent (retired)', async () => {
      // ACO is in PRODUCTS_ROUTES but absent from FT_MAC_FACS_PERMISSIONS.
      // Per the design's "Flag retirement" semantic: removing the entry
      // means "enforcement universal for the product" — bypass the
      // rollout gate but DO proceed to the permission / state-layer checks.
      context.pathInfo.headers = { 'x-product': 'aco' };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(ldClient.isFlagEnabledForIMSOrg.called).to.be.false;
      // makeAuthInfo's hasFacsPermission returns true for any permission,
      // so enforcement admits the request and the handler runs.
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs' },
        'FACS: no LD flag entry for product — flag retired, enforcement universal',
      )).to.be.true;
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

    it('bypasses an unmapped route that no product claims (not FACS-governed)', async () => {
      // Under the new fail-closed bypass ladder, a route that is not in any
      // product map AND not in INTERNAL_ROUTES bypasses the wrapper (it is
      // not FACS-governed). The coverage invariant in api-service ensures
      // every real route is consciously classified into one bucket, so
      // "stray" routes only happen during route-author work-in-progress.
      context.pathInfo = {
        method: 'DELETE',
        suffix: '/unknown',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('returns 403 when the user lacks the required FACS permission', async () => {
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(logStub.warn.calledWithMatch({ tag: 'facs' }, 'FACS permission denied')).to.be.true;
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

    it('uses profile.sub (auth-service canonicalizes sub === email === userId)', async () => {
      // After login.js canonicalization, all three fields are byte-equal.
      // The wrapper picks sub. Test asserts the picked value, not a
      // preference logic, because there's no longer a fallback to `email`.
      await runDenied({ sub: 'ABC123@AdobeID', email: 'ABC123@AdobeID' });
      expect(captured.warn.user).to.equal('ABC123@AdobeID');
    });

    it('returns undefined when profile.sub is missing (login canonicalization not applied)', async () => {
      // Defensive: a JWT issued before the canonicalization rolled out, or
      // by a different auth path, won't have sub set. The wrapper reports
      // undefined rather than reaching for email — auth-service is now the
      // single canonicalizer.
      await runDenied({ email: 'ABC123@AdobeID' });
      expect(captured.warn.user).to.equal(undefined);
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
    let findFacsResourceBindingStub;
    let mockedWrapper;
    const phase2Config = {
      ...routeFacsCapabilities,
      PRODUCTS_ROUTES: {
        ...routeFacsCapabilities.PRODUCTS_ROUTES,
        LLMO: {
          ...routeFacsCapabilities.PRODUCTS_ROUTES.LLMO,
          'GET /brands/:brandId': ['llmo/can_read'],
          'POST /brands': ['llmo/can_manage'],
          'GET /insights': ['llmo/can_read'],
        },
      },
      PRODUCTS_FACS_RESOURCE_PARAM_ALIASES: {
        LLMO: { brand: ['brandId'] },
      },
    };
    const dummyPostgrest = { from: () => {} }; // not called, just present.

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      findFacsResourceBindingStub = sinon.stub();
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
        '../../src/auth/facs-state-layer.js': {
          findFacsResourceBinding: findFacsResourceBindingStub,
        },
      });
      mockedWrapper = mod.facsWrapper;
      context.dataAccess = { services: { postgrestClient: dummyPostgrest } };
    });

    it('does not call the state-layer reader when route has no resolvable resource', async () => {
      findFacsResourceBindingStub.resolves({ id: 'm1' });
      context.pathInfo = {
        method: 'GET',
        suffix: '/insights',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(findFacsResourceBindingStub.called).to.be.false;
    });

    it('allows when a user-scoped mapping is found', async () => {
      findFacsResourceBindingStub.resolves({ id: 'm1' });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(findFacsResourceBindingStub.calledOnce).to.be.true;
      const [pg, keys] = findFacsResourceBindingStub.firstCall.args;
      expect(pg).to.equal(dummyPostgrest);
      expect(keys.subjectType).to.equal('user');
      expect(keys.resourceType).to.equal('brand');
      expect(keys.resourceId).to.equal('abc-123');
      // The binding lookup carries NO capability — capability is established
      // by the Phase 1 JWT check. The lookup key is (subject, resource, org).
      expect(keys).to.not.have.property('facsPermission');
    });

    it('falls back to org-scoped mapping when user-scoped is missing', async () => {
      findFacsResourceBindingStub.onCall(0).resolves(null);
      findFacsResourceBindingStub.onCall(1).resolves({ id: 'm2' });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(findFacsResourceBindingStub.calledTwice).to.be.true;
      expect(findFacsResourceBindingStub.secondCall.args[1].subjectType).to.equal('org');
    });

    it('denies with 403 when neither user-scoped nor org-scoped mapping exists', async () => {
      findFacsResourceBindingStub.resolves(null);
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
      findFacsResourceBindingStub.rejects(new Error('postgrest down'));
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
      findFacsResourceBindingStub.resolves({ id: 'm3' });
      context.pathInfo = {
        method: 'POST',
        suffix: '/brands',
        headers: { 'x-product': 'llmo' },
        params: {},
      };
      context.data = { brandId: 'b-from-body' };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: phase2Config });
      await wrapped({}, context);
      const keys = findFacsResourceBindingStub.firstCall.args[1];
      expect(keys.resourceType).to.equal('brand');
      expect(keys.resourceId).to.equal('b-from-body');
    });

    it('skips user-scoped lookup when no user identifier is resolvable; checks only org-scoped', async () => {
      findFacsResourceBindingStub.resolves({ id: 'm4' });
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
      expect(findFacsResourceBindingStub.calledOnce).to.be.true;
      expect(findFacsResourceBindingStub.firstCall.args[1].subjectType).to.equal('org');
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
      expect(findFacsResourceBindingStub.called).to.be.false;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs' },
        'FACS grant: postgrestClient absent — skipping state-layer check',
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

  describe('construction-time validation of PRODUCTS_ROUTES values', () => {
    it('throws when a route value is a plain string (not an array)', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: { 'GET /x': 'llmo/can_read' } },
        },
      })).to.throw(/must be a non-empty array of permission strings/);
    });

    it('throws when a route value is an empty array', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: { 'GET /x': [] } },
        },
      })).to.throw(/must be a non-empty array of permission strings/);
    });

    it('throws when an array entry is missing the product prefix', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: { 'GET /x': ['can_read'] } },
        },
      })).to.throw(/invalid permission/);
    });

    it('throws when an array entry is not a string', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: { 'GET /x': [42] } },
        },
      })).to.throw(/invalid permission/);
    });

    it('tolerates undefined / null product sub-maps and exempt entries', () => {
      // Defensive guards: undefined product routes + undefined exempt
      // permissions for a product shouldn't crash construction.
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: undefined, ASO: { 'GET /x': ['aso/view'] } },
          PRODUCTS_FACS_STATE_LAYER_EXEMPT_PERMISSIONS: { ASO: undefined },
        },
      })).to.not.throw();
    });
  });

  describe('any-of permissions (held-permission resolution)', () => {
    let ldClient;
    let mockedWrapper;
    const anyOfConfig = {
      ...routeFacsCapabilities,
      PRODUCTS_ROUTES: {
        LLMO: {
          // Two-permission route. Order matters: brand-scoped first,
          // global second.
          'GET /brands/:brandId': ['llmo/can_view', 'llmo/can_view_all'],
        },
      },
    };

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mod.facsWrapper;
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
    });

    it('picks the first listed permission the JWT satisfies', async () => {
      let captured;
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_view',
        getProfile: () => ({ sub: 'u1' }),
      });
      const wrapped = mockedWrapper((req, ctx) => {
        captured = ctx;
        return { status: 200 };
      }, { routeFacsCapabilities: anyOfConfig });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(captured).to.equal(context);
    });

    it('falls through to the second permission when the first is not held', async () => {
      // User holds can_view_all only; route lists [can_view, can_view_all].
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_view_all',
      });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: anyOfConfig });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
    });

    it('denies when the JWT satisfies none of the required permissions', async () => {
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: anyOfConfig });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
    });
  });

  describe('state-layer exempt permissions', () => {
    let ldClient;
    let findFacsResourceBindingStub;
    let mockedWrapper;
    const exemptConfig = {
      ...routeFacsCapabilities,
      PRODUCTS_ROUTES: {
        LLMO: {
          'GET /brands/:brandId': ['llmo/can_view', 'llmo/can_view_all'],
          'POST /facs/access-mappings': ['llmo/can_manage_user'],
        },
      },
      PRODUCTS_FACS_RESOURCE_PARAM_ALIASES: {
        LLMO: { brand: ['brandId'] },
      },
      PRODUCTS_FACS_STATE_LAYER_EXEMPT_PERMISSIONS: {
        LLMO: ['llmo/can_view_all', 'llmo/can_manage_user'],
      },
    };
    const dummyPostgrest = { from: () => {} };

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      findFacsResourceBindingStub = sinon.stub();
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
        '../../src/auth/facs-state-layer.js': {
          findFacsResourceBinding: findFacsResourceBindingStub,
        },
      });
      mockedWrapper = mod.facsWrapper;
      context.dataAccess = { services: { postgrestClient: dummyPostgrest } };
    });

    it('skips the state-layer check when the held permission is exempt (can_view_all)', async () => {
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_view_all',
      });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: exemptConfig });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(findFacsResourceBindingStub.called).to.be.false;
    });

    it('still performs the state-layer check when the held permission is NOT exempt', async () => {
      findFacsResourceBindingStub.resolves({ id: 'm1' });
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_view', // not exempt
      });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: exemptConfig });
      await wrapped({}, context);
      expect(findFacsResourceBindingStub.calledOnce).to.be.true;
      expect(findFacsResourceBindingStub.firstCall.args[1]).to.not.have.property('facsPermission');
    });

    it('skips the state-layer check on can_manage_user (management endpoint)', async () => {
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_manage_user',
      });
      context.pathInfo = {
        method: 'POST',
        suffix: '/facs/access-mappings',
        headers: { 'x-product': 'llmo' },
      };
      context.data = { brandId: 'b-from-body' }; // would otherwise hit body fallback
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: exemptConfig });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(findFacsResourceBindingStub.called).to.be.false;
    });

    it('prefers an exempt held permission even when a brand-scoped permission is listed first', async () => {
      // Critical regression guard: route lists [can_view, can_view_all]
      // (brand-scoped first), but the user is llmo_manager and holds BOTH.
      // Plain first-match-wins would resolve to can_view → state-layer →
      // 403 (no row for the manager). Exempt-preference resolution must
      // pick can_view_all → bypass.
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => (
          p === 'llmo/can_view' || p === 'llmo/can_view_all'
        ),
      });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: exemptConfig });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(findFacsResourceBindingStub.called).to.be.false;
    });

    it('still resolves to the brand-scoped permission when the user holds only it', async () => {
      // Same route ([can_view, can_view_all]) but user holds only the
      // non-exempt one — should land on state-layer enforcement.
      findFacsResourceBindingStub.resolves({ id: 'm1' });
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_view',
      });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
        params: { brandId: 'abc-123' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: exemptConfig });
      await wrapped({}, context);
      expect(findFacsResourceBindingStub.calledOnce).to.be.true;
      expect(findFacsResourceBindingStub.firstCall.args[1]).to.not.have.property('facsPermission');
    });
  });
});
