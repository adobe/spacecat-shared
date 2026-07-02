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

// Hybrid permission model: each route value is a single fully-qualified
// `<product>/<capability>` string. No arrays, no admin / exempt config keys.
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
      'GET /brands/:brandId': 'llmo/can_read',
      'POST /brands': 'llmo/can_manage',
      'GET /state/access-mappings': 'llmo/can_read',
    },
    // ACO is populated but absent from FT_MAC_FACS_PERMISSIONS — used to
    // exercise the "no flag configured for product / flag retired" branch.
    ACO: {
      'GET /insights': 'aco/view',
    },
  },
  PRODUCTS_FACS_RESOURCE_PARAM_ALIASES: {
    LLMO: { brand: ['brandId'] },
  },
};

function makeAuthInfo(overrides = {}) {
  return {
    isAuthenticated: () => true,
    isAdmin: () => false,
    isS2SAdmin: () => false,
    isS2SConsumer: () => false,
    isReadOnlyAdmin: () => false,
    getType: () => 'jwt',
    getTenantIds: () => ['CUST-ORG-123'],
    getProfile: () => ({ sub: 'user@example.com' }),
    hasFacsPermission: () => true,
    ...overrides,
  };
}

describe('facsWrapper', () => {
  let sandbox;
  let logStub;
  let handler;
  let context;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    logStub = {
      debug: sandbox.stub(),
      info: sandbox.stub(),
      warn: sandbox.stub(),
      error: sandbox.stub(),
    };
    handler = sandbox.stub().resolves({ status: 200 });
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

  afterEach(() => sandbox.restore());

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

    it('throws when a route value is not a string', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: { 'GET /x': ['llmo/can_read'] } },
        },
      })).to.throw(/must be a fully-qualified/);
    });

    it('throws when a route value is a string without a slash', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: { 'GET /x': 'can_read' } },
        },
      })).to.throw(/must be a fully-qualified/);
    });

    it('throws when a route value is a number', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: { 'GET /x': 42 } },
        },
      })).to.throw(/must be a fully-qualified/);
    });

    it('tolerates undefined product sub-maps', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: undefined, ASO: { 'GET /x': 'aso/view' } },
        },
      })).to.not.throw();
    });

    it('throws at construction if an alias is declared under multiple resources for a product', () => {
      expect(() => facsWrapper(handler, {
        routeFacsCapabilities: {
          PRODUCTS_ROUTES: { LLMO: { 'GET /x': 'llmo/can_read' } },
          PRODUCTS_FACS_RESOURCE_PARAM_ALIASES: {
            LLMO: { brand: ['brandId'], site: ['brandId'] },
          },
        },
      })).to.throw(/declared under multiple resources for product 'LLMO'/);
    });
  });

  describe('CORS preflight bypass', () => {
    it('bypasses OPTIONS even when x-product is present', async () => {
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

  describe('missing authInfo on non-OPTIONS', () => {
    it('returns 403 when no auth and route is FACS-governed but x-product is absent', async () => {
      delete context.attributes;
      context.pathInfo = { method: 'GET', suffix: '/insights', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('bypasses when no auth and route is not FACS-governed', async () => {
      delete context.attributes;
      context.pathInfo = { method: 'GET', suffix: '/non-facs/path', headers: {} };
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

    it('bypasses for legacyApiKey auth type', async () => {
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

    it('bypasses when context.s2sConsumer is set by s2sAuthWrapper (no user authInfo)', async () => {
      // s2sAuthWrapper authorizes the consumer against its capability map and
      // sets context.s2sConsumer; the request carries no user authInfo.
      context.attributes.authInfo = {};
      context.s2sConsumer = { getId: () => 'consumer-1' };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs', bypass: 'internal-identity', s2sConsumer: true },
      )).to.be.true;
    });
  });

  describe('IMS auth channel bypass', () => {
    it('bypasses for ims auth type before the tenant gate', async () => {
      // No tenant on the IMS session — without the bypass this would 403 at the
      // tenant gate for every org request.
      context.attributes.authInfo = makeAuthInfo({
        getType: () => 'ims',
        getTenantIds: () => [],
        getFacsPermissions: () => [],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs', bypass: 'ims-auth-channel' },
      )).to.be.true;
    });

    it('bypasses for ims auth type even when a tenant is present (unconditional on tenant)', async () => {
      context.attributes.authInfo = makeAuthInfo({
        getType: () => 'ims',
        getTenantIds: () => ['SOME-ORG@AdobeOrg'],
        getFacsPermissions: () => [],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs', bypass: 'ims-auth-channel' },
      )).to.be.true;
    });

    it('does NOT take the ims bypass when the session carries FACS claims', async () => {
      // Guard: an IMS session that surfaces facs_permissions stays on the
      // evaluation ladder rather than skipping it.
      context.attributes.authInfo = makeAuthInfo({
        getType: () => 'ims',
        getFacsPermissions: () => ['llmo/some_capability'],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(logStub.info.calledWithMatch(
        { tag: 'facs', bypass: 'ims-auth-channel' },
      )).to.be.false;
    });
  });

  describe('tenant assertion', () => {
    it('returns 500 when getTenantIds() returns more than one tenant', async () => {
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => ['ORG-A', 'ORG-B'],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(500);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'facs', tenantCount: 2 },
      )).to.be.true;
    });

    it('proceeds when getTenantIds() returns exactly one tenant', async () => {
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.not.equal(500);
    });
  });

  describe('Adobe internal IMS org bypass', () => {
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
      expect(logStub.info.calledWithMatch(
        { tag: 'facs' },
        'FACS bypass: Adobe internal IMS org',
      )).to.be.true;
    });

    it('bypasses for Adobe internal prod org ID', async () => {
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => ['908936ED5D35CC220A495CD4'],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('bypasses when the env lists the canonical @AdobeOrg form but the caller org is bare', async () => {
      // Operators may paste the DB canonical form into FACS_EXCEPTION_INTERNAL_ORGS;
      // both sides are normalized so the bare caller org still matches.
      context.env = {
        FACS_EXCEPTION_INTERNAL_ORGS: '8C6043F15F43B6390A49401A@AdobeOrg',
      };
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => ['8C6043F15F43B6390A49401A'],
      });
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs' },
        'FACS bypass: Adobe internal IMS org',
      )).to.be.true;
    });

    it('does not bypass when env var is unset', async () => {
      // Tests the empty-set return of parseFacsExceptionInternalOrgs.
      context.env = {};
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      // Falls through to LD gate; since this test's makeAuthInfo grants the
      // capability and there's no LD mock here, expect a 503 or similar non-200.
      // Just assert we did NOT hit the internal-org bypass path.
      expect(logStub.info.calledWithMatch(
        { tag: 'facs' },
        'FACS bypass: Adobe internal IMS org',
      )).to.be.false;
      expect(result).to.exist;
    });
  });

  describe('route-not-in-any-product-map → bypass', () => {
    it('bypasses when route is not in any product map (INTERNAL_ROUTES route hit by external user)', async () => {
      context.pathInfo = {
        method: 'POST',
        suffix: '/configurations/audits', // in INTERNAL_ROUTES, not in any product map
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs', bypass: 'route-not-facs-governed' },
      )).to.be.true;
    });

    it('bypasses for an unmapped suffix with no x-product header', async () => {
      context.pathInfo = { method: 'GET', suffix: '/non-facs/path', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('missing / mismatched x-product on FACS-governed route', () => {
    it('returns 403 when route IS in some product map but x-product is absent', async () => {
      context.pathInfo = { method: 'GET', suffix: '/insights', headers: {} };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.warn.calledWithMatch(
        { tag: 'facs' },
      )).to.be.true;
    });

    it('returns 403 when x-product names an unknown product but route IS in some other product map', async () => {
      context.pathInfo.headers = { 'x-product': 'unknown-product' };
      const wrapped = facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('bypasses when route map for named product is empty AND no other product claims the route', async () => {
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
      ldClient = { isFlagEnabledForIMSOrg: sandbox.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sandbox.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mod.facsWrapper;
    });

    it('bypasses when flag is disabled for the org', async () => {
      ldClient.isFlagEnabledForIMSOrg.resolves(false);
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs' },
        'FACS bypass: LaunchDarkly flag disabled for org',
      )).to.be.true;
    });

    it('returns 503 when LaunchDarklyClient.createFrom throws', async () => {
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sandbox.stub().throws(new Error('LaunchDarkly SDK key is required')),
          },
        },
      });
      const wrapped = mod.facsWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(503);
      expect(handler.called).to.be.false;
    });

    it('returns 503 when isFlagEnabledForIMSOrg rejects', async () => {
      ldClient.isFlagEnabledForIMSOrg.rejects(new Error('LD unavailable'));
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(503);
      expect(handler.called).to.be.false;
    });

    it('returns 403 when no tenant is available for FACS evaluation', async () => {
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

    it('does not double-suffix a pre-canonicalized org id for the LD flag key', async () => {
      // getTenantIds() may already return the `<ident>@AdobeOrg` form; the key
      // must stay single-suffixed (regression: `${orgId}@AdobeOrg` produced
      // `ORG@AdobeOrg@AdobeOrg`, silently bypassing FACS).
      context.attributes.authInfo = makeAuthInfo({ getTenantIds: () => ['ORG-ABC@AdobeOrg'] });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      const [, imsOrgId] = ldClient.isFlagEnabledForIMSOrg.firstCall.args;
      expect(imsOrgId).to.equal('ORG-ABC@AdobeOrg');
    });

    it('skips LD when product has no flag entry (flag retired, enforcement universal)', async () => {
      // ACO is in PRODUCTS_ROUTES but absent from FT_MAC_FACS_PERMISSIONS.
      context.pathInfo.headers = { 'x-product': 'aco' };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(ldClient.isFlagEnabledForIMSOrg.called).to.be.false;
      // ACO has no alias lookup → resource is null → defer to controller.
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs' },
        'FACS: no LD flag entry for product — flag retired, enforcement universal',
      )).to.be.true;
    });
  });

  describe('defer-to-controller (resolver returns null)', () => {
    let ldClient;
    let mockedWrapper;

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sandbox.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sandbox.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mod.facsWrapper;
    });

    it('defers when route has no ReBAC URL param and no body match', async () => {
      // GET /insights — LLMO has alias lookup for brand, but /insights has no
      // brandId param and no body. Resolver returns null → defer to controller.
      context.pathInfo = {
        method: 'GET',
        suffix: '/insights',
        headers: { 'x-product': 'llmo' },
      };
      // JWT must not grant the capability, otherwise the wrapper short-circuits
      // at step 5 (grant: 'jwt') before the resolver runs. The defer-to-
      // controller path is only reachable when the JWT is insufficient.
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      context.dataAccess = { services: { postgrestClient: { from: () => {} } } };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(logStub.info.calledWithMatch(
        { tag: 'facs', defer: 'no-resolvable-resource' },
      )).to.be.true;
      // The enrolled, resource-scoped defer surfaces a ReBAC session flag so
      // collection endpoints can filter their results.
      expect(context.attributes.facs).to.deep.equal({
        enabled: true,
        product: 'LLMO',
        subjectId: 'user@example.com',
      });
    });

    it('defers when product has no alias lookup at all', async () => {
      // ACO has no PRODUCTS_FACS_RESOURCE_PARAM_ALIASES entry → resolver
      // returns null → defer (and ACO has no LD flag, so it sails through).
      context.pathInfo = {
        method: 'GET',
        suffix: '/insights',
        headers: { 'x-product': 'aco' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('state-layer evaluation (hybrid additive model)', () => {
    let ldClient;
    let findFacsResourceBindingStub;
    let mockedWrapper;
    const dummyPostgrest = { from: () => {} };

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sandbox.stub().resolves(true) };
      findFacsResourceBindingStub = sandbox.stub();
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sandbox.stub().returns(ldClient) },
        },
        '../../src/auth/facs-state-layer.js': {
          findFacsResourceBinding: findFacsResourceBindingStub,
          normalizeImsOrgId: (s) => (s && typeof s === 'string' && !s.includes('@') ? `${s}@AdobeOrg` : s),
        },
      });
      mockedWrapper = mod.facsWrapper;
      context.dataAccess = { services: { postgrestClient: dummyPostgrest } };
    });

    function brandReq() {
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
      };
    }

    it('admits when only user-scoped mapping carries the capability', async () => {
      findFacsResourceBindingStub
        .onCall(0).resolves({ id: 'm1', granted_capabilities: ['llmo/can_read'] })
        .onCall(1).resolves(null);
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(findFacsResourceBindingStub.calledTwice).to.be.true;
      const [pg, keys] = findFacsResourceBindingStub.firstCall.args;
      expect(pg).to.equal(dummyPostgrest);
      expect(keys).to.include({
        product: 'LLMO',
        resourceType: 'brand',
        resourceId: 'abc-123',
        subjectType: 'user',
        subjectId: 'user@example.com',
        imsOrgId: 'CUST-ORG-123@AdobeOrg',
      });
      expect(findFacsResourceBindingStub.secondCall.args[1].subjectType).to.equal('org');
    });

    it('admits when only org-scoped mapping carries the capability', async () => {
      findFacsResourceBindingStub
        .onCall(0).resolves(null)
        .onCall(1).resolves({ id: 'm2', granted_capabilities: ['llmo/can_read'] });
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('admits when both user and org mappings carry the capability (union)', async () => {
      findFacsResourceBindingStub
        .onCall(0).resolves({ id: 'm1', granted_capabilities: ['llmo/can_read'] })
        .onCall(1).resolves({ id: 'm2', granted_capabilities: ['llmo/can_read', 'llmo/can_manage'] });
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(handler.calledOnce).to.be.true;
    });

    it('denies when neither mapping carries the capability and JWT lacks it', async () => {
      findFacsResourceBindingStub.resolves(null);
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.warn.calledWithMatch({ tag: 'facs' })).to.be.true;
    });

    it('admits when JWT carries capability and state layer has empty granted_capabilities', async () => {
      findFacsResourceBindingStub.resolves({ id: 'm', granted_capabilities: [] });
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_read',
      });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('admits when JWT carries capability and state layer returns null rows', async () => {
      findFacsResourceBindingStub.resolves(null);
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_read',
      });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
    });

    it('admits when state-layer row lacks granted_capabilities field but JWT carries it', async () => {
      // Defensive: ensures the `(userMapping?.granted_capabilities || [])` branch is hit.
      findFacsResourceBindingStub.resolves({ id: 'm' });
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_read',
      });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
    });

    it('returns 403 when state-layer read throws', async () => {
      findFacsResourceBindingStub.rejects(new Error('postgrest down'));
      // JWT must not grant, otherwise step 5 short-circuits before the
      // state-layer read that we want to observe throwing.
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'facs' },
        'FACS state-layer read failed — denying',
      )).to.be.true;
    });

    it('skips the user lookup when there is no resolvable subject ident', async () => {
      findFacsResourceBindingStub.resolves({ id: 'm', granted_capabilities: ['llmo/can_read'] });
      context.attributes.authInfo = makeAuthInfo({
        getProfile: () => ({}),
        hasFacsPermission: () => false,
      });
      brandReq();
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(findFacsResourceBindingStub.calledOnce).to.be.true;
      expect(findFacsResourceBindingStub.firstCall.args[1].subjectType).to.equal('org');
    });

    it('skips the org lookup when there is no orgId', async () => {
      // No tenant → no LD gate either (would deny earlier). Configure a product
      // without an LD flag entry (ACO) and a route that yields a resource.
      const cfg = {
        PRODUCTS_ROUTES: { ACO: { 'GET /brands/:brandId': 'aco/can_read' } },
        PRODUCTS_FACS_RESOURCE_PARAM_ALIASES: { ACO: { brand: ['brandId'] } },
      };
      findFacsResourceBindingStub.resolves({ id: 'm', granted_capabilities: ['aco/can_read'] });
      context.attributes.authInfo = makeAuthInfo({
        getTenantIds: () => [],
        hasFacsPermission: () => false,
      });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'aco' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities: cfg });
      await wrapped({}, context);
      // Only user lookup happened (no orgId).
      expect(findFacsResourceBindingStub.calledOnce).to.be.true;
      expect(findFacsResourceBindingStub.firstCall.args[1].subjectType).to.equal('user');
    });

    it('resolves resource from body when route has no URL params', async () => {
      findFacsResourceBindingStub.resolves({ id: 'm', granted_capabilities: ['llmo/can_manage'] });
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      context.pathInfo = {
        method: 'POST',
        suffix: '/brands',
        headers: { 'x-product': 'llmo' },
      };
      context.data = { brandId: 'b-from-body' };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      const keys = findFacsResourceBindingStub.firstCall.args[1];
      expect(keys.resourceType).to.equal('brand');
      expect(keys.resourceId).to.equal('b-from-body');
    });

    it('resolves resource from query when route has no URL params and body has no alias', async () => {
      findFacsResourceBindingStub.resolves({ id: 'm', granted_capabilities: ['llmo/can_read'] });
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      context.pathInfo = {
        method: 'GET',
        suffix: '/state/access-mappings',
        headers: { 'x-product': 'llmo' },
        searchParams: { brandId: 'b-from-query' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      const keys = findFacsResourceBindingStub.firstCall.args[1];
      expect(keys.resourceType).to.equal('brand');
      expect(keys.resourceId).to.equal('b-from-query');
    });
  });

  describe('no-postgrest fallback', () => {
    let ldClient;
    let mockedWrapper;

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sandbox.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sandbox.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mod.facsWrapper;
    });

    it('admits when postgrestClient is absent and JWT carries the capability', async () => {
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
      };
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: (p) => p === 'llmo/can_read',
      });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      // The JWT short-circuit (step 5) admits before the postgrest check is
      // even reached — the grant is logged as 'jwt', not a no-postgrest
      // fallback. The state layer is never consulted when the JWT suffices.
      expect(logStub.info.calledWithMatch(
        { tag: 'facs', grant: 'jwt' },
      )).to.be.true;
    });

    it('denies (403) when postgrestClient is absent and JWT lacks the capability', async () => {
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
      };
      context.attributes.authInfo = makeAuthInfo({ hasFacsPermission: () => false });
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.warn.calledWithMatch(
        { tag: 'facs' },
        'FACS denied: postgrestClient absent and JWT does not carry the route capability',
      )).to.be.true;
    });

    it('denies when authInfo lacks hasFacsPermission and postgrestClient is absent', async () => {
      // Defensive optional-chain branch on hasFacsPermission.
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
      };
      context.attributes.authInfo = {
        isAuthenticated: () => true,
        isAdmin: () => false,
        isS2SAdmin: () => false,
        isS2SConsumer: () => false,
        isReadOnlyAdmin: () => false,
        getType: () => 'jwt',
        getTenantIds: () => ['CUST-ORG-123'],
        getProfile: () => ({ sub: 'user@example.com' }),
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      const result = await wrapped({}, context);
      expect(result.status).to.equal(403);
    });
  });

  describe('user identifier logging', () => {
    let ldClient;
    let mockedWrapper;
    let captured;

    beforeEach(async () => {
      ldClient = { isFlagEnabledForIMSOrg: sandbox.stub().resolves(true) };
      const mod = await esmock('../../src/auth/facs-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sandbox.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mod.facsWrapper;
      captured = {};
      logStub.warn = (obj) => {
        captured.warn = obj;
      };
    });

    async function runDenied(authInfoOverrides) {
      context.attributes.authInfo = makeAuthInfo({
        hasFacsPermission: () => false,
        ...authInfoOverrides,
      });
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
    }

    it('uses profile.sub for the user field', async () => {
      await runDenied({ getProfile: () => ({ sub: 'ABC123@AdobeID' }) });
      expect(captured.warn.user).to.equal('ABC123@AdobeID');
    });

    it('returns undefined when profile.sub is missing', async () => {
      await runDenied({ getProfile: () => ({ email: 'ABC123@AdobeID' }) });
      expect(captured.warn.user).to.equal(undefined);
    });

    it('returns undefined when profile is empty', async () => {
      await runDenied({ getProfile: () => ({}) });
      expect(captured.warn.user).to.equal(undefined);
    });

    it('returns undefined when authInfo has no getProfile', async () => {
      context.attributes.authInfo = {
        isAuthenticated: () => true,
        isAdmin: () => false,
        isS2SAdmin: () => false,
        isS2SConsumer: () => false,
        isReadOnlyAdmin: () => false,
        getType: () => 'jwt',
        getTenantIds: () => ['CUST-ORG-123'],
        hasFacsPermission: () => false,
      };
      context.pathInfo = {
        method: 'GET',
        suffix: '/brands/abc-123',
        headers: { 'x-product': 'llmo' },
      };
      const wrapped = mockedWrapper(handler, { routeFacsCapabilities });
      await wrapped({}, context);
      expect(captured.warn.user).to.equal(undefined);
    });
  });
});
