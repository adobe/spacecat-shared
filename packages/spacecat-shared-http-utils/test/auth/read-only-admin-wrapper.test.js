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
      .to.throw('routeCapabilities must not be an empty object');
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
      expect(body.message).to.equal('Read-only admin access is not enabled');
      expect(logStub.warn.calledWithMatch('Feature flag disabled')).to.be.true;
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
      expect(body.message).to.equal('Read-only admin access is not enabled');
      expect(handler.called).to.be.false;
    });

    it('returns 403 when createFrom throws (fail-closed)', async () => {
      const throwModule = await esmock('../../src/auth/read-only-admin-wrapper.js', {
        '@adobe/spacecat-shared-launchdarkly-client': {
          LaunchDarklyClient: {
            createFrom: sinon.stub().throws(new Error('SDK key missing')),
          },
        },
      });
      const wrapped = throwModule.readOnlyAdminWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Read-only admin access is not enabled');
      expect(handler.called).to.be.false;
    });

    it('returns 403 when isFlagEnabledForIMSOrg throws (fail-closed)', async () => {
      ldClient.isFlagEnabledForIMSOrg.rejects(new Error('LD unavailable'));
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Read-only admin access is not enabled');
      expect(handler.called).to.be.false;
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

    it('blocks read-only admin on a write route (POST)', async () => {
      context.pathInfo = { method: 'POST', suffix: '/sites' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Read-only admin users cannot perform write operations');
      expect(logStub.warn.calledWithMatch('blocked from route')).to.be.true;
      expect(handler.called).to.be.false;
    });

    it('blocks read-only admin on a write route (PATCH)', async () => {
      context.pathInfo = { method: 'PATCH', suffix: '/sites/abc-123' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      const result = await wrapped({}, context);

      expect(result.status).to.equal(403);
      const body = await result.json();
      expect(body.message).to.equal('Read-only admin users cannot perform write operations');
      expect(handler.called).to.be.false;
    });

    it('blocks read-only admin on a write route (DELETE)', async () => {
      context.pathInfo = { method: 'DELETE', suffix: '/sites/abc-123' };
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
      expect(body.message).to.equal('Read-only admin users cannot perform write operations');
      expect(logStub.warn.calledWithMatch('blocked from route')).to.be.true;
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

    it('passes through RO admin when routeCapabilities is not provided', async () => {
      const wrapped = mockedWrapper(handler);
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
    });

    it('passes through RO admin when routeCapabilities is null', async () => {
      const wrapped = mockedWrapper(handler, { routeCapabilities: null });
      const result = await wrapped({}, context);

      expect(result).to.deep.equal({ status: 200 });
      expect(handler.calledOnce).to.be.true;
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

      expect(logStub.info.calledWithMatch('[ro-admin-audit] RO admin accessed: GET /sites')).to.be.true;
    });

    it('does not emit audit log for non-RO-admin requests', async () => {
      context.attributes.authInfo.isReadOnlyAdmin = () => false;
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      expect(logStub.info.calledWithMatch('[ro-admin-audit]')).to.be.false;
    });

    it('does not emit audit log when RO admin is blocked', async () => {
      context.pathInfo = { method: 'POST', suffix: '/sites' };
      const wrapped = mockedWrapper(handler, { routeCapabilities });
      await wrapped({}, context);

      expect(logStub.info.calledWithMatch('[ro-admin-audit]')).to.be.false;
    });
  });
});
