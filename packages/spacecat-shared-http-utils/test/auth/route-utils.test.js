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

import {
  extractRouteParams,
  guardNonEmptyRouteCapabilities,
  resolveRouteCapability,
} from '../../src/auth/route-utils.js';

describe('route-utils', () => {
  describe('resolveRouteCapability', () => {
    const routeMap = {
      'GET /sites': 'read',
      'POST /sites': 'write',
      'GET /sites/:siteId': 'read',
      'PATCH /sites/:siteId': 'write',
      'GET /sites/:siteId/audits/:auditId': 'read',
    };

    it('returns an exact match value', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/sites' } };
      expect(resolveRouteCapability(context, routeMap)).to.equal('read');
    });

    it('returns a parameterized match value', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/sites/abc-123' } };
      expect(resolveRouteCapability(context, routeMap)).to.equal('read');
    });

    it('returns a multi-param match value', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/sites/abc-123/audits/def-456' } };
      expect(resolveRouteCapability(context, routeMap)).to.equal('read');
    });

    it('returns null for an unmatched route', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/unknown' } };
      expect(resolveRouteCapability(context, routeMap)).to.be.null;
    });

    it('returns null when method is missing', () => {
      const context = { pathInfo: { suffix: '/sites' } };
      expect(resolveRouteCapability(context, routeMap)).to.be.null;
    });

    it('returns null when suffix is missing', () => {
      const context = { pathInfo: { method: 'GET' } };
      expect(resolveRouteCapability(context, routeMap)).to.be.null;
    });

    it('returns null when pathInfo is missing', () => {
      const context = {};
      expect(resolveRouteCapability(context, routeMap)).to.be.null;
    });

    it('uppercases the method for matching', () => {
      const context = { pathInfo: { method: 'post', suffix: '/sites' } };
      expect(resolveRouteCapability(context, routeMap)).to.equal('write');
    });

    it('does not match when segment count differs', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/sites/abc/extra/segments' } };
      expect(resolveRouteCapability(context, routeMap)).to.be.null;
    });

    it('handles malformed route keys without a space separator', () => {
      const malformed = { BADKEY: 'read' };
      const context = { pathInfo: { method: 'GET', suffix: '/something' } };
      expect(resolveRouteCapability(context, malformed)).to.be.null;
    });
  });

  describe('extractRouteParams', () => {
    const routeMap = {
      'GET /sites': 'site:read',
      'POST /sites': 'site:write',
      'GET /sites/:siteId': 'site:read',
      'PATCH /sites/:siteId': 'site:write',
      'GET /sites/:siteId/audits/:auditId': 'audit:read',
      'GET /organizations/:organizationId': 'organization:read',
    };

    it('returns empty object for an exact match (no params)', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/sites' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({});
    });

    it('returns extracted params for a single-param route', () => {
      const context = { pathInfo: { method: 'PATCH', suffix: '/sites/abc-123' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({ siteId: 'abc-123' });
    });

    it('returns multiple params from a nested parameterized route', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/sites/abc-123/audits/def-456' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({ siteId: 'abc-123', auditId: 'def-456' });
    });

    it('returns organizationId from an org route', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/organizations/org-789' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({ organizationId: 'org-789' });
    });

    it('returns empty object for an unmatched route', () => {
      const context = { pathInfo: { method: 'GET', suffix: '/unknown' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({});
    });

    it('returns empty object when method is missing', () => {
      const context = { pathInfo: { suffix: '/sites/abc-123' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({});
    });

    it('returns empty object when suffix is missing', () => {
      const context = { pathInfo: { method: 'PATCH' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({});
    });

    it('returns empty object when pathInfo is missing', () => {
      const context = {};
      expect(extractRouteParams(context, routeMap)).to.deep.equal({});
    });

    it('extracts :spaceCatId alias used by /v2/orgs routes', () => {
      const map = { 'PATCH /v2/orgs/:spaceCatId': 'organization:write' };
      const context = { pathInfo: { method: 'PATCH', suffix: '/v2/orgs/org-456' } };
      expect(extractRouteParams(context, map)).to.deep.equal({ spaceCatId: 'org-456' });
    });

    it('returns empty object when method does not match (PATCH vs POST)', () => {
      const context = { pathInfo: { method: 'POST', suffix: '/sites/abc-123' } };
      // routeMap has GET and PATCH for /sites/:siteId, not POST
      expect(extractRouteParams(context, routeMap)).to.deep.equal({});
    });

    it('uppercases request method before matching', () => {
      const context = { pathInfo: { method: 'patch', suffix: '/sites/abc-123' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({ siteId: 'abc-123' });
    });

    it('returns empty object when request has more segments than route pattern', () => {
      const context = { pathInfo: { method: 'PATCH', suffix: '/sites/abc-123/extra' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({});
    });

    it('matches route even when suffix has a trailing slash (filter(Boolean) strips empty segments)', () => {
      const context = { pathInfo: { method: 'PATCH', suffix: '/sites/abc-123/' } };
      expect(extractRouteParams(context, routeMap)).to.deep.equal({ siteId: 'abc-123' });
    });
  });

  describe('guardNonEmptyRouteCapabilities', () => {
    it('throws when routeCapabilities is an empty object', () => {
      expect(() => guardNonEmptyRouteCapabilities('testWrapper', {}))
        .to.throw('testWrapper: routeCapabilities must not be an empty object');
    });

    it('does not throw when routeCapabilities is a non-empty object', () => {
      expect(() => guardNonEmptyRouteCapabilities('testWrapper', { 'GET /sites': 'read' }))
        .to.not.throw();
    });

    it('does not throw when routeCapabilities is undefined', () => {
      expect(() => guardNonEmptyRouteCapabilities('testWrapper', undefined))
        .to.not.throw();
    });

    it('does not throw when routeCapabilities is null', () => {
      expect(() => guardNonEmptyRouteCapabilities('testWrapper', null))
        .to.not.throw();
    });
  });
});
