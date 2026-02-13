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

/* eslint-env mocha */

import { expect } from 'chai';
import sinon from 'sinon';

import {
  DEFAULT_PAGE_SIZE,
  applyWhere,
  camelToSnake,
  createFieldMaps,
  decodeCursor,
  encodeCursor,
  entityToTableName,
  fromDbRecord,
  snakeToCamel,
  toDbField,
  toDbRecord,
  toModelField,
} from '../../../src/util/postgrest.utils.js';

describe('postgrest.utils', () => {
  describe('DEFAULT_PAGE_SIZE', () => {
    it('is 1000', () => {
      expect(DEFAULT_PAGE_SIZE).to.equal(1000);
    });
  });

  describe('camelToSnake', () => {
    it('converts simple camelCase', () => {
      expect(camelToSnake('organizationId')).to.equal('organization_id');
      expect(camelToSnake('isLive')).to.equal('is_live');
    });

    it('converts camelCase with consecutive uppercase letters', () => {
      expect(camelToSnake('baseURL')).to.equal('base_url');
    });

    it('handles already-lowercase', () => {
      expect(camelToSnake('id')).to.equal('id');
      expect(camelToSnake('name')).to.equal('name');
    });

    it('handles single word', () => {
      expect(camelToSnake('config')).to.equal('config');
    });

    it('handles multiple humps', () => {
      expect(camelToSnake('createdAtDate')).to.equal('created_at_date');
    });
  });

  describe('snakeToCamel', () => {
    it('converts snake_case', () => {
      expect(snakeToCamel('base_url')).to.equal('baseUrl');
      expect(snakeToCamel('organization_id')).to.equal('organizationId');
    });

    it('handles already camelCase', () => {
      expect(snakeToCamel('id')).to.equal('id');
      expect(snakeToCamel('name')).to.equal('name');
    });

    it('handles multiple underscores', () => {
      expect(snakeToCamel('created_at_date')).to.equal('createdAtDate');
    });
  });

  describe('entityToTableName', () => {
    it('pluralizes and converts to snake_case', () => {
      expect(entityToTableName('Site')).to.equal('sites');
      expect(entityToTableName('Organization')).to.equal('organizations');
      expect(entityToTableName('Opportunity')).to.equal('opportunities');
    });

    it('handles multi-word entity names', () => {
      expect(entityToTableName('FixEntity')).to.equal('fix_entities');
      expect(entityToTableName('SiteCandidate')).to.equal('site_candidates');
      expect(entityToTableName('SiteTopPage')).to.equal('site_top_pages');
    });

    it('uses overrides when defined', () => {
      expect(entityToTableName('LatestAudit')).to.equal('audits');
    });
  });

  describe('encodeCursor / decodeCursor', () => {
    it('round-trips an offset', () => {
      const cursor = encodeCursor(42);
      expect(decodeCursor(cursor)).to.equal(42);
    });

    it('round-trips zero', () => {
      const cursor = encodeCursor(0);
      expect(decodeCursor(cursor)).to.equal(0);
    });

    it('returns 0 for null cursor', () => {
      expect(decodeCursor(null)).to.equal(0);
    });

    it('returns 0 for undefined cursor', () => {
      expect(decodeCursor(undefined)).to.equal(0);
    });

    it('returns 0 for empty string cursor', () => {
      expect(decodeCursor('')).to.equal(0);
    });

    it('returns 0 for invalid base64', () => {
      expect(decodeCursor('not-valid-base64!!!')).to.equal(0);
    });

    it('returns 0 for valid base64 but invalid JSON', () => {
      const invalidJson = Buffer.from('not json', 'utf-8').toString('base64');
      expect(decodeCursor(invalidJson)).to.equal(0);
    });

    it('returns 0 for negative offset', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: -5 }), 'utf-8').toString('base64');
      expect(decodeCursor(cursor)).to.equal(0);
    });

    it('returns 0 for non-integer offset', () => {
      const cursor = Buffer.from(JSON.stringify({ offset: 3.14 }), 'utf-8').toString('base64');
      expect(decodeCursor(cursor)).to.equal(0);
    });
  });

  describe('createFieldMaps', () => {
    it('builds bidirectional maps from schema attributes', () => {
      const mockSchema = {
        getAttributes: () => ({
          baseURL: { postgrestField: 'base_url' },
          name: {},
          organizationId: {},
        }),
        getIdName: () => 'siteId',
      };
      const { toDbMap, toModelMap } = createFieldMaps(mockSchema);
      expect(toDbMap.baseURL).to.equal('base_url');
      expect(toDbMap.name).to.equal('name');
      expect(toDbMap.organizationId).to.equal('organization_id');
      expect(toDbMap.siteId).to.equal('id');
      expect(toModelMap.base_url).to.equal('baseURL');
      expect(toModelMap.name).to.equal('name');
      expect(toModelMap.organization_id).to.equal('organizationId');
      expect(toModelMap.id).to.equal('siteId');
    });

    it('handles schema without getIdName', () => {
      const mockSchema = {
        getAttributes: () => ({
          name: {},
          value: {},
        }),
      };
      const { toDbMap, toModelMap } = createFieldMaps(mockSchema);
      expect(toDbMap.name).to.equal('name');
      expect(toDbMap.value).to.equal('value');
      expect(toModelMap.name).to.equal('name');
      expect(toModelMap.value).to.equal('value');
    });

    it('uses postgrestField override when provided', () => {
      const mockSchema = {
        getAttributes: () => ({
          orgId: { postgrestField: 'org_id' },
        }),
        getIdName: () => 'entityId',
      };
      const { toDbMap, toModelMap } = createFieldMaps(mockSchema);
      expect(toDbMap.orgId).to.equal('org_id');
      expect(toModelMap.org_id).to.equal('orgId');
    });

    it('maps entity id to "id" column', () => {
      const mockSchema = {
        getAttributes: () => ({
          organizationId: {},
          name: {},
        }),
        getIdName: () => 'organizationId',
      };
      const { toDbMap, toModelMap } = createFieldMaps(mockSchema);
      expect(toDbMap.organizationId).to.equal('id');
      expect(toModelMap.id).to.equal('organizationId');
    });

    it('does not remap when id is already named "id"', () => {
      const mockSchema = {
        getAttributes: () => ({
          id: {},
          name: {},
        }),
        getIdName: () => 'id',
      };
      const { toDbMap, toModelMap } = createFieldMaps(mockSchema);
      expect(toDbMap.id).to.equal('id');
      expect(toModelMap.id).to.equal('id');
    });
  });

  describe('toDbField', () => {
    it('uses map when field exists', () => {
      const map = { baseURL: 'base_url' };
      expect(toDbField('baseURL', map)).to.equal('base_url');
    });

    it('falls back to camelToSnake', () => {
      expect(toDbField('organizationId', {})).to.equal('organization_id');
    });
  });

  describe('toModelField', () => {
    it('uses map when field exists', () => {
      const map = { base_url: 'baseURL' };
      expect(toModelField('base_url', map)).to.equal('baseURL');
    });

    it('falls back to snakeToCamel', () => {
      expect(toModelField('organization_id', {})).to.equal('organizationId');
    });
  });

  describe('toDbRecord', () => {
    it('transforms all record keys using the map', () => {
      const toDbMap = { baseURL: 'base_url', isLive: 'is_live' };
      const result = toDbRecord({ baseURL: 'https://x.com', isLive: true }, toDbMap);
      expect(result).to.deep.equal({ base_url: 'https://x.com', is_live: true });
    });

    it('falls back to camelToSnake for unmapped keys', () => {
      const result = toDbRecord({ deliveryType: 'aem_edge' }, {});
      expect(result).to.deep.equal({ delivery_type: 'aem_edge' });
    });

    it('handles empty record', () => {
      expect(toDbRecord({}, {})).to.deep.equal({});
    });
  });

  describe('fromDbRecord', () => {
    it('transforms all record keys using the map', () => {
      const toModelMap = { base_url: 'baseURL', is_live: 'isLive' };
      const result = fromDbRecord({ base_url: 'https://x.com', is_live: true }, toModelMap);
      expect(result).to.deep.equal({ baseURL: 'https://x.com', isLive: true });
    });

    it('falls back to snakeToCamel for unmapped keys', () => {
      const result = fromDbRecord({ delivery_type: 'aem_edge' }, {});
      expect(result).to.deep.equal({ deliveryType: 'aem_edge' });
    });

    it('handles empty record', () => {
      expect(fromDbRecord({}, {})).to.deep.equal({});
    });
  });

  describe('applyWhere', () => {
    let query;

    beforeEach(() => {
      query = {
        eq: sinon.stub().returnsThis(),
        contains: sinon.stub().returnsThis(),
      };
    });

    it('returns query unchanged when whereFn is not a function', () => {
      const result = applyWhere(query, null, {});
      expect(result).to.equal(query);
      expect(query.eq.called).to.be.false;
    });

    it('returns query unchanged when whereFn is undefined', () => {
      const result = applyWhere(query, undefined, {});
      expect(result).to.equal(query);
    });

    it('applies eq filter', () => {
      const whereFn = (attrs, op) => op.eq(attrs.organizationId, 'org-123');
      const toDbMap = { organizationId: 'organization_id' };
      applyWhere(query, whereFn, toDbMap);
      expect(query.eq.calledOnceWith('organization_id', 'org-123')).to.be.true;
    });

    it('applies contains filter with array value', () => {
      const whereFn = (attrs, op) => op.contains(attrs.tags, ['a', 'b']);
      const toDbMap = { tags: 'tags' };
      applyWhere(query, whereFn, toDbMap);
      expect(query.contains.calledOnceWith('tags', ['a', 'b'])).to.be.true;
    });

    it('wraps non-array contains value in array', () => {
      const whereFn = (attrs, op) => op.contains(attrs.tags, 'a');
      const toDbMap = { tags: 'tags' };
      applyWhere(query, whereFn, toDbMap);
      expect(query.contains.calledOnceWith('tags', ['a'])).to.be.true;
    });

    it('returns query when whereFn returns null', () => {
      const whereFn = () => null;
      const result = applyWhere(query, whereFn, {});
      expect(result).to.equal(query);
    });

    it('returns query when whereFn returns non-object', () => {
      const whereFn = () => 'not-an-object';
      const result = applyWhere(query, whereFn, {});
      expect(result).to.equal(query);
    });

    it('returns query for unknown expression type', () => {
      const whereFn = () => ({ type: 'unknown', field: 'x', value: 'y' });
      const result = applyWhere(query, whereFn, {});
      expect(result).to.equal(query);
    });

    it('uses proxy to map model field names to db field names', () => {
      const whereFn = (attrs, op) => op.eq(attrs.baseURL, 'https://example.com');
      const toDbMap = { baseURL: 'base_url' };
      applyWhere(query, whereFn, toDbMap);
      expect(query.eq.calledOnceWith('base_url', 'https://example.com')).to.be.true;
    });

    it('falls back to camelToSnake for unmapped fields in proxy', () => {
      const whereFn = (attrs, op) => op.eq(attrs.deliveryType, 'aem_edge');
      applyWhere(query, whereFn, {});
      expect(query.eq.calledOnceWith('delivery_type', 'aem_edge')).to.be.true;
    });
  });
});
