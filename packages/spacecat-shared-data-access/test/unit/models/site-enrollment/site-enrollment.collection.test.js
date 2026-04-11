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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import SiteEnrollment from '../../../../src/models/site-enrollment/site-enrollment.model.js';
import BaseCollection from '../../../../src/models/base/base.collection.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SiteEnrollmentCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    siteId: 'cfa88998-a0a0-4136-b21d-0ff2aa127443',
    entitlementId: '71f85d21-14d2-4e6d-ae9a-b8860082fb6d',
    updatedBy: 'system',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(SiteEnrollment, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SiteEnrollmentCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('create', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns existing enrollment when siteId/entitlementId already exists', async () => {
      const existing = {
        getEntitlementId: () => mockRecord.entitlementId,
      };
      const findByIndexKeysStub = sinon.stub(instance, 'findByIndexKeys').resolves(existing);
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      const result = await instance.create(mockRecord);

      expect(result).to.equal(existing);
      expect(findByIndexKeysStub).to.have.been.calledOnceWithExactly({
        siteId: mockRecord.siteId,
        entitlementId: mockRecord.entitlementId,
      });
      expect(superCreateStub).to.not.have.been.called;
    });

    it('falls back to BaseCollection.create when no matching enrollment exists', async () => {
      sinon.stub(instance, 'findByIndexKeys').resolves(null);
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      const result = await instance.create(mockRecord, { upsert: true });

      expect(result).to.equal(model);
      expect(superCreateStub).to.have.been.calledOnceWithExactly(mockRecord, { upsert: true });
    });
  });

  describe('allSiteIdsByProductCode', () => {
    let fromStub;
    let selectStub;
    let eqStub;

    beforeEach(() => {
      eqStub = sinon.stub();
      selectStub = sinon.stub().returns({ eq: eqStub });
      fromStub = sinon.stub().returns({ select: selectStub });
      instance.postgrestService.from = fromStub;
    });

    afterEach(() => {
      sinon.restore();
    });

    it('throws DataAccessError when productCode is falsy', async () => {
      await expect(instance.allSiteIdsByProductCode(null)).to.be.rejectedWith('productCode is required');
      await expect(instance.allSiteIdsByProductCode(undefined)).to.be.rejectedWith('productCode is required');
      await expect(instance.allSiteIdsByProductCode('')).to.be.rejectedWith('productCode is required');
    });

    it('returns array of site IDs for a matching product code', async () => {
      eqStub.resolves({
        data: [
          { site_id: 'cfa88998-a0a0-4136-b21d-0ff2aa127443' },
          { site_id: 'd1e2f3a4-b5c6-7890-abcd-ef1234567890' },
        ],
        error: null,
      });

      const result = await instance.allSiteIdsByProductCode('LLMO');

      expect(result).to.deep.equal([
        'cfa88998-a0a0-4136-b21d-0ff2aa127443',
        'd1e2f3a4-b5c6-7890-abcd-ef1234567890',
      ]);
      expect(fromStub).to.have.been.calledOnceWithExactly('site_enrollments');
      expect(selectStub).to.have.been.calledOnceWithExactly('site_id, entitlements!inner(product_code)');
      expect(eqStub).to.have.been.calledOnceWithExactly('entitlements.product_code', 'LLMO');
    });

    it('returns empty array when no enrollments match', async () => {
      eqStub.resolves({ data: [], error: null });

      const result = await instance.allSiteIdsByProductCode('LLMO');

      expect(result).to.deep.equal([]);
    });

    it('returns empty array when data is null', async () => {
      eqStub.resolves({ data: null, error: null });

      const result = await instance.allSiteIdsByProductCode('LLMO');

      expect(result).to.deep.equal([]);
    });

    it('logs error and throws DataAccessError when query fails', async () => {
      const dbError = new Error('DB connection failed');
      eqStub.resolves({ data: null, error: dbError });

      await expect(instance.allSiteIdsByProductCode('LLMO'))
        .to.be.rejectedWith('Failed to query site_enrollments by productCode');

      expect(mockLogger.error).to.have.been.called;
    });
  });
});
