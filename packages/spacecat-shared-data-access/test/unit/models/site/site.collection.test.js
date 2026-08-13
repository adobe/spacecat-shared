/*
 * Copyright 2024 Adobe. All rights reserved.
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
import sinon, { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import DataAccessError from '../../../../src/errors/data-access.error.js';
import Site from '../../../../src/models/site/site.model.js';
import { encodeCursor, DEFAULT_PAGE_SIZE } from '../../../../src/util/postgrest.utils.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SiteCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = { siteId: 's12345' };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Site, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SiteCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('allSitesToAudit', () => {
    it('returns all sites to audit', async () => {
      instance.all = stub().resolves([{ getId: () => 's12345' }]);

      const result = await instance.allSitesToAudit();

      expect(result).to.deep.equal(['s12345']);
      expect(instance.all).to.have.been.calledOnceWithExactly({}, { attributes: ['siteId'] });
    });
  });

  describe('allWithLatestAudit', () => {
    const mockAudit = {
      getId: () => 's12345',
      getSiteId: () => 's12345',
    };

    const mockSite = {
      getId: () => 's12345',
      _accessorCache: { getLatestAuditByAuditType: null },
    };

    const mockSiteNoAudit = {
      getId: () => 'x12345',
      _accessorCache: { getLatestAuditByAuditType: null },
    };

    beforeEach(() => {
      mockEntityRegistry.getCollection = stub().returns({
        all: stub().resolves([mockAudit]),
      });
    });

    it('throws error if audit type is not provided', async () => {
      await expect(instance.allWithLatestAudit()).to.be.rejectedWith('auditType is required');
    });

    it('returns all sites with latest audit', async () => {
      instance.all = stub().resolves([mockSite]);

      const result = await instance.allWithLatestAudit('cwv');

      expect(result).to.deep.equal([mockSite]);
      expect(instance.all).to.have.been.calledOnce;
    });

    it('returns all sites with latest audit by delivery type', async () => {
      instance.allByDeliveryType = stub().resolves([mockSite, mockSiteNoAudit]);

      const result = await instance.allWithLatestAudit('cwv', 'asc', 'aem_cs');

      expect(result).to.deep.equal([mockSite, mockSiteNoAudit]);
      expect(instance.allByDeliveryType).to.have.been.calledOnce;
    });
  });

  describe('findByPreviewURL', () => {
    const mockSite = {
      getId: () => 's12345',
      getDeliveryType: () => 'aem_edge',
      getHlxConfig: stub().returns({
        rso: {
          ref: 'ref',
          site: 'site',
          owner: 'owner',
        },
      }),
    };

    beforeEach(() => {
      instance.findByExternalOwnerIdAndExternalSiteId = stub();
    });

    it('returns site by helix preview URL', async () => {
      instance.findByExternalOwnerIdAndExternalSiteId.resolves(mockSite);

      const result = await instance.findByPreviewURL('https://ref--site--owner.aem.page');

      expect(result).to.deep.equal(mockSite);
      expect(instance.findByExternalOwnerIdAndExternalSiteId)
        .to.have.been.calledOnceWithExactly('owner', 'site');
    });

    it('returns site by AEMaaCS preview URL', async () => {
      instance.findByExternalOwnerIdAndExternalSiteId.resolves(mockSite);

      const result = await instance.findByPreviewURL('https://author-p123456-e123456-cmstg.adobeaemcloud.com/page');

      expect(result).to.deep.equal(mockSite);
      expect(instance.findByExternalOwnerIdAndExternalSiteId)
        .to.have.been.calledOnceWithExactly('p123456', 'e123456');
    });

    it('returns null when no site is found', async () => {
      instance.findByExternalOwnerIdAndExternalSiteId.resolves(null);

      const result = await instance.findByPreviewURL('https://ref--site--owner.aem.page');

      expect(result).to.be.null;
      expect(instance.findByExternalOwnerIdAndExternalSiteId)
        .to.have.been.calledOnceWithExactly('owner', 'site');
    });

    it('handles complex helix preview URLs with paths', async () => {
      instance.findByExternalOwnerIdAndExternalSiteId.resolves(mockSite);

      const result = await instance.findByPreviewURL('https://feature-branch--my-site--company.hlx.page/some/path?query=param');

      expect(result).to.deep.equal(mockSite);
      expect(instance.findByExternalOwnerIdAndExternalSiteId)
        .to.have.been.calledOnceWithExactly('company', 'my-site');
    });

    it('throws DataAccessError for invalid helix preview URLs', async () => {
      const invalidUrl = 'https://invalid-hlx-url.aem.page';
      await expect(instance.findByPreviewURL(invalidUrl))
        .to.be.rejectedWith(`Invalid Helix preview URL: ${invalidUrl}`);
    });

    it('throws DataAccessError for invalid preview URLs', async () => {
      const invalidUrl = 'invalid-url.com';
      await expect(instance.findByPreviewURL(invalidUrl))
        .to.be.rejectedWith(`Invalid preview URL: ${invalidUrl}`);
    });

    it('throws DataAccessError for unsupported preview URLs', async () => {
      const invalidUrl = 'https://unsupported-url.com';
      await expect(instance.findByPreviewURL(invalidUrl))
        .to.be.rejectedWith(`Unsupported preview URL: ${invalidUrl}`);
    });
  });

  describe('new project-related methods', () => {
    let mockProjectCollection;
    let mockProject;
    let mockSites;

    beforeEach(() => {
      mockProject = {
        getId: () => 'project-123',
        getOrganizationId: () => 'org-123',
        getProjectName: () => 'Test Project',
      };

      mockSites = [
        { getId: () => 'site-1', getProjectId: () => 'project-123' },
        { getId: () => 'site-2', getProjectId: () => 'project-123' },
      ];

      mockProjectCollection = {
        findByProjectName: stub(),
        findById: stub(),
        allByOrganizationId: stub(),
      };

      mockEntityRegistry.getCollection = stub().returns(mockProjectCollection);
    });

    describe('allByProjectName', () => {
      it('should return sites for a valid project name', async () => {
        mockProjectCollection.findByProjectName.resolves(mockProject);
        instance.allByProjectId = stub().resolves(mockSites);

        const result = await instance.allByProjectName('Test Project');

        expect(result).to.deep.equal(mockSites);
        expect(mockProjectCollection.findByProjectName).to.have.been.calledOnceWith('Test Project');
        expect(instance.allByProjectId).to.have.been.calledOnceWith('project-123');
      });

      it('should return empty array when project is not found', async () => {
        mockProjectCollection.findByProjectName.resolves(null);

        const result = await instance.allByProjectName('Non-existent Project');

        expect(result).to.deep.equal([]);
        expect(mockProjectCollection.findByProjectName).to.have.been.calledOnceWith('Non-existent Project');
      });

      it('should throw error for empty project name', async () => {
        await expect(instance.allByProjectName('')).to.be.rejectedWith('projectName is required');
        await expect(instance.allByProjectName(null)).to.be.rejectedWith('projectName is required');
        await expect(instance.allByProjectName(undefined)).to.be.rejectedWith('projectName is required');
      });
    });

    describe('allByProjectId', () => {
      it('should return sites for a valid project ID', async () => {
        instance.allByProjectId = stub().resolves(mockSites);

        const result = await instance.allByProjectId('project-123');

        expect(result).to.deep.equal(mockSites);
        expect(instance.allByProjectId).to.have.been.calledOnceWith('project-123');
      });

      it('should throw error for empty project ID', async () => {
        await expect(instance.allByProjectId('')).to.be.rejectedWith('projectId is required');
        await expect(instance.allByProjectId(null)).to.be.rejectedWith('projectId is required');
        await expect(instance.allByProjectId(undefined)).to.be.rejectedWith('projectId is required');
      });
    });

    describe('allByOrganizationIdAndProjectId', () => {
      let mockOrganizationCollection;
      let mockOrganization;

      beforeEach(() => {
        mockOrganization = {
          getId: () => 'org-123',
        };
        mockOrganizationCollection = {
          findById: stub(),
        };
        instance.entityRegistry.getCollection.withArgs('OrganizationCollection').returns(mockOrganizationCollection);
      });

      it('should return sites when organization and project exist', async () => {
        mockOrganizationCollection.findById.resolves(mockOrganization);
        mockProjectCollection.allByOrganizationId.resolves([mockProject]);
        instance.allByProjectId = stub().resolves(mockSites);

        const result = await instance.allByOrganizationIdAndProjectId('org-123', 'project-123');

        expect(result).to.deep.equal(mockSites);
        expect(mockOrganizationCollection.findById).to.have.been.calledOnceWith('org-123');
        expect(mockProjectCollection.allByOrganizationId).to.have.been.calledOnceWith('org-123');
        expect(instance.allByProjectId).to.have.been.calledOnceWith('project-123');
      });

      it('should return empty array when organization does not exist', async () => {
        mockOrganizationCollection.findById.resolves(null);

        const result = await instance.allByOrganizationIdAndProjectId('org-123', 'project-123');

        expect(result).to.deep.equal([]);
        expect(mockOrganizationCollection.findById).to.have.been.calledOnceWith('org-123');
      });

      it('should return empty array when project is not found in organization', async () => {
        mockOrganizationCollection.findById.resolves(mockOrganization);
        mockProjectCollection.allByOrganizationId.resolves([]);

        const result = await instance.allByOrganizationIdAndProjectId('org-123', 'project-123');

        expect(result).to.deep.equal([]);
        expect(mockOrganizationCollection.findById).to.have.been.calledOnceWith('org-123');
        expect(mockProjectCollection.allByOrganizationId).to.have.been.calledOnceWith('org-123');
      });

      it('should throw error for empty organization ID', async () => {
        await expect(instance.allByOrganizationIdAndProjectId('', 'project-123'))
          .to.be.rejectedWith('organizationId is required');
      });

      it('should throw error for empty project ID', async () => {
        await expect(instance.allByOrganizationIdAndProjectId('org-123', ''))
          .to.be.rejectedWith('projectId is required');
      });
    });

    describe('allByOrganizationIdAndProjectName', () => {
      let mockOrganizationCollection;
      let mockOrganization;

      beforeEach(() => {
        mockOrganization = {
          getId: () => 'org-123',
        };
        mockOrganizationCollection = {
          findById: stub(),
        };
        instance.entityRegistry.getCollection.withArgs('OrganizationCollection').returns(mockOrganizationCollection);
      });

      it('should return sites when organization and project exist', async () => {
        mockOrganizationCollection.findById.resolves(mockOrganization);
        mockProjectCollection.allByOrganizationId.resolves([mockProject]);
        instance.allByProjectId = stub().resolves(mockSites);

        const result = await instance.allByOrganizationIdAndProjectName('org-123', 'Test Project');

        expect(result).to.deep.equal(mockSites);
        expect(mockOrganizationCollection.findById).to.have.been.calledOnceWith('org-123');
        expect(mockProjectCollection.allByOrganizationId).to.have.been.calledOnceWith('org-123');
        expect(instance.allByProjectId).to.have.been.calledOnceWith('project-123');
      });

      it('should return empty array when organization does not exist', async () => {
        mockOrganizationCollection.findById.resolves(null);

        const result = await instance.allByOrganizationIdAndProjectName('org-123', 'Test Project');

        expect(result).to.deep.equal([]);
        expect(mockOrganizationCollection.findById).to.have.been.calledOnceWith('org-123');
      });

      it('should return empty array when project is not found in organization', async () => {
        mockOrganizationCollection.findById.resolves(mockOrganization);
        mockProjectCollection.allByOrganizationId.resolves([]);

        const result = await instance.allByOrganizationIdAndProjectName('org-123', 'Non-existent Project');

        expect(result).to.deep.equal([]);
        expect(mockOrganizationCollection.findById).to.have.been.calledOnceWith('org-123');
        expect(mockProjectCollection.allByOrganizationId).to.have.been.calledOnceWith('org-123');
      });

      it('should return empty array when project name does not match', async () => {
        const differentProject = {
          getId: () => 'project-456',
          getOrganizationId: () => 'org-123',
          getProjectName: () => 'Different Project',
        };
        mockOrganizationCollection.findById.resolves(mockOrganization);
        mockProjectCollection.allByOrganizationId.resolves([differentProject]);

        const result = await instance.allByOrganizationIdAndProjectName('org-123', 'Test Project');

        expect(result).to.deep.equal([]);
        expect(mockOrganizationCollection.findById).to.have.been.calledOnceWith('org-123');
        expect(mockProjectCollection.allByOrganizationId).to.have.been.calledOnceWith('org-123');
      });

      it('should throw error for empty organization ID', async () => {
        await expect(instance.allByOrganizationIdAndProjectName('', 'Test Project'))
          .to.be.rejectedWith('organizationId is required');
      });

      it('should throw error for empty project name', async () => {
        await expect(instance.allByOrganizationIdAndProjectName('org-123', ''))
          .to.be.rejectedWith('projectName is required');
      });
    });
  });

  describe('allByEnrollmentProductCode', () => {
    let mockSiteEnrollmentCollection;

    beforeEach(() => {
      mockSiteEnrollmentCollection = {
        allSiteIdsByProductCode: stub(),
      };
      mockEntityRegistry.getCollection = stub()
        .withArgs('SiteEnrollmentCollection')
        .returns(mockSiteEnrollmentCollection);
    });

    it('throws DataAccessError when productCode is falsy', async () => {
      await expect(instance.allByEnrollmentProductCode('')).to.be.rejectedWith('productCode is required');
      await expect(instance.allByEnrollmentProductCode(null)).to.be.rejectedWith('productCode is required');
      await expect(instance.allByEnrollmentProductCode(undefined)).to.be.rejectedWith('productCode is required');
    });

    it('returns empty array and does not call batchGetByKeys when no site IDs found', async () => {
      mockSiteEnrollmentCollection.allSiteIdsByProductCode.resolves([]);
      instance.batchGetByKeys = stub();

      const result = await instance.allByEnrollmentProductCode('LLMO');

      expect(result).to.deep.equal([]);
      expect(mockSiteEnrollmentCollection.allSiteIdsByProductCode).to.have.been.calledOnceWithExactly('LLMO');
      expect(instance.batchGetByKeys).to.not.have.been.called;
    });

    it('returns sites fetched by batchGetByKeys with default empty options', async () => {
      const siteIds = ['cfa88998-a0a0-4136-b21d-0ff2aa127443', 'd1e2f3a4-b5c6-7890-abcd-ef1234567890'];
      const mockSites = [{ getId: () => siteIds[0] }, { getId: () => siteIds[1] }];
      mockSiteEnrollmentCollection.allSiteIdsByProductCode.resolves(siteIds);
      instance.batchGetByKeys = stub().resolves({ data: mockSites });

      const result = await instance.allByEnrollmentProductCode('LLMO');

      expect(result).to.deep.equal(mockSites);
      expect(instance.batchGetByKeys).to.have.been.calledOnceWithExactly(
        [
          { siteId: 'cfa88998-a0a0-4136-b21d-0ff2aa127443' },
          { siteId: 'd1e2f3a4-b5c6-7890-abcd-ef1234567890' },
        ],
        {},
      );
    });

    it('passes caller-supplied options through to batchGetByKeys', async () => {
      const siteIds = ['cfa88998-a0a0-4136-b21d-0ff2aa127443'];
      const mockSites = [{ getId: () => siteIds[0] }];
      const options = { attributes: ['siteId', 'baseURL', 'config'] };
      mockSiteEnrollmentCollection.allSiteIdsByProductCode.resolves(siteIds);
      instance.batchGetByKeys = stub().resolves({ data: mockSites });

      const result = await instance.allByEnrollmentProductCode('LLMO', options);

      expect(result).to.deep.equal(mockSites);
      expect(instance.batchGetByKeys).to.have.been.calledOnceWithExactly(
        [{ siteId: 'cfa88998-a0a0-4136-b21d-0ff2aa127443' }],
        options,
      );
    });
  });

  describe('allByEnrollmentAndTier', () => {
    let mockSiteEnrollmentCollection;

    beforeEach(() => {
      mockSiteEnrollmentCollection = {
        allSiteIdsByTier: stub(),
      };
      mockEntityRegistry.getCollection = stub()
        .withArgs('SiteEnrollmentCollection')
        .returns(mockSiteEnrollmentCollection);
    });

    it('throws DataAccessError when tier is falsy', async () => {
      await expect(instance.allByEnrollmentAndTier('')).to.be.rejectedWith('tier is required');
      await expect(instance.allByEnrollmentAndTier(null)).to.be.rejectedWith('tier is required');
      await expect(instance.allByEnrollmentAndTier(undefined)).to.be.rejectedWith('tier is required');
    });

    it('returns empty array and skips batchGetByKeys when no site IDs found', async () => {
      mockSiteEnrollmentCollection.allSiteIdsByTier.resolves([]);
      instance.batchGetByKeys = stub();

      const result = await instance.allByEnrollmentAndTier('PAID');

      expect(result).to.deep.equal([]);
      expect(mockSiteEnrollmentCollection.allSiteIdsByTier)
        .to.have.been.calledOnceWithExactly('PAID', undefined);
      expect(instance.batchGetByKeys).to.not.have.been.called;
    });

    it('returns sites fetched by batchGetByKeys with default empty options', async () => {
      const siteIds = ['cfa88998-a0a0-4136-b21d-0ff2aa127443', 'd1e2f3a4-b5c6-7890-abcd-ef1234567890'];
      const mockSites = [{ getId: () => siteIds[0] }, { getId: () => siteIds[1] }];
      mockSiteEnrollmentCollection.allSiteIdsByTier.resolves(siteIds);
      instance.batchGetByKeys = stub().resolves({ data: mockSites });

      const result = await instance.allByEnrollmentAndTier('FREE_TRIAL');

      expect(result).to.deep.equal(mockSites);
      expect(mockSiteEnrollmentCollection.allSiteIdsByTier)
        .to.have.been.calledOnceWithExactly('FREE_TRIAL', undefined);
      expect(instance.batchGetByKeys).to.have.been.calledOnceWithExactly(
        [
          { siteId: 'cfa88998-a0a0-4136-b21d-0ff2aa127443' },
          { siteId: 'd1e2f3a4-b5c6-7890-abcd-ef1234567890' },
        ],
        {},
      );
    });

    it('forwards productCode and options to underlying calls', async () => {
      const siteIds = ['cfa88998-a0a0-4136-b21d-0ff2aa127443'];
      const mockSites = [{ getId: () => siteIds[0] }];
      const options = { attributes: ['siteId', 'baseURL'] };
      mockSiteEnrollmentCollection.allSiteIdsByTier.resolves(siteIds);
      instance.batchGetByKeys = stub().resolves({ data: mockSites });

      const result = await instance.allByEnrollmentAndTier('PLG', 'LLMO', options);

      expect(result).to.deep.equal(mockSites);
      expect(mockSiteEnrollmentCollection.allSiteIdsByTier)
        .to.have.been.calledOnceWithExactly('PLG', 'LLMO');
      expect(instance.batchGetByKeys).to.have.been.calledOnceWithExactly(
        [{ siteId: 'cfa88998-a0a0-4136-b21d-0ff2aa127443' }],
        options,
      );
    });
  });

  describe('allByEnrollmentFiltered', () => {
    const SELECT_WITH_EMBED = '*, site_enrollments!inner(entitlements!inner(tier, product_code))';
    const TIER_PATH = 'site_enrollments.entitlements.tier';
    const PRODUCT_CODE_PATH = 'site_enrollments.entitlements.product_code';

    let chain;
    let fromStub;

    // Builds a chainable PostgREST query-builder mock where every builder method
    // returns the same chain object, and the terminal `.range(...)` resolves to
    // the awaited `{ data, error }` result (mirrors supabase/postgrest-js).
    function setupChain(result) {
      chain = {};
      [
        'select', 'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
        'in', 'is', 'like', 'ilike', 'contains', 'order',
      ].forEach((method) => {
        chain[method] = sinon.stub().returns(chain);
      });
      chain.range = sinon.stub().resolves(result);
      fromStub = sinon.stub().returns(chain);
      instance.postgrestService.from = fromStub;
      return { chain, fromStub };
    }

    const siteRow = (id, extra = {}) => ({
      id,
      base_url: `https://${id}.example.com`,
      delivery_type: 'aem_edge',
      is_live: true,
      // embedded rows PostgREST returns for the inner-join filter
      site_enrollments: [{ entitlements: { tier: 'PAID', product_code: 'ASO' } }],
      ...extra,
    });

    it('throws DataAccessError when neither tier nor productCode is supplied', async () => {
      await expect(instance.allByEnrollmentFiltered())
        .to.be.rejectedWith(DataAccessError, 'tier or productCode is required');
      await expect(instance.allByEnrollmentFiltered({}))
        .to.be.rejectedWith(DataAccessError, 'tier or productCode is required');
      await expect(instance.allByEnrollmentFiltered({ tier: '', productCode: '' }))
        .to.be.rejectedWith(DataAccessError, 'tier or productCode is required');
    });

    it('builds the nested inner-join embed select and tier eq filter', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered({ tier: 'PAID' }, { limit: 10 });

      expect(fromStub).to.have.been.calledOnceWithExactly('sites');
      expect(chain.select).to.have.been.calledOnceWithExactly(SELECT_WITH_EMBED);
      expect(chain.eq).to.have.been.calledOnceWithExactly(TIER_PATH, 'PAID');
      expect(chain.range).to.have.been.calledOnceWithExactly(0, 9);
    });

    it('adds the product_code eq filter when productCode is supplied', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered({ tier: 'PAID', productCode: 'LLMO' }, { limit: 10 });

      expect(chain.eq).to.have.been.calledTwice;
      expect(chain.eq).to.have.been.calledWithExactly(TIER_PATH, 'PAID');
      expect(chain.eq).to.have.been.calledWithExactly(PRODUCT_CODE_PATH, 'LLMO');
    });

    it('supports filtering by productCode alone (no tier)', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered({ productCode: 'LLMO' }, { limit: 10 });

      expect(chain.eq).to.have.been.calledOnceWithExactly(PRODUCT_CODE_PATH, 'LLMO');
    });

    it('applies a caller-supplied where (ilike on baseURL → base_url) on top of the tier filter', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered(
        { tier: 'PAID' },
        { where: (attrs, op) => op.ilike(attrs.baseURL, '%acme%'), limit: 5 },
      );

      expect(chain.eq).to.have.been.calledOnceWithExactly(TIER_PATH, 'PAID');
      expect(chain.ilike).to.have.been.calledOnceWithExactly('base_url', '%acme%');
    });

    it('defaults to updated_at desc ordering with an id tiebreaker', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered({ tier: 'PAID' }, { limit: 10 });

      expect(chain.order).to.have.been.calledTwice;
      expect(chain.order.firstCall).to.have.been.calledWithExactly('updated_at', { ascending: false });
      expect(chain.order.secondCall).to.have.been.calledWithExactly('id', { ascending: false });
    });

    it('applies orderBy (mapped to db column) with an id tiebreaker and decodes the cursor offset', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered(
        { tier: 'PAID' },
        { orderBy: { attribute: 'baseURL', direction: 'asc' }, limit: 10, cursor: encodeCursor(20) },
      );

      expect(chain.order.firstCall).to.have.been.calledWithExactly('base_url', { ascending: true });
      expect(chain.order.secondCall).to.have.been.calledWithExactly('id', { ascending: true });
      expect(chain.range).to.have.been.calledOnceWithExactly(20, 29);
    });

    it('omits the id tiebreaker when ordering by the id field itself', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered(
        { tier: 'PAID' },
        { orderBy: { attribute: 'siteId', direction: 'asc' }, limit: 10 },
      );

      expect(chain.order).to.have.been.calledOnceWithExactly('id', { ascending: true });
    });

    it('orders descending when orderBy.direction is desc', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered(
        { tier: 'PAID' },
        { orderBy: { attribute: 'baseURL', direction: 'desc' }, limit: 10 },
      );

      expect(chain.order.firstCall).to.have.been.calledWithExactly('base_url', { ascending: false });
      expect(chain.order.secondCall).to.have.been.calledWithExactly('id', { ascending: false });
    });

    it('honors the exact limit passed (no silent cap or +1) via range', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered({ tier: 'PAID' }, { limit: 51, cursor: encodeCursor(50) });

      expect(chain.range).to.have.been.calledOnceWithExactly(50, 100);
    });

    it('defaults limit to DEFAULT_PAGE_SIZE when none is supplied', async () => {
      setupChain({ data: [], error: null });

      await instance.allByEnrollmentFiltered({ tier: 'PAID' });

      expect(chain.range).to.have.been.calledOnceWithExactly(0, DEFAULT_PAGE_SIZE - 1);
    });

    it('maps rows to Site instances and strips the embedded enrollments from the record', async () => {
      setupChain({ data: [siteRow('s1'), siteRow('s2')], error: null });

      const result = await instance.allByEnrollmentFiltered({ tier: 'PAID' }, { limit: 10 });

      expect(result).to.be.an('array').with.lengthOf(2);
      expect(result[0].getId()).to.equal('s1');
      expect(result[1].getId()).to.equal('s2');
      // the embed leaked by PostgREST must not survive onto the model record
      expect(result[0].record.siteEnrollments).to.be.undefined;
      expect(result[0].record.site_enrollments).to.be.undefined;
    });

    it('returns { data, cursor } with a next cursor when a full page is returned (returnCursor)', async () => {
      setupChain({ data: [siteRow('s1'), siteRow('s2')], error: null });

      const result = await instance.allByEnrollmentFiltered(
        { tier: 'PAID' },
        { limit: 2, returnCursor: true },
      );

      expect(result).to.be.an('object');
      expect(result.data.map((s) => s.getId())).to.deep.equal(['s1', 's2']);
      expect(result.cursor).to.equal(encodeCursor(2));
    });

    it('returns a null cursor when a partial page is returned (returnCursor)', async () => {
      setupChain({ data: [siteRow('s1')], error: null });

      const result = await instance.allByEnrollmentFiltered(
        { tier: 'PAID' },
        { limit: 2, returnCursor: true },
      );

      expect(result.data).to.have.lengthOf(1);
      expect(result.cursor).to.be.null;
    });

    it('carries the decoded offset into the next cursor (returnCursor)', async () => {
      setupChain({ data: [siteRow('s1'), siteRow('s2')], error: null });

      const result = await instance.allByEnrollmentFiltered(
        { tier: 'PAID' },
        { limit: 2, cursor: encodeCursor(4), returnCursor: true },
      );

      expect(result.cursor).to.equal(encodeCursor(6));
    });

    it('returns a bare array (not a cursor envelope) when returnCursor is falsy', async () => {
      setupChain({ data: [siteRow('s1')], error: null });

      const result = await instance.allByEnrollmentFiltered({ tier: 'PAID' }, { limit: 10 });

      expect(result).to.be.an('array').with.lengthOf(1);
    });

    it('returns an empty array when no rows match', async () => {
      setupChain({ data: [], error: null });

      const result = await instance.allByEnrollmentFiltered({ tier: 'PLG' }, { limit: 10 });

      expect(result).to.deep.equal([]);
    });

    it('treats a null data payload as an empty result set', async () => {
      setupChain({ data: null, error: null });

      const result = await instance.allByEnrollmentFiltered({ tier: 'PAID' }, { limit: 10 });

      expect(result).to.deep.equal([]);
    });

    it('throws DataAccessError and logs on a PostgREST error', async () => {
      setupChain({ data: null, error: { message: 'boom' } });

      await expect(instance.allByEnrollmentFiltered({ tier: 'PAID' }, { limit: 10 }))
        .to.be.rejectedWith(DataAccessError, 'Failed to query sites by enrollment filter');
      expect(mockLogger.error).to.have.been.called;
    });
  });
});
