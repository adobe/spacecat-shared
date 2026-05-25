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

import { expect } from 'chai';
import sinon from 'sinon';
import esmock from 'esmock';

import { readOnlyAdminWrapper } from '../../src/auth/read-only-admin-wrapper.js';

const routeCapabilities = {
  'GET /sites': 'site:read',
  'POST /sites': 'site:write',
  'GET /sites/:siteId': 'site:read',
  'PATCH /sites/:siteId': 'site:write',
  'DELETE /sites/:siteId': 'site:write',
  'GET /sites/:siteId/opportunities': 'opportunity:read',
  'POST /sites/:siteId/opportunities': 'opportunity:write',
  'GET /organizations': 'organization:readAll',
};

describe('readOnlyAdminWrapper', () => {
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
      pathInfo: { method: 'GET', suffix: '/sites' },
      attributes: {
        authInfo: {
          isReadOnlyAdmin: () => true,
          getTenantIds: () => ['org-123'],
        },
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('throws at creation time when routeCapabilities is an empty object', () => {
    expect(() => readOnlyAdminWrapper(handler, { routeCapabilities: {} }))
      .to.throw('routeCapabilities must be a non-empty object');
  });

  it('throws at creation time when routeCapabilities is an array', () => {
    expect(() => readOnlyAdminWrapper(handler, { routeCapabilities: ['GET /sites'] }))
      .to.throw('routeCapabilities must be a non-empty object');
  });

  it('throws at creation time when routeCapabilities is a string', () => {
    expect(() => readOnlyAdminWrapper(handler, { routeCapabilities: 'GET /sites' }))
      .to.throw('routeCapabilities must be a non-empty object');
  });

  describe('non-RO-admin passthrough', () => {
    it('passes through when authInfo is not present', async () => {
      delete context.attributes;
      const wrapped = readOnlyAdminWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('passes through when user is not a read-only admin', async () => {
      context.attributes.authInfo.isReadOnlyAdmin = () => false;
      const wrapped = readOnlyAdminWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('passes through when isReadOnlyAdmin is not a function', async () => {
      context.attributes.authInfo = { isReadOnlyAdmin: undefined };
      const wrapped = readOnlyAdminWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });
  });

  describe('feature flag gate', () => {
    let ldClient;
    let mockedWrapper;

    beforeEach(async () => {
      ldClient = {
        isFlagEnabledForIMSOrg: sinon.stub().resolves(true),
      };
      const mockedModule = await esmock('../../src/auth/read-only-admin-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sinon.stub().returns(ldClient),
          },
        },
      });
      mockedWrapper = mockedModule.readOnlyAdminWrapper;
    });

    it('returns 403 when feature flag is disabled', async () => {
      ldClient.isFlagEnabledForIMSOrg.resolves(false);
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Forbidden');
      expect(logStub.warn.calledWithMatch({ tag: 'ro-admin' }, 'Feature flag disabled, denying RO admin access')).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('returns 403 when createFrom returns null (fail-closed)', async () => {
      const nullModule = await esmock('../../src/auth/read-only-admin-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sinon.stub().returns(null),
          },
        },
      });
      const wrapped = nullModule.readOnlyAdminWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Forbidden');
      expect(handler.called).to.be.false;
    });

    it('returns 403 and logs error when createFrom throws (fail-closed)', async () => {
      const sdkError = new Error('SDK key missing');
      const throwModule = await esmock('../../src/auth/read-only-admin-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sinon.stub().throws(sdkError),
          },
        },
      });
      const wrapped = throwModule.readOnlyAdminWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Forbidden');
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin', errMessage: 'SDK key missing', errName: 'Error' },
        'Feature flag evaluation failed for RO admin; defaulting to deny',
      )).to.be.true;
    });

    it('returns 403 and logs error when isFlagEnabledForIMSOrg throws (fail-closed)', async () => {
      const ldError = new Error('LD unavailable');
      ldClient.isFlagEnabledForIMSOrg.rejects(ldError);
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Forbidden');
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin', errMessage: 'LD unavailable', errName: 'Error' },
        'Feature flag evaluation failed for RO admin; defaulting to deny',
      )).to.be.true;
    });

    it('returns 403 when authInfo has no tenant IDs (fail-closed)', async () => {
      context.attributes.authInfo.getTenantIds = () => [];
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('returns 403 when getTenantIds is not a function (fail-closed)', async () => {
      context.attributes.authInfo.getTenantIds = undefined;
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('calls isFlagEnabledForIMSOrg with flag key and first tenant ID suffixed with @AdobeOrg', async () => {
      context.attributes.authInfo.getTenantIds = () => ['org-abc', 'org-def'];
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      expect(ldClient.isFlagEnabledForIMSOrg.calledOnce).to.be.true;
      const [flagKey, imsOrgId] = ldClient.isFlagEnabledForIMSOrg.firstCall.args;
      expect(flagKey).to.equal('FT_LLMO-3008');
      expect(imsOrgId).to.equal('org-abc@AdobeOrg');
    });

    it('pins multi-tenant ordering: only the first tenant is checked (user-org gate semantics)', async () => {
      // Order-dependent by design: this is a user-org gate, not a resource-org gate.
      // Same user with reversed tenant list ['org-def', 'org-abc'] would be gated on org-def.
      // This test exists to prevent a silent semantic flip in future changes.
      context.attributes.authInfo.getTenantIds = () => ['org-def', 'org-abc'];
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      const [, imsOrgId] = ldClient.isFlagEnabledForIMSOrg.firstCall.args;
      expect(imsOrgId).to.equal('org-def@AdobeOrg');
      // tenantIds[1] must NOT be consulted
      expect(ldClient.isFlagEnabledForIMSOrg.calledOnce).to.be.true;
    });
  });

  describe('route action resolution', () => {
    let ldClient;
    let mockedWrapper;

    beforeEach(async () => {
      ldClient = {
        isFlagEnabledForIMSOrg: sinon.stub().resolves(true),
      };
      const mockedModule = await esmock('../../src/auth/read-only-admin-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sinon.stub().returns(ldClient),
          },
        },
      });
      mockedWrapper = mockedModule.readOnlyAdminWrapper;
      // Provide a minimal dataAccess so write-route tests that now call isOwnerOfResource
      // get a clean fail-closed result instead of a spurious dataAccess-missing error log.
      context.dataAccess = { Site: { findById: sinon.stub().resolves(null) } };
    });

    it('allows read-only admin on a read route (exact match)', async () => {
      context.pathInfo = { method: 'GET', suffix: '/sites' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('allows read-only admin on a read route (dynamic params)', async () => {
      context.pathInfo = { method: 'GET', suffix: '/sites/abc-123/opportunities' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('allows read-only admin on a readAll route', async () => {
      context.pathInfo = { method: 'GET', suffix: '/organizations' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('blocks read-only admin on a write route (POST)', async () => {
      context.pathInfo = { method: 'POST', suffix: '/sites' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Forbidden');
      expect(logStub.warn.calledWithMatch({ tag: 'ro-admin' }, 'Read-only admin blocked from route')).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('blocks read-only admin on a write route (PATCH)', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      // dataAccess.Site.findById returns null (from beforeEach) → isOwnerOfResource=false
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Forbidden');
      expect(logStub.warn.calledWithMatch(
        { tag: 'ro-admin', reason: 'not-owner' },
        'Read-only admin blocked from route',
      )).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('blocks read-only admin on a write route (DELETE)', async () => {
      context.pathInfo = { method: 'DELETE', suffix: '/sites/abc-123' };
      // dataAccess.Site.findById returns null (from beforeEach) → isOwnerOfResource=false
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('blocks read-only admin on an unmapped route (deny-by-default)', async () => {
      context.pathInfo = { method: 'GET', suffix: '/unknown/route' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Forbidden');
      // Defense-in-depth: unmapped route + no path params → denied with explicit reason.
      expect(logStub.warn.calledWithMatch(
        { tag: 'ro-admin', reason: 'unmapped-no-path-params' },
        'RO admin denied on unmapped route with no path params; add this route to routeCapabilities or internalRoutes',
      )).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('blocks when pathInfo is missing method or suffix', async () => {
      context.pathInfo = {};
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('handles malformed route keys without a space separator', async () => {
      context.pathInfo = { method: 'GET', suffix: '/malformed' };
      const malformedMap = { BADKEY: 'read' };
      const wrapped = mockedWrapper(handler, { routeCapabilities: malformedMap });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });
  });

  describe('no routeCapabilities provided', () => {
    it('throws at creation time when routeCapabilities is not provided', () => {
      expect(() => readOnlyAdminWrapper(handler))
        .to.throw('readOnlyAdminWrapper: routeCapabilities must be a non-empty object');
    });

    it('throws at creation time when routeCapabilities is null', () => {
      expect(() => readOnlyAdminWrapper(handler, { routeCapabilities: null }))
        .to.throw('readOnlyAdminWrapper: routeCapabilities must be a non-empty object');
    });
  });

  describe('write on owned resource', () => {
    let mockedWrapper;
    let siteStub;
    let orgStub;

    beforeEach(async () => {
      const ldClient = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      const mockedModule = await esmock('../../src/auth/read-only-admin-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldClient) },
        },
      });
      mockedWrapper = mockedModule.readOnlyAdminWrapper;

      orgStub = { getImsOrgId: sinon.stub().returns('org-123@AdobeOrg') };
      siteStub = { getOrganization: sinon.stub().resolves(orgStub) };

      context.attributes.authInfo.hasOrganization = sinon.stub().returns(true);
      context.attributes.authInfo.getProfile = sinon.stub().returns({ email: 'roa@example.com' });
    });

    it('allows write on a site the RO admin owns', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(context.dataAccess.Site.findById.calledWith('abc-123')).to.be.true;
      expect(context.attributes.authInfo.hasOrganization.calledWith('org-123@AdobeOrg')).to.be.true;
    });

    it('blocks write on a site the RO admin does not own', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      context.attributes.authInfo.hasOrganization = sinon.stub().returns(false);
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('blocks write when the site is not found', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/not-exist' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(null) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('blocks write when the site has no organization', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      siteStub.getOrganization.resolves(null);
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('blocks write and logs warn when the owning org has no imsOrgId (data-integrity guard)', async () => {
      // Guards against hasOrganization(undefined) which throws TypeError in auth-info.js.
      orgStub.getImsOrgId.returns(null);
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.warn.calledWithMatch(
        { tag: 'ro-admin', siteId: 'abc-123' },
        'Owning organization has no imsOrgId; denying RO admin access',
      )).to.be.true;
    });

    it('blocks write and logs warn when the organization has no imsOrgId (org path)', async () => {
      const orgRoutes = {
        ...routeCapabilities,
        'PATCH /organizations/:organizationId': 'organization:write',
      };
      orgStub.getImsOrgId.returns(null);
      context.pathInfo = { method: 'PATCH', suffix: '/organizations/org-456' };
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(orgStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities: orgRoutes });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.warn.calledWithMatch(
        { tag: 'ro-admin', organizationId: 'org-456' },
        'Organization has no imsOrgId; denying RO admin access',
      )).to.be.true;
    });

    it('allows write on an organization the RO admin owns', async () => {
      const orgRoutes = {
        ...routeCapabilities,
        'PATCH /organizations/:organizationId': 'organization:write',
      };
      context.pathInfo = { method: 'PATCH', suffix: '/organizations/org-456' };
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(orgStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities: orgRoutes });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(context.dataAccess.Organization.findById.calledWith('org-456')).to.be.true;
    });

    it('allows write on an organization using spaceCatId alias (path param)', async () => {
      const orgRoutes = {
        ...routeCapabilities,
        'PATCH /organizations/:spaceCatId': 'organization:write',
      };
      context.pathInfo = { method: 'PATCH', suffix: '/organizations/org-456' };
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(orgStub) },
      };
      const wrapped = mockedWrapper(handler, {
        routeCapabilities: orgRoutes,
        paramAliases: { spaceCatId: 'organizationId' },
      });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(context.dataAccess.Organization.findById.calledWith('org-456')).to.be.true;
    });

    it('allows write on an organization using spaceCatId alias (body fallback)', async () => {
      const orgRoutes = {
        ...routeCapabilities,
        'POST /some/org/action': 'organization:write',
      };
      context.pathInfo = { method: 'POST', suffix: '/some/org/action' };
      context.data = { spaceCatId: 'org-456' };
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(orgStub) },
      };
      const wrapped = mockedWrapper(handler, {
        routeCapabilities: orgRoutes,
        paramAliases: { spaceCatId: 'organizationId' },
      });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(context.dataAccess.Organization.findById.calledWith('org-456')).to.be.true;
    });

    it('prefers canonical organizationId over spaceCatId alias when both are present in body', async () => {
      // organizationId (canonical) wins over spaceCatId (alias) per resolveId precedence.
      const orgRoutes = {
        ...routeCapabilities,
        'POST /some/org/action': 'organization:write',
      };
      context.pathInfo = { method: 'POST', suffix: '/some/org/action' };
      context.data = { organizationId: 'org-canonical', spaceCatId: 'org-alias' };
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(orgStub) },
      };
      const wrapped = mockedWrapper(handler, {
        routeCapabilities: orgRoutes,
        paramAliases: { spaceCatId: 'organizationId' },
      });
      await wrapped({}, context);

      expect(context.dataAccess.Organization.findById.calledWith('org-canonical')).to.be.true;
      expect(context.dataAccess.Organization.findById.calledWith('org-alias')).to.be.false;
    });

    it('ignores spaceCatId in body when paramAliases is not configured', async () => {
      // Default paramAliases is {}: without an explicit alias declaration, spaceCatId is
      // not recognised as an organization id. Decouples the shared wrapper from
      // spacecat-api-service routing conventions.
      const orgRoutes = {
        ...routeCapabilities,
        'POST /some/org/action': 'organization:write',
      };
      context.pathInfo = { method: 'POST', suffix: '/some/org/action' };
      context.data = { spaceCatId: 'org-456' };
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(orgStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities: orgRoutes });
      const result = await wrapped({}, context);

      // No alias configured → spaceCatId is ignored → no resolvable id → denied
      expect(result.status).to.equal(403);
      expect(context.dataAccess.Organization.findById.called).to.be.false;
    });

    it('blocks write when the organization is not found', async () => {
      const orgRoutes = {
        ...routeCapabilities,
        'PATCH /organizations/:organizationId': 'organization:write',
      };
      context.pathInfo = { method: 'PATCH', suffix: '/organizations/org-456' };
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(null) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities: orgRoutes });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('blocks write on an organization the RO admin does not own', async () => {
      const orgRoutes = {
        ...routeCapabilities,
        'PATCH /organizations/:organizationId': 'organization:write',
      };
      context.pathInfo = { method: 'PATCH', suffix: '/organizations/org-456' };
      context.attributes.authInfo.hasOrganization = sinon.stub().returns(false);
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(orgStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities: orgRoutes });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('blocks write when no siteId or organizationId in path or body and logs warn', async () => {
      context.pathInfo = { method: 'POST', suffix: '/sites' };
      context.dataAccess = { Site: { findById: sinon.stub() } };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(context.dataAccess.Site.findById.called).to.be.false;
      expect(logStub.warn.calledWithMatch(
        { tag: 'ro-admin' },
        'isOwnerOfResource: no siteId or organizationId found in path params or context.data',
      )).to.be.true;
    });

    it('blocks write when dataAccess is not present on context and logs error (fail-closed)', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      delete context.dataAccess;
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin' },
        'isOwnerOfResource: dataAccess not on context — ensure dataAccessWrapper runs before readOnlyAdminWrapper',
      )).to.be.true;
    });

    it('blocks write when site lookup throws and logs the error (fail-closed)', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      const dbError = new Error('DB error');
      context.dataAccess = {
        Site: { findById: sinon.stub().rejects(dbError) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin', errMessage: 'DB error', errName: 'Error' },
        'Error checking resource ownership for RO admin',
      )).to.be.true;
    });

    it('allows write when siteId is in context.data (no path param)', async () => {
      const dataRoutes = {
        ...routeCapabilities,
        'POST /preflight/jobs': 'preflight:write',
      };
      context.pathInfo = { method: 'POST', suffix: '/preflight/jobs' };
      context.data = { siteId: 'abc-123' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities: dataRoutes });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(context.dataAccess.Site.findById.calledWith('abc-123')).to.be.true;
    });

    it('blocks write when context.data siteId is present but user does not own it', async () => {
      const dataRoutes = {
        ...routeCapabilities,
        'POST /preflight/jobs': 'preflight:write',
      };
      context.pathInfo = { method: 'POST', suffix: '/preflight/jobs' };
      context.data = { siteId: 'abc-123' };
      context.attributes.authInfo.hasOrganization = sinon.stub().returns(false);
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities: dataRoutes });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
    });

    it('allows write when organizationId is in context.data (no path param)', async () => {
      const dataRoutes = {
        ...routeCapabilities,
        'POST /some/org/action': 'organization:write',
      };
      context.pathInfo = { method: 'POST', suffix: '/some/org/action' };
      context.data = { organizationId: 'org-456' };
      context.dataAccess = {
        Organization: { findById: sinon.stub().resolves(orgStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities: dataRoutes });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(context.dataAccess.Organization.findById.calledWith('org-456')).to.be.true;
    });

    it('path param takes precedence over context.data siteId', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/path-site-id' };
      context.data = { siteId: 'data-site-id' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      expect(context.dataAccess.Site.findById.calledWith('path-site-id')).to.be.true;
      expect(context.dataAccess.Site.findById.calledWith('data-site-id')).to.be.false;
    });

    it('emits ro-admin-access log when access on owned resource is allowed (no duplicate audit log)', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      expect(logStub.info.calledWithMatch({
        tag: 'ro-admin-access',
        method: 'PATCH',
        suffix: '/sites/abc-123',
        resolvedSiteId: 'abc-123',
        idSource: 'path',
      }, 'RO admin access allowed on owned resource')).to.be.true;
      // accessLogged=true suppresses the audit log to prevent double-emit
      expect(logStub.info.calledWithMatch({
        tag: 'ro-admin-audit',
      }, 'RO admin accessed route')).to.be.false;
    });

    it('emits ro-admin-access log with idSource body when context.data fallback is used', async () => {
      const dataRoutes = { ...routeCapabilities, 'POST /preflight/jobs': 'preflight:write' };
      context.pathInfo = { method: 'POST', suffix: '/preflight/jobs' };
      context.data = { siteId: 'abc-123' };
      context.dataAccess = { Site: { findById: sinon.stub().resolves(siteStub) } };
      const wrapped = mockedWrapper(handler, { routeCapabilities: dataRoutes });
      await wrapped({}, context);

      expect(logStub.info.calledWithMatch({
        tag: 'ro-admin-access',
        resolvedSiteId: 'abc-123',
        resolvedOrgId: null,
        idSource: 'body',
      }, 'RO admin access allowed on owned resource')).to.be.true;
      // accessLogged=true suppresses the audit log on the body-fallback path too
      expect(logStub.info.calledWithMatch(
        { tag: 'ro-admin-audit' },
        'RO admin accessed route',
      )).to.be.false;
    });

    it('emits ro-admin-access log with resolvedOrgId when org route is authorized via path', async () => {
      const orgRoutes = { ...routeCapabilities, 'PATCH /organizations/:organizationId': 'organization:write' };
      context.pathInfo = { method: 'PATCH', suffix: '/organizations/org-789' };
      context.dataAccess = { Organization: { findById: sinon.stub().resolves(orgStub) } };
      const wrapped = mockedWrapper(handler, { routeCapabilities: orgRoutes });
      await wrapped({}, context);

      expect(logStub.info.calledWithMatch({
        tag: 'ro-admin-access',
        resolvedSiteId: null,
        resolvedOrgId: 'org-789',
        idSource: 'path',
      }, 'RO admin access allowed on owned resource')).to.be.true;
    });

    it('blocks write and ignores body siteId when route has path params with a different name', async () => {
      // Security: if route uses :id instead of :siteId, body siteId must NOT be used as fallback.
      // extractRouteParams returns { id: 'site-b' } (not siteId), so hasPathParams is true
      // and body is not consulted.
      const altRoutes = { 'PATCH /sites/:id': 'site:write' };
      context.pathInfo = { method: 'PATCH', suffix: '/sites/site-b' };
      context.data = { siteId: 'site-a' }; // attacker owns site-a, not site-b
      context.dataAccess = { Site: { findById: sinon.stub().resolves(siteStub) } };
      const wrapped = mockedWrapper(handler, { routeCapabilities: altRoutes });
      const result = await wrapped({}, context);

      // body siteId must be ignored; no findById call should be made with 'site-a'
      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(context.dataAccess.Site.findById.calledWith('site-a')).to.be.false;
    });

    it('blocks write when getOrganization throws and logs the error (fail-closed)', async () => {
      const orgError = new Error('getOrganization failed');
      siteStub.getOrganization.rejects(orgError);
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      context.dataAccess = { Site: { findById: sinon.stub().resolves(siteStub) } };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin', errMessage: 'getOrganization failed', errName: 'Error' },
        'Error checking resource ownership for RO admin',
      )).to.be.true;
    });

    it('blocks write when Organization.findById throws and logs the error (fail-closed)', async () => {
      const orgRoutes = { ...routeCapabilities, 'PATCH /organizations/:organizationId': 'organization:write' };
      const dbError = new Error('Org DB error');
      context.pathInfo = { method: 'PATCH', suffix: '/organizations/org-456' };
      context.dataAccess = { Organization: { findById: sinon.stub().rejects(dbError) } };
      const wrapped = mockedWrapper(handler, { routeCapabilities: orgRoutes });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin', errMessage: 'Org DB error', errName: 'Error' },
        'Error checking resource ownership for RO admin',
      )).to.be.true;
    });

    it('blocks write when dataAccess has no Site property (fail-closed)', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      context.dataAccess = {}; // Site accessor absent
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin' },
        'isOwnerOfResource: dataAccess.Site accessor is missing',
      )).to.be.true;
    });

    it('blocks write when dataAccess has no Organization property (fail-closed)', async () => {
      const orgRoutes = { ...routeCapabilities, 'PATCH /organizations/:organizationId': 'organization:write' };
      context.pathInfo = { method: 'PATCH', suffix: '/organizations/org-456' };
      context.dataAccess = {}; // Organization accessor absent
      const wrapped = mockedWrapper(handler, { routeCapabilities: orgRoutes });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin' },
        'isOwnerOfResource: dataAccess.Organization accessor is missing',
      )).to.be.true;
    });

    it('denies access on unmapped route with no path params even when body claims ownership (Critical fix)', async () => {
      // Defense-in-depth: route not in routeCapabilities or internalRoutes → no path params
      // → body fallback would have authorized against body siteId, but the wrapper has no
      // record of the route and cannot constrain what the handler does. Deny up-front.
      context.pathInfo = { method: 'POST', suffix: '/jobs/preflight' };
      context.data = { siteId: 'abc-123' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      // No DB lookup happens because the deny is up-front, before ownership check.
      expect(context.dataAccess.Site.findById.called).to.be.false;
      expect(logStub.warn.calledWithMatch(
        { tag: 'ro-admin', reason: 'unmapped-no-path-params' },
        'RO admin denied on unmapped route with no path params; add this route to routeCapabilities or internalRoutes',
      )).to.be.true;
    });

    it('allows access on unmapped route resolved via internalRoutes path params and emits drift-detection warn', async () => {
      // PUT /sites/:siteId is unmapped (not in routeCapabilities), but internalRoutes covers
      // it so extractRouteParams returns { siteId: 'abc-123' }. Ownership check runs against
      // path params (not body), capability is null, drift warn fires.
      context.pathInfo = { method: 'PUT', suffix: '/sites/abc-123' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const internalRoutes = ['PUT /sites/:siteId'];
      const wrapped = mockedWrapper(handler, { routeCapabilities, internalRoutes });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(context.dataAccess.Site.findById.calledWith('abc-123')).to.be.true;
      expect(logStub.warn.calledWithMatch(
        {
          tag: 'ro-admin',
          reason: 'unmapped-route-allowed',
          method: 'PUT',
          suffix: '/sites/abc-123',
        },
        'RO admin allowed on unmapped route via ownership — add this route to routeCapabilities',
      )).to.be.true;
    });

    it('blocks unmapped route via internalRoutes path params when RO admin does not own the resource', async () => {
      context.pathInfo = { method: 'PUT', suffix: '/sites/abc-123' };
      context.attributes.authInfo.hasOrganization = sinon.stub().returns(false);
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const internalRoutes = ['PUT /sites/:siteId'];
      const wrapped = mockedWrapper(handler, { routeCapabilities, internalRoutes });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(context.dataAccess.Site.findById.calledWith('abc-123')).to.be.true;
      expect(logStub.warn.calledWithMatch(
        { tag: 'ro-admin', reason: 'not-owner' },
        'Read-only admin blocked from route',
      )).to.be.true;
    });

    it('allows write on owned resource when siteId resolved via internalRoutes fallback', async () => {
      // PUT /sites/:siteId is NOT in routeCapabilities; internalRoutes covers it so
      // extractRouteParams can still resolve { siteId: 'abc-123' } for the ownership check.
      context.pathInfo = { method: 'PUT', suffix: '/sites/abc-123' };
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const internalRoutes = ['PUT /sites/:siteId'];
      const wrapped = mockedWrapper(handler, { routeCapabilities, internalRoutes });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
      expect(context.dataAccess.Site.findById.calledWith('abc-123')).to.be.true;
      // drift-detection warn fires since capability is null (PUT not in routeCapabilities)
      expect(logStub.warn.calledWithMatch({ tag: 'ro-admin', reason: 'unmapped-route-allowed' })).to.be.true;
    });

    it('blocks write on unowned resource even when resolved via internalRoutes fallback', async () => {
      context.pathInfo = { method: 'PUT', suffix: '/sites/abc-123' };
      context.attributes.authInfo.hasOrganization = sinon.stub().returns(false);
      context.dataAccess = {
        Site: { findById: sinon.stub().resolves(siteStub) },
      };
      const internalRoutes = ['PUT /sites/:siteId'];
      const wrapped = mockedWrapper(handler, { routeCapabilities, internalRoutes });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(context.dataAccess.Site.findById.calledWith('abc-123')).to.be.true;
    });

    it('denies and logs error when an unexpected error occurs in the authorization block', async () => {
      const routeError = new Error('unexpected route error');
      const ldStub = { isFlagEnabledForIMSOrg: sinon.stub().resolves(true) };
      const errorModule = await esmock('../../src/auth/read-only-admin-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: { createFrom: sinon.stub().returns(ldStub) },
        },
        '../../src/auth/route-utils.js': {
          extractRouteParams: sinon.stub().throws(routeError),
          resolveRouteCapability: sinon.stub().returns(null),
          guardNonEmptyRouteCapabilities: () => {},
        },
      });
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      const wrapped = errorModule.readOnlyAdminWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      expect(handler.called).to.be.false;
      expect(logStub.error.calledWithMatch(
        { tag: 'ro-admin', errMessage: 'unexpected route error', errName: 'Error' },
        'Unexpected error in RO admin authorization; denying access',
      )).to.be.true;
    });
  });

  describe('audit logging', () => {
    let mockedWrapper;

    beforeEach(async () => {
      const ldClient = {
        isFlagEnabledForIMSOrg: sinon.stub().resolves(true),
      };
      const mockedModule = await esmock('../../src/auth/read-only-admin-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sinon.stub().returns(ldClient),
          },
        },
      });
      mockedWrapper = mockedModule.readOnlyAdminWrapper;
    });

    it('emits an audit log for allowed RO admin requests', async () => {
      context.pathInfo = { method: 'GET', suffix: '/sites' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      expect(logStub.info.calledWithMatch({ tag: 'ro-admin-audit', method: 'GET', suffix: '/sites' }, 'RO admin accessed route')).to.be.true;
    });

    it('does not emit audit log for non-RO-admin requests', async () => {
      context.attributes.authInfo.isReadOnlyAdmin = () => false;
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      expect(logStub.info.calledWithMatch({ tag: 'ro-admin-audit' })).to.be.false;
    });

    it('does not emit audit log when RO admin is blocked', async () => {
      context.pathInfo = { method: 'POST', suffix: '/sites' };
      // Provide dataAccess so isOwnerOfResource fails cleanly (no siteId in params or body).
      context.dataAccess = { Site: { findById: sinon.stub().resolves(null) } };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      expect(logStub.info.calledWithMatch({ tag: 'ro-admin-audit' })).to.be.false;
    });
  });
});
