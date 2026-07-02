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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import BrandSemrushProject from '../../../../src/models/brand-semrush-project/brand-semrush-project.model.js';
import DataAccessError from '../../../../src/errors/data-access.error.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('BrandSemrushProjectCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    brandId: 'c3e1a4b6-2a8e-4d61-8b03-7d0a1d6b3201',
    semrushProjectId: 'proj-collection-test',
    geoTargetId: 2840,
    languageCode: 'en',
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
    } = createElectroMocks(BrandSemrushProject, mockRecord));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('initializes the BrandSemrushProjectCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('findBySlice', () => {
    it('delegates to findByIndexKeys with composite key', async () => {
      const expected = { id: 'row-1' };
      const findStub = sinon.stub(instance, 'findByIndexKeys').resolves(expected);

      const result = await instance.findBySlice(
        mockRecord.brandId,
        mockRecord.geoTargetId,
        mockRecord.languageCode,
      );

      expect(result).to.equal(expected);
      expect(findStub).to.have.been.calledOnceWithExactly({
        brandId: mockRecord.brandId,
        geoTargetId: mockRecord.geoTargetId,
        languageCode: mockRecord.languageCode,
      });
    });

    it('returns null when no matching slice exists', async () => {
      sinon.stub(instance, 'findByIndexKeys').resolves(null);

      const result = await instance.findBySlice(
        mockRecord.brandId,
        mockRecord.geoTargetId,
        mockRecord.languageCode,
      );

      expect(result).to.equal(null);
    });
  });

  // Smoke + delegation tests for the accessors that SchemaBuilder auto-generates
  // from the `(brandId, updatedAt)` index and `addAllIndex(['semrushProjectId'])`.
  // These cover the regression case where a schema typo would silently drop
  // the method from the public surface with no other test catching it.
  describe('auto-generated index accessors', () => {
    it('exposes allByBrandId, findByBrandId, allBySemrushProjectId, findBySemrushProjectId', () => {
      expect(instance.allByBrandId).to.be.a('function');
      expect(instance.findByBrandId).to.be.a('function');
      expect(instance.allBySemrushProjectId).to.be.a('function');
      expect(instance.findBySemrushProjectId).to.be.a('function');
    });

    it('exposes the (brandId, updatedAt) composite-key variants', () => {
      // The (brandId, updatedAt) index produces an additional accessor pair
      // beyond the single-key forms above. Asserting both shapes catches a
      // future regression where the sort-key composite is accidentally
      // dropped (which would not be caught by the single-key tests alone).
      expect(instance.allByBrandIdAndUpdatedAt).to.be.a('function');
      expect(instance.findByBrandIdAndUpdatedAt).to.be.a('function');
    });

    it('allByBrandId delegates to allByIndexKeys with { brandId }', async () => {
      const expected = [{ id: 'row-1' }];
      const stub = sinon.stub(instance, 'allByIndexKeys').resolves(expected);

      const result = await instance.allByBrandId(mockRecord.brandId);

      expect(result).to.equal(expected);
      expect(stub).to.have.been.calledOnce;
      expect(stub.firstCall.args[0]).to.deep.equal({ brandId: mockRecord.brandId });
    });

    it('findByBrandId delegates to findByIndexKeys with { brandId }', async () => {
      const expected = { id: 'row-1' };
      const stub = sinon.stub(instance, 'findByIndexKeys').resolves(expected);

      const result = await instance.findByBrandId(mockRecord.brandId);

      expect(result).to.equal(expected);
      expect(stub).to.have.been.calledOnce;
      expect(stub.firstCall.args[0]).to.deep.equal({ brandId: mockRecord.brandId });
    });

    it('allBySemrushProjectId delegates to allByIndexKeys with { semrushProjectId }', async () => {
      const expected = [{ id: 'row-1' }];
      const stub = sinon.stub(instance, 'allByIndexKeys').resolves(expected);

      const result = await instance.allBySemrushProjectId(mockRecord.semrushProjectId);

      expect(result).to.equal(expected);
      expect(stub).to.have.been.calledOnce;
      expect(stub.firstCall.args[0]).to.deep.equal({
        semrushProjectId: mockRecord.semrushProjectId,
      });
    });

    it('findBySemrushProjectId delegates to findByIndexKeys with { semrushProjectId }', async () => {
      const expected = { id: 'row-1' };
      const stub = sinon.stub(instance, 'findByIndexKeys').resolves(expected);

      const result = await instance.findBySemrushProjectId(mockRecord.semrushProjectId);

      expect(result).to.equal(expected);
      expect(stub).to.have.been.calledOnce;
      expect(stub.firstCall.args[0]).to.deep.equal({
        semrushProjectId: mockRecord.semrushProjectId,
      });
    });
  });

  describe('allByOrganizationId', () => {
    const organizationId = 'a1b2c3d4-0000-4000-8000-000000000001';

    function setupPostgrestChain(result) {
      const rangeStub = sinon.stub().resolves(result);
      // .order() is chained twice (brand_id, then semrush_project_id as a
      // deterministic secondary sort) — the stub must return an object whose
      // own `order` also resolves to itself so both calls in the chain work,
      // matching @supabase/postgrest-js's real `order()` (returns `this`).
      const orderStub = sinon.stub();
      orderStub.returns({ range: rangeStub, order: orderStub });
      const isStub = sinon.stub().returns({ order: orderStub });
      const eqStub = sinon.stub().returns({ is: isStub, order: orderStub });
      const selectStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });
      return {
        selectStub, eqStub, isStub, orderStub, rangeStub,
      };
    }

    it('queries the embedded brands join, filters tombstones by default, and maps rows to identity DTOs', async () => {
      const { selectStub, eqStub, isStub } = setupPostgrestChain({
        data: [{
          brand_id: mockRecord.brandId,
          semrush_project_id: mockRecord.semrushProjectId,
          semrush_location_id: mockRecord.geoTargetId,
          language: mockRecord.languageCode,
          site_id: 'a1b2c3d4-0000-4000-8000-000000000002',
          brands: {
            organization_id: organizationId,
            semrush_sub_workspace_id: 'sub-ws-1',
          },
        }],
        error: null,
      });

      const results = await instance.allByOrganizationId(organizationId);

      expect(selectStub).to.have.been.calledWithMatch('brands!brand_to_semrush_projects_brand_id_fkey!inner');
      expect(eqStub).to.have.been.calledWith('brands.organization_id', organizationId);
      expect(isStub).to.have.been.calledWith('deleted_at', null);
      expect(results).to.deep.equal([{
        brandId: mockRecord.brandId,
        semrushProjectId: mockRecord.semrushProjectId,
        geoTargetId: mockRecord.geoTargetId,
        languageCode: mockRecord.languageCode,
        siteId: 'a1b2c3d4-0000-4000-8000-000000000002',
        organizationId,
        semrushSubWorkspaceId: 'sub-ws-1',
      }]);
    });

    it('does not filter tombstones when includeDeleted is true', async () => {
      const { isStub, orderStub } = setupPostgrestChain({ data: [], error: null });

      await instance.allByOrganizationId(organizationId, { includeDeleted: true });

      expect(isStub).to.not.have.been.called;
      expect(orderStub).to.have.been.calledWith('brand_id');
    });

    it('defaults null site_id / missing brands embed to null in the DTO', async () => {
      setupPostgrestChain({
        data: [{
          brand_id: mockRecord.brandId,
          semrush_project_id: mockRecord.semrushProjectId,
          semrush_location_id: mockRecord.geoTargetId,
          language: mockRecord.languageCode,
          site_id: null,
          brands: null,
        }],
        error: null,
      });

      const results = await instance.allByOrganizationId(organizationId);

      expect(results[0].siteId).to.be.null;
      expect(results[0].organizationId).to.be.null;
      expect(results[0].semrushSubWorkspaceId).to.be.null;
    });

    it('returns an empty array when no rows exist', async () => {
      setupPostgrestChain({ data: [], error: null });

      const results = await instance.allByOrganizationId(organizationId);

      expect(results).to.deep.equal([]);
    });

    it('returns an empty array when data is null', async () => {
      setupPostgrestChain({ data: null, error: null });

      const results = await instance.allByOrganizationId(organizationId);

      expect(results).to.deep.equal([]);
    });

    it('paginates when results exceed page size', async () => {
      const DEFAULT_PAGE_SIZE = 1000;
      const page1 = Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => ({
        brand_id: `brand-${i}`,
        semrush_project_id: `proj-${i}`,
        semrush_location_id: 2840,
        language: 'en',
        site_id: null,
        brands: { organization_id: organizationId, semrush_sub_workspace_id: null },
      }));
      const page2 = [{
        brand_id: `brand-${DEFAULT_PAGE_SIZE}`,
        semrush_project_id: `proj-${DEFAULT_PAGE_SIZE}`,
        semrush_location_id: 2840,
        language: 'en',
        site_id: null,
        brands: { organization_id: organizationId, semrush_sub_workspace_id: null },
      }];

      const rangeStub = sinon.stub();
      rangeStub.onFirstCall().resolves({ data: page1, error: null });
      rangeStub.onSecondCall().resolves({ data: page2, error: null });
      const orderStub = sinon.stub();
      orderStub.returns({ range: rangeStub, order: orderStub });
      const isStub = sinon.stub().returns({ order: orderStub });
      const eqStub = sinon.stub().returns({ is: isStub, order: orderStub });
      const selectStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });

      const results = await instance.allByOrganizationId(organizationId);

      expect(results).to.have.lengthOf(DEFAULT_PAGE_SIZE + 1);
      expect(rangeStub).to.have.been.calledTwice;
      expect(rangeStub.firstCall.args).to.deep.equal([0, DEFAULT_PAGE_SIZE - 1]);
      // eslint-disable-next-line max-len
      expect(rangeStub.secondCall.args).to.deep.equal([DEFAULT_PAGE_SIZE, DEFAULT_PAGE_SIZE * 2 - 1]);
    });

    it('truncates at the MAX_ORG_ROWS safety cap and logs a warning instead of paginating forever', async () => {
      const DEFAULT_PAGE_SIZE = 1000;
      const MAX_ORG_ROWS = 50_000;
      const fullPage = () => Array.from({ length: DEFAULT_PAGE_SIZE }, (_, i) => ({
        brand_id: `brand-${i}`,
        semrush_project_id: `proj-${i}`,
        semrush_location_id: 2840,
        language: 'en',
        site_id: null,
        brands: { organization_id: organizationId, semrush_sub_workspace_id: null },
      }));
      // Every page is a FULL page, so without the cap this loop never
      // terminates on its own (data.length >= DEFAULT_PAGE_SIZE forever).
      const rangeStub = sinon.stub().callsFake(async () => ({ data: fullPage(), error: null }));
      const orderStub = sinon.stub();
      orderStub.returns({ range: rangeStub, order: orderStub });
      const isStub = sinon.stub().returns({ order: orderStub });
      const eqStub = sinon.stub().returns({ is: isStub, order: orderStub });
      const selectStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });

      const results = await instance.allByOrganizationId(organizationId);

      expect(results).to.have.lengthOf(MAX_ORG_ROWS);
      expect(rangeStub.callCount).to.equal(MAX_ORG_ROWS / DEFAULT_PAGE_SIZE);
      expect(mockLogger.warn).to.have.been.calledOnce;
      expect(mockLogger.warn.firstCall.args[0]).to.include(`truncated at ${MAX_ORG_ROWS} rows`);
    });

    it('throws DataAccessError when organizationId is missing', async () => {
      await expect(instance.allByOrganizationId(null))
        .to.be.rejectedWith(DataAccessError, 'organizationId is required');
      await expect(instance.allByOrganizationId(''))
        .to.be.rejectedWith(DataAccessError, 'organizationId is required');
    });

    it('throws DataAccessError when organizationId is not a valid UUID', async () => {
      await expect(instance.allByOrganizationId('not-a-uuid'))
        .to.be.rejectedWith(DataAccessError, 'organizationId is required and must be a valid UUID');
    });

    it('throws DataAccessError on PostgREST error', async () => {
      setupPostgrestChain({ data: null, error: { message: 'boom' } });

      await expect(instance.allByOrganizationId(organizationId))
        .to.be.rejectedWith(DataAccessError, 'Failed to query mapping rows by organization');
    });
  });
});
