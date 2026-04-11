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
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import DataAccessError from '../../../../src/errors/data-access.error.js';
import Entitlement from '../../../../src/models/entitlement/entitlement.model.js';
import { DEFAULT_PAGE_SIZE } from '../../../../src/util/postgrest.utils.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('EntitlementCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    entitlementId: 'af1b8f87-83d1-4072-ad34-dade6c6195a7',
    tier: 'PAID',
    productCode: 'LLMO',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Entitlement, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the EntitlementCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('schema references', () => {
    it('has SiteEnrollments reference with removeDependents set to true', () => {
      const siteEnrollmentsRef = schema.references.find(
        (ref) => ref.getTarget() === 'SiteEnrollments',
      );

      expect(siteEnrollmentsRef).to.exist;
      expect(siteEnrollmentsRef.getType()).to.equal('has_many');
      expect(siteEnrollmentsRef.isRemoveDependents()).to.be.true;
    });

    it('has TrialUserActivities reference with removeDependents set to false', () => {
      const trialUserActivitiesRef = schema.references.find(
        (ref) => ref.getTarget() === 'TrialUserActivities',
      );

      expect(trialUserActivitiesRef).to.exist;
      expect(trialUserActivitiesRef.getType()).to.equal('has_many');
      expect(trialUserActivitiesRef.isRemoveDependents()).to.be.false;
    });
  });

  describe('allByProductCodeWithOrganization', () => {
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

    it('returns entitlements with embedded organization data', async () => {
      const { orderStub } = setupPostgrestChain({
        data: [
          {
            id: 'ent-1',
            product_code: 'LLMO',
            tier: 'PAID',
            organizations: { id: 'org-1', name: 'Acme Corp', ims_org_id: 'acme@AdobeOrg' },
          },
          {
            id: 'ent-2',
            product_code: 'LLMO',
            tier: 'FREE_TRIAL',
            organizations: { id: 'org-2', name: 'Beta Inc', ims_org_id: 'beta@AdobeOrg' },
          },
        ],
        error: null,
      });

      const results = await instance.allByProductCodeWithOrganization('LLMO');

      expect(results).to.have.lengthOf(2);
      expect(orderStub).to.have.been.calledWith('id');
      expect(results[0]).to.deep.equal({
        entitlement: { id: 'ent-1', productCode: 'LLMO', tier: 'PAID' },
        organization: { id: 'org-1', name: 'Acme Corp', imsOrgId: 'acme@AdobeOrg' },
      });
      expect(results[1]).to.deep.equal({
        entitlement: { id: 'ent-2', productCode: 'LLMO', tier: 'FREE_TRIAL' },
        organization: { id: 'org-2', name: 'Beta Inc', imsOrgId: 'beta@AdobeOrg' },
      });
    });

    it('returns empty array when no entitlements exist', async () => {
      setupPostgrestChain({ data: [], error: null });

      const results = await instance.allByProductCodeWithOrganization('LLMO');

      expect(results).to.deep.equal([]);
    });

    it('returns empty array when data is null', async () => {
      setupPostgrestChain({ data: null, error: null });

      const results = await instance.allByProductCodeWithOrganization('LLMO');

      expect(results).to.deep.equal([]);
    });

    it('throws DataAccessError when productCode is missing', async () => {
      await expect(instance.allByProductCodeWithOrganization(null))
        .to.be.rejectedWith(DataAccessError, 'productCode is required');
      await expect(instance.allByProductCodeWithOrganization(''))
        .to.be.rejectedWith(DataAccessError, 'productCode is required');
    });

    it('throws DataAccessError on PostgREST error', async () => {
      setupPostgrestChain({ data: null, error: { message: 'connection refused' } });

      await expect(instance.allByProductCodeWithOrganization('LLMO'))
        .to.be.rejectedWith(DataAccessError, 'Failed to query entitlements with organizations');
      expect(mockLogger.error).to.have.been.called;
    });

    it('paginates when results exceed page size', async () => {
      const page1 = Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => ({
        id: `ent-${i}`,
        product_code: 'LLMO',
        tier: 'PAID',
        organizations: { id: `org-${i}`, name: `Org ${i}`, ims_org_id: `org${i}@AdobeOrg` },
      }));
      const page2 = [{
        id: `ent-${DEFAULT_PAGE_SIZE}`,
        product_code: 'LLMO',
        tier: 'FREE_TRIAL',
        organizations: { id: `org-${DEFAULT_PAGE_SIZE}`, name: `Org ${DEFAULT_PAGE_SIZE}`, ims_org_id: `org${DEFAULT_PAGE_SIZE}@AdobeOrg` },
      }];

      rangeStub = sinon.stub();
      rangeStub.onFirstCall().resolves({ data: page1, error: null });
      rangeStub.onSecondCall().resolves({ data: page2, error: null });
      const orderStub = sinon.stub().returns({ range: rangeStub });
      const eqStub = sinon.stub().returns({ order: orderStub });
      const selectStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });

      const results = await instance.allByProductCodeWithOrganization('LLMO');

      expect(results).to.have.lengthOf(DEFAULT_PAGE_SIZE + 1);
      expect(orderStub).to.have.been.calledWith('id');
      expect(rangeStub).to.have.been.calledTwice;
      expect(rangeStub.firstCall.args).to.deep.equal([0, DEFAULT_PAGE_SIZE - 1]);
      expect(rangeStub.secondCall.args)
        .to.deep.equal([DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE * 2 - 1]);
    });
  });
});
