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
/* eslint-disable no-underscore-dangle */

import { expect, use as chaiUse } from 'chai';
import sinon from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import PostgresSiteCollection from '../../../../../src/models/postgres/site/site.pg.collection.js';
import PostgresSiteModel from '../../../../../src/models/postgres/site/site.pg.model.js';
import Schema from '../../../../../src/models/base/schema.js';

chaiUse(chaiAsPromised);

function createMockPostgrestClient(responseData = [], responseError = null) {
  const chain = {
    select: sinon.stub(),
    eq: sinon.stub(),
    in: sinon.stub(),
    order: sinon.stub(),
    range: sinon.stub(),
    gte: sinon.stub(),
    lte: sinon.stub(),
    insert: sinon.stub(),
    upsert: sinon.stub(),
    update: sinon.stub(),
    delete: sinon.stub(),
    single: sinon.stub(),
    maybeSingle: sinon.stub(),
    then: null,
  };

  Object.keys(chain).forEach((key) => {
    if (key !== 'then' && chain[key]) {
      chain[key].returns(chain);
    }
  });

  chain.then = (resolve) => resolve({ data: responseData, error: responseError });
  chain.maybeSingle.returns({
    then: (resolve) => resolve({ data: responseData, error: responseError }),
  });

  const client = {
    from: sinon.stub().returns(chain),
    _chain: chain,
  };

  return client;
}

function createSiteSchema() {
  return new Schema(
    PostgresSiteModel,
    PostgresSiteCollection,
    {
      serviceName: 'SpaceCat',
      schemaVersion: 1,
      attributes: {
        siteId: { type: 'string', required: true },
        baseURL: { type: 'string', required: true },
        deliveryType: { type: 'string', default: 'aem_edge' },
        isLive: { type: 'boolean', default: false },
        config: { type: 'any', default: {} },
        externalOwnerId: { type: 'string' },
        externalSiteId: { type: 'string' },
        createdAt: { type: 'string', readOnly: true, default: () => new Date().toISOString() },
        updatedAt: { type: 'string', readOnly: true, default: () => new Date().toISOString() },
      },
      indexes: {
        primary: {
          pk: { facets: ['siteId'] },
          sk: { facets: [] },
        },
        byDeliveryType: {
          index: 'byDeliveryType',
          pk: { facets: ['deliveryType'] },
          sk: { facets: ['updatedAt'] },
        },
        byExternalOwnerIdAndExternalSiteId: {
          index: 'byExternalOwnerIdAndExternalSiteId',
          pk: { facets: ['externalOwnerId'] },
          sk: { facets: ['externalSiteId'] },
        },
      },
      references: [],
      options: { allowUpdates: true, allowRemove: true },
    },
  );
}

function createMockLog() {
  return {
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub(),
  };
}

describe('PostgresSiteCollection', () => {
  let collection;
  let client;
  let schema;
  let registry;
  let log;

  beforeEach(() => {
    log = createMockLog();
    schema = createSiteSchema();
    client = createMockPostgrestClient();
    registry = {
      getCollection: sinon.stub(),
      log: createMockLog(),
    };
    collection = new PostgresSiteCollection(client, registry, schema, log);
    registry.getCollection.withArgs('SiteCollection').returns(collection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('allSitesToAudit', () => {
    it('returns an array of site IDs', async () => {
      const siteRecords = [
        {
          id: 'site-id-1', base_url: 'https://example.com', delivery_type: 'aem_edge', is_live: true, config: {},
        },
        {
          id: 'site-id-2', base_url: 'https://other.com', delivery_type: 'aem_edge', is_live: false, config: {},
        },
      ];

      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: siteRecords, error: null });

      const result = await collection.allSitesToAudit();

      expect(result).to.be.an('array');
      expect(result).to.have.length(2);
      expect(result[0]).to.equal('site-id-1');
      expect(result[1]).to.equal('site-id-2');
    });

    it('returns empty array when no sites exist', async () => {
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: [], error: null });

      const result = await collection.allSitesToAudit();

      expect(result).to.be.an('array');
      expect(result).to.have.length(0);
    });
  });

  describe('allWithLatestAudit', () => {
    it('throws when auditType is missing', async () => {
      await expect(collection.allWithLatestAudit('')).to.be.rejectedWith('auditType is required');
      await expect(collection.allWithLatestAudit(null)).to.be.rejectedWith('auditType is required');
    });

    it('returns sites ordered by latest audit', async () => {
      const siteRecords = [
        {
          id: 'site-1', base_url: 'https://a.com', delivery_type: 'aem_edge', is_live: true, config: {},
        },
        {
          id: 'site-2', base_url: 'https://b.com', delivery_type: 'aem_edge', is_live: true, config: {},
        },
      ];

      // Mock the all() call for sites
      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: siteRecords, error: null });

      // Mock LatestAuditCollection
      const mockAudit = {
        getSiteId: () => 'site-2',
        record: { siteId: 'site-2', auditType: 'cwv' },
      };
      const mockLatestAuditCollection = {
        all: sinon.stub().resolves([mockAudit]),
      };
      registry.getCollection.withArgs('LatestAuditCollection').returns(mockLatestAuditCollection);

      const result = await collection.allWithLatestAudit('cwv');

      expect(result).to.be.an('array');
      expect(result).to.have.length(2);
      // site-2 should come first (it has a latest audit)
      expect(result[0].getId()).to.equal('site-2');
      expect(result[1].getId()).to.equal('site-1');
      // site-2 should have cached audit
      expect(result[0]._accessorCache['getLatestAuditByAuditType:["cwv"]']).to.equal(mockAudit);
      // site-1 should have null cached audit
      expect(result[1]._accessorCache['getLatestAuditByAuditType:["cwv"]']).to.be.null;
    });

    it('filters by delivery type when provided', async () => {
      const siteRecords = [
        {
          id: 'site-1', base_url: 'https://a.com', delivery_type: 'aem_cs', is_live: true, config: {},
        },
      ];

      const chain = client._chain;
      chain.then = (resolve) => resolve({ data: siteRecords, error: null });

      const mockLatestAuditCollection = {
        all: sinon.stub().resolves([]),
      };
      registry.getCollection.withArgs('LatestAuditCollection').returns(mockLatestAuditCollection);

      // Stub allByDeliveryType to ensure it's called
      const allByDeliveryTypeStub = sinon.stub(collection, 'allByDeliveryType');
      const site1 = {
        getId: () => 'site-1',
        _accessorCache: {},
        record: { siteId: 'site-1' },
      };
      allByDeliveryTypeStub.resolves([site1]);

      const result = await collection.allWithLatestAudit('cwv', 'asc', 'aem_cs');

      expect(allByDeliveryTypeStub.calledOnceWith('aem_cs')).to.be.true;
      expect(result).to.have.length(1);
    });
  });

  describe('findByPreviewURL', () => {
    it('throws on invalid URL', async () => {
      await expect(collection.findByPreviewURL('not-a-url'))
        .to.be.rejectedWith('Invalid preview URL');
    });

    it('throws on unsupported preview URL', async () => {
      await expect(collection.findByPreviewURL('https://www.google.com'))
        .to.be.rejectedWith('Unsupported preview URL');
    });

    it('handles Helix preview URLs', async () => {
      const findStub = sinon.stub(collection, 'findByExternalOwnerIdAndExternalSiteId');
      findStub.resolves({ getId: () => 'site-1' });

      const result = await collection.findByPreviewURL('https://main--mysite--myowner.aem.page/path');

      expect(findStub.calledOnceWith('myowner', 'mysite')).to.be.true;
      expect(result.getId()).to.equal('site-1');
    });

    it('handles AEM CS preview URLs', async () => {
      const findStub = sinon.stub(collection, 'findByExternalOwnerIdAndExternalSiteId');
      findStub.resolves({ getId: () => 'site-2' });

      const result = await collection.findByPreviewURL('https://author-p123-e456.adobeaemcloud.com/path');

      expect(findStub.calledOnceWith('p123', 'e456')).to.be.true;
      expect(result.getId()).to.equal('site-2');
    });

    it('throws on invalid Helix preview URL', async () => {
      await expect(collection.findByPreviewURL('https://invalid.hlx.page'))
        .to.be.rejectedWith('Invalid Helix preview URL');
    });
  });
});
