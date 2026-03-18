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
});
