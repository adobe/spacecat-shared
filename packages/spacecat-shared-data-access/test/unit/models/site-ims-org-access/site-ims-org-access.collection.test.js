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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import SiteImsOrgAccess from '../../../../src/models/site-ims-org-access/site-ims-org-access.model.js';
import SiteImsOrgAccessCollection from '../../../../src/models/site-ims-org-access/site-ims-org-access.collection.js';
import BaseCollection from '../../../../src/models/base/base.collection.js';
import DataAccessError from '../../../../src/errors/data-access.error.js';
import { DEFAULT_PAGE_SIZE } from '../../../../src/util/postgrest.utils.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SiteImsOrgAccessCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    siteId: 'cfa88998-a0a0-4136-b21d-0ff2aa127443',
    organizationId: '71f85d21-14d2-4e6d-ae9a-b8860082fb6d',
    targetOrganizationId: '5bc610a9-bc59-48d8-937e-4808ade2ecb1',
    productCode: 'LLMO',
    role: 'agency',
    grantedBy: 'ims:user456',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(SiteImsOrgAccess, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SiteImsOrgAccessCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(model).to.be.an('object');
    });
  });

  describe('COLLECTION_NAME', () => {
    it('has the correct collection name', () => {
      expect(SiteImsOrgAccessCollection.COLLECTION_NAME).to.equal('SiteImsOrgAccessCollection');
    });
  });

  describe('MAX_DELEGATES_PER_SITE', () => {
    it('has the correct limit', () => {
      expect(SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE).to.equal(50);
    });
  });

  describe('create', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws a DataAccessError with status 409 when organizationId equals targetOrganizationId', async () => {
      const selfDelegation = {
        ...mockRecord,
        targetOrganizationId: mockRecord.organizationId,
      };

      let caught;
      try {
        await instance.create(selfDelegation);
      } catch (err) {
        caught = err;
      }

      expect(caught).to.be.an.instanceof(DataAccessError);
      expect(caught.message).to.include('Cannot create self-delegation');
      expect(caught.status).to.equal(409);
    });

    it('returns existing grant when siteId/organizationId/productCode already exists', async () => {
      const existing = { getOrganizationId: () => mockRecord.organizationId };
      const findByIndexKeysStub = sinon.stub(instance, 'findByIndexKeys').resolves(existing);
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      const result = await instance.create(mockRecord);

      expect(result).to.equal(existing);
      expect(findByIndexKeysStub).to.have.been.calledOnceWithExactly({
        siteId: mockRecord.siteId,
        organizationId: mockRecord.organizationId,
        productCode: mockRecord.productCode,
      });
      expect(superCreateStub).to.not.have.been.called;
    });

    it('creates new grant when no matching grant exists and under the active limit', async () => {
      sinon.stub(instance, 'findByIndexKeys').resolves(null);
      sinon.stub(instance, 'allBySiteId').resolves([]);
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      const result = await instance.create(mockRecord, { upsert: true });

      expect(result).to.equal(model);
      expect(superCreateStub).to.have.been.calledOnceWithExactly(mockRecord, { upsert: true });
    });

    it('throws a DataAccessError with status 409 when the active-delegate limit is reached', async () => {
      sinon.stub(instance, 'findByIndexKeys').resolves(null);
      // All 50 grants are active (no expiresAt)
      const fiftyGrants = Array.from({ length: 50 }, (_, i) => ({
        id: `grant-${i}`,
        getExpiresAt: () => null,
      }));
      sinon.stub(instance, 'allBySiteId').resolves(fiftyGrants);

      let caught;
      try {
        await instance.create(mockRecord);
      } catch (err) {
        caught = err;
      }

      expect(caught).to.be.an.instanceof(DataAccessError);
      expect(caught.message).to.include('Cannot add delegate');
      expect(caught.status).to.equal(409);
    });

    it('does not count expired grants toward the delegate limit', async () => {
      sinon.stub(instance, 'findByIndexKeys').resolves(null);
      // 49 active + 1 expired = 50 total, but only 49 active
      const grants = Array.from({ length: 49 }, (_, i) => ({
        id: `grant-${i}`,
        getExpiresAt: () => null,
      }));
      grants.push({ id: 'expired-grant', getExpiresAt: () => '2020-01-01T00:00:00.000Z' });
      sinon.stub(instance, 'allBySiteId').resolves(grants);
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      const result = await instance.create(mockRecord);

      expect(result).to.equal(model);
      expect(superCreateStub).to.have.been.calledOnce;
    });

    it('skips idempotency check when key fields are missing', async () => {
      const itemWithoutProductCode = {
        siteId: mockRecord.siteId,
        organizationId: mockRecord.organizationId,
      };
      sinon.stub(instance, 'allBySiteId').resolves([]);
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      await instance.create(itemWithoutProductCode);

      expect(superCreateStub).to.have.been.calledOnce;
    });

    it('skips limit check when siteId is missing', async () => {
      const itemWithoutSiteId = {
        organizationId: mockRecord.organizationId,
        productCode: mockRecord.productCode,
      };
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      await instance.create(itemWithoutSiteId);

      expect(superCreateStub).to.have.been.calledOnce;
    });
  });

  describe('allByOrganizationIdWithTargetOrganization', () => {
    let rangeStub;

    function setupPostgrestChain(result) {
      rangeStub = sinon.stub().resolves(result);
      const orderStub = sinon.stub().returns({ range: rangeStub });
      const eqStub = sinon.stub().returns({ order: orderStub });
      const selectStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });
      return {
        selectStub, eqStub, orderStub, rangeStub,
      };
    }

    it('returns grants with embedded target organization data', async () => {
      const { selectStub, eqStub, orderStub } = setupPostgrestChain({
        data: [{
          id: 'grant-1',
          site_id: 'site-uuid-1',
          organization_id: mockRecord.organizationId,
          target_organization_id: mockRecord.targetOrganizationId,
          product_code: 'LLMO',
          role: 'agency',
          granted_by: 'ims:user123',
          expires_at: null,
          organizations: { id: mockRecord.targetOrganizationId, ims_org_id: 'target@AdobeOrg' },
        }],
        error: null,
      });

      // eslint-disable-next-line max-len
      const results = await instance.allByOrganizationIdWithTargetOrganization(mockRecord.organizationId);

      expect(results).to.have.lengthOf(1);
      // eslint-disable-next-line max-len
      expect(selectStub).to.have.been.calledWithMatch('organizations!site_ims_org_accesses_target_organization_id_fkey');
      expect(eqStub).to.have.been.calledWith('organization_id', mockRecord.organizationId);
      expect(orderStub).to.have.been.calledWith('id');
      const { grant, targetOrganization } = results[0];
      // grant is a plain camelCase object (not a model instance) — use direct property access.
      // The primary key maps to the model's idName (siteImsOrgAccessId), not 'id'.
      // null DB values are excluded by normalizeModelValue (expiresAt is absent, not null).
      expect(grant.siteImsOrgAccessId).to.equal('grant-1');
      expect(grant.siteId).to.equal('site-uuid-1');
      expect(grant.organizationId).to.equal(mockRecord.organizationId);
      expect(grant.targetOrganizationId).to.equal(mockRecord.targetOrganizationId);
      expect(grant.productCode).to.equal('LLMO');
      expect(grant.role).to.equal('agency');
      expect(grant.grantedBy).to.equal('ims:user123');
      expect(grant.expiresAt).to.be.undefined;
      expect(targetOrganization).to.deep.equal({
        id: mockRecord.targetOrganizationId,
        imsOrgId: 'target@AdobeOrg',
      });
    });

    it('returns empty array when no grants exist', async () => {
      setupPostgrestChain({ data: [], error: null });

      // eslint-disable-next-line max-len
      const results = await instance.allByOrganizationIdWithTargetOrganization(mockRecord.organizationId);

      expect(results).to.deep.equal([]);
    });

    it('returns empty array when data is null', async () => {
      setupPostgrestChain({ data: null, error: null });

      // eslint-disable-next-line max-len
      const results = await instance.allByOrganizationIdWithTargetOrganization(mockRecord.organizationId);

      expect(results).to.deep.equal([]);
    });

    it('throws DataAccessError when organizationId is missing', async () => {
      await expect(instance.allByOrganizationIdWithTargetOrganization(null))
        .to.be.rejectedWith(DataAccessError, 'organizationId is required');
      await expect(instance.allByOrganizationIdWithTargetOrganization(''))
        .to.be.rejectedWith(DataAccessError, 'organizationId is required');
    });

    it('throws DataAccessError on PostgREST error', async () => {
      setupPostgrestChain({ data: null, error: { message: 'connection refused' } });

      await expect(instance.allByOrganizationIdWithTargetOrganization(mockRecord.organizationId))
        .to.be.rejectedWith(DataAccessError, 'Failed to query grants with target organization');
      expect(mockLogger.error).to.have.been.called;
    });

    it('paginates when results exceed page size', async () => {
      const page1 = Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => ({
        id: `grant-${i}`,
        site_id: `site-${i}`,
        organization_id: mockRecord.organizationId,
        target_organization_id: `target-uuid-${i}`,
        product_code: 'LLMO',
        role: 'agency',
        granted_by: null,
        expires_at: null,
        organizations: { id: `target-uuid-${i}`, ims_org_id: `org${i}@AdobeOrg` },
      }));
      const page2 = [{
        id: `grant-${DEFAULT_PAGE_SIZE}`,
        site_id: `site-${DEFAULT_PAGE_SIZE}`,
        organization_id: mockRecord.organizationId,
        target_organization_id: `target-uuid-${DEFAULT_PAGE_SIZE}`,
        product_code: 'LLMO',
        role: 'agency',
        granted_by: null,
        expires_at: null,
        // eslint-disable-next-line max-len
        organizations: { id: `target-uuid-${DEFAULT_PAGE_SIZE}`, ims_org_id: `org${DEFAULT_PAGE_SIZE}@AdobeOrg` },
      }];

      rangeStub = sinon.stub();
      rangeStub.onFirstCall().resolves({ data: page1, error: null });
      rangeStub.onSecondCall().resolves({ data: page2, error: null });
      const orderStub = sinon.stub().returns({ range: rangeStub });
      const eqStub = sinon.stub().returns({ order: orderStub });
      const selectStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });

      // eslint-disable-next-line max-len
      const results = await instance.allByOrganizationIdWithTargetOrganization(mockRecord.organizationId);

      expect(results).to.have.lengthOf(DEFAULT_PAGE_SIZE + 1);
      expect(rangeStub).to.have.been.calledTwice;
      expect(rangeStub.firstCall.args).to.deep.equal([0, DEFAULT_PAGE_SIZE - 1]);
      // eslint-disable-next-line max-len
      expect(rangeStub.secondCall.args).to.deep.equal([DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE * 2 - 1]);
    });
  });

  describe('allByOrganizationIdsWithTargetOrganization', () => {
    function setupPostgrestChainForIn(result) {
      const rangeStub = sinon.stub().resolves(result);
      const orderStub = sinon.stub().returns({ range: rangeStub });
      const inStub = sinon.stub().returns({ order: orderStub });
      const selectStub = sinon.stub().returns({ in: inStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });
      return {
        selectStub, inStub, orderStub, rangeStub,
      };
    }

    it('returns grants with embedded target organization data for multiple orgs', async () => {
      const { inStub } = setupPostgrestChainForIn({
        data: [{
          id: 'grant-1',
          site_id: 'site-uuid-1',
          organization_id: mockRecord.organizationId,
          target_organization_id: mockRecord.targetOrganizationId,
          product_code: 'LLMO',
          role: 'agency',
          granted_by: null,
          expires_at: null,
          organizations: { id: mockRecord.targetOrganizationId, ims_org_id: 'target@AdobeOrg' },
        }],
        error: null,
      });

      const ids = [mockRecord.organizationId, 'other-org-uuid'];
      // eslint-disable-next-line max-len
      const results = await instance.allByOrganizationIdsWithTargetOrganization(ids);

      expect(results).to.have.lengthOf(1);
      expect(inStub).to.have.been.calledWith('organization_id', ids);
      expect(results[0].grant.organizationId).to.equal(mockRecord.organizationId);
      expect(results[0].targetOrganization.imsOrgId).to.equal('target@AdobeOrg');
    });

    it('returns empty array when organizationIds is empty', async () => {
      const results = await instance.allByOrganizationIdsWithTargetOrganization([]);
      expect(results).to.deep.equal([]);
    });

    it('returns empty array when organizationIds is null', async () => {
      const results = await instance.allByOrganizationIdsWithTargetOrganization(null);
      expect(results).to.deep.equal([]);
    });

    it('throws DataAccessError on PostgREST error', async () => {
      setupPostgrestChainForIn({ data: null, error: { message: 'connection refused' } });

      // eslint-disable-next-line max-len
      await expect(instance.allByOrganizationIdsWithTargetOrganization([mockRecord.organizationId]))
        .to.be.rejectedWith(DataAccessError, 'Failed to query grants with target organization');
      expect(mockLogger.error).to.have.been.called;
    });

    it('throws DataAccessError when organizationIds array exceeds the maximum size', async () => {
      const tooManyIds = Array.from(
        { length: SiteImsOrgAccessCollection.MAX_DELEGATES_PER_SITE + 1 },
        (_, i) => `org-uuid-${i}`,
      );

      await expect(instance.allByOrganizationIdsWithTargetOrganization(tooManyIds))
        .to.be.rejectedWith(DataAccessError, 'organizationIds array exceeds maximum');
    });
  });

  describe('findBySiteIdAndOrganizationIdAndProductCode', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('delegates to findByIndexKeys with the correct compound key', async () => {
      const expected = { getId: () => 'grant-uuid' };
      const stub = sinon.stub(instance, 'findByIndexKeys').resolves(expected);

      const result = await instance.findBySiteIdAndOrganizationIdAndProductCode(
        mockRecord.siteId,
        mockRecord.organizationId,
        mockRecord.productCode,
      );

      expect(result).to.equal(expected);
      expect(stub).to.have.been.calledOnceWithExactly({
        siteId: mockRecord.siteId,
        organizationId: mockRecord.organizationId,
        productCode: mockRecord.productCode,
      });
    });

    it('returns null when no matching grant exists', async () => {
      sinon.stub(instance, 'findByIndexKeys').resolves(null);

      const result = await instance.findBySiteIdAndOrganizationIdAndProductCode(
        mockRecord.siteId,
        mockRecord.organizationId,
        mockRecord.productCode,
      );

      expect(result).to.be.null;
    });

    it('throws DataAccessError when siteId is missing', async () => {
      // eslint-disable-next-line max-len
      await expect(instance.findBySiteIdAndOrganizationIdAndProductCode(null, mockRecord.organizationId, mockRecord.productCode))
        .to.be.rejectedWith(DataAccessError, 'siteId, organizationId and productCode are required');
    });

    it('throws DataAccessError when organizationId is missing', async () => {
      // eslint-disable-next-line max-len
      await expect(instance.findBySiteIdAndOrganizationIdAndProductCode(mockRecord.siteId, null, mockRecord.productCode))
        .to.be.rejectedWith(DataAccessError, 'siteId, organizationId and productCode are required');
    });

    it('throws DataAccessError when productCode is missing', async () => {
      // eslint-disable-next-line max-len
      await expect(instance.findBySiteIdAndOrganizationIdAndProductCode(mockRecord.siteId, mockRecord.organizationId, null))
        .to.be.rejectedWith(DataAccessError, 'siteId, organizationId and productCode are required');
    });
  });

  describe('allByOrganizationIdWithSites', () => {
    let rangeStub;
    let mockSiteInstance;
    let createInstanceFromRowStub;

    function setupPostgrestChain(result) {
      rangeStub = sinon.stub().resolves(result);
      const orderStub = sinon.stub().returns({ range: rangeStub });
      const eqStub = sinon.stub().returns({ order: orderStub });
      const selectStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });
      return {
        selectStub, eqStub, orderStub, rangeStub,
      };
    }

    beforeEach(() => {
      mockSiteInstance = { getId: () => mockRecord.siteId, getBaseURL: () => 'https://example.com' };
      createInstanceFromRowStub = sinon.stub().returns(mockSiteInstance);
      mockEntityRegistry.getCollection.withArgs('SiteCollection').returns({
        createInstanceFromRow: createInstanceFromRowStub,
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it('returns grants with embedded site data as model instances', async () => {
      const siteRow = {
        id: mockRecord.siteId,
        base_url: 'https://example.com',
        organization_id: mockRecord.targetOrganizationId,
        delivery_type: 'aem_edge',
      };
      const { selectStub, eqStub, orderStub } = setupPostgrestChain({
        data: [{
          id: 'grant-1',
          site_id: mockRecord.siteId,
          organization_id: mockRecord.organizationId,
          target_organization_id: mockRecord.targetOrganizationId,
          product_code: 'LLMO',
          role: 'agency',
          granted_by: 'ims:user123',
          expires_at: null,
          sites: siteRow,
        }],
        error: null,
      });

      const results = await instance.allByOrganizationIdWithSites(mockRecord.organizationId);

      expect(results).to.have.lengthOf(1);
      expect(selectStub).to.have.been.calledWithMatch('sites!site_ims_org_accesses_site_id_fkey');
      expect(eqStub).to.have.been.calledWith('organization_id', mockRecord.organizationId);
      expect(orderStub).to.have.been.calledWith('id');
      const { grant, site } = results[0];
      expect(grant.getId()).to.equal('grant-1');
      expect(grant.getSiteId()).to.equal(mockRecord.siteId);
      expect(grant.getOrganizationId()).to.equal(mockRecord.organizationId);
      expect(grant.getTargetOrganizationId()).to.equal(mockRecord.targetOrganizationId);
      expect(grant.getProductCode()).to.equal('LLMO');
      expect(grant.getRole()).to.equal('agency');
      expect(grant.getGrantedBy()).to.equal('ims:user123');
      expect(grant.getExpiresAt()).to.be.undefined;
      expect(site).to.equal(mockSiteInstance);
      expect(createInstanceFromRowStub).to.have.been.calledOnceWithExactly(siteRow);
    });

    it('sets site to null when sites is missing from row', async () => {
      setupPostgrestChain({
        data: [{
          id: 'grant-1',
          site_id: mockRecord.siteId,
          organization_id: mockRecord.organizationId,
          target_organization_id: mockRecord.targetOrganizationId,
          product_code: 'LLMO',
          role: 'agency',
          granted_by: null,
          expires_at: null,
          sites: null,
        }],
        error: null,
      });

      const results = await instance.allByOrganizationIdWithSites(mockRecord.organizationId);

      expect(results[0].site).to.be.null;
      expect(createInstanceFromRowStub).to.not.have.been.called;
    });

    it('returns empty array when no grants exist', async () => {
      setupPostgrestChain({ data: [], error: null });

      const results = await instance.allByOrganizationIdWithSites(mockRecord.organizationId);

      expect(results).to.deep.equal([]);
    });

    it('returns empty array when data is null', async () => {
      setupPostgrestChain({ data: null, error: null });

      const results = await instance.allByOrganizationIdWithSites(mockRecord.organizationId);

      expect(results).to.deep.equal([]);
    });

    it('throws DataAccessError when organizationId is missing', async () => {
      await expect(instance.allByOrganizationIdWithSites(null))
        .to.be.rejectedWith(DataAccessError, 'organizationId is required');
      await expect(instance.allByOrganizationIdWithSites(''))
        .to.be.rejectedWith(DataAccessError, 'organizationId is required');
    });

    it('throws DataAccessError on PostgREST error', async () => {
      setupPostgrestChain({ data: null, error: { message: 'connection refused' } });

      await expect(instance.allByOrganizationIdWithSites(mockRecord.organizationId))
        .to.be.rejectedWith(DataAccessError, 'Failed to query grants with site');
      expect(mockLogger.error).to.have.been.called;
    });

    it('paginates when results exceed page size', async () => {
      const makeSiteRow = (i) => ({ id: `site-uuid-${i}`, base_url: `https://example${i}.com` });
      const page1 = Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => ({
        id: `grant-${i}`,
        site_id: `site-uuid-${i}`,
        organization_id: mockRecord.organizationId,
        target_organization_id: `target-uuid-${i}`,
        product_code: 'LLMO',
        role: 'agency',
        granted_by: null,
        expires_at: null,
        sites: makeSiteRow(i),
      }));
      const page2 = [{
        id: `grant-${DEFAULT_PAGE_SIZE}`,
        site_id: `site-uuid-${DEFAULT_PAGE_SIZE}`,
        organization_id: mockRecord.organizationId,
        target_organization_id: `target-uuid-${DEFAULT_PAGE_SIZE}`,
        product_code: 'LLMO',
        role: 'agency',
        granted_by: null,
        expires_at: null,
        sites: makeSiteRow(DEFAULT_PAGE_SIZE),
      }];

      rangeStub = sinon.stub();
      rangeStub.onFirstCall().resolves({ data: page1, error: null });
      rangeStub.onSecondCall().resolves({ data: page2, error: null });
      const orderStub = sinon.stub().returns({ range: rangeStub });
      const eqStub = sinon.stub().returns({ order: orderStub });
      const selectStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });

      const results = await instance.allByOrganizationIdWithSites(mockRecord.organizationId);

      expect(results).to.have.lengthOf(DEFAULT_PAGE_SIZE + 1);
      expect(rangeStub).to.have.been.calledTwice;
      expect(createInstanceFromRowStub.callCount).to.equal(DEFAULT_PAGE_SIZE + 1);
    });
  });
});
