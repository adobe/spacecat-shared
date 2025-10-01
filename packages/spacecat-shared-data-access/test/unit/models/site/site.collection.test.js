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

/* eslint-env mocha */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Site from '../../../../src/models/site/site.model.js';

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

    describe('getSitesByProjectName', () => {
      it('should return sites for a valid project name', async () => {
        mockProjectCollection.findByProjectName.resolves(mockProject);
        instance.allByProjectId = stub().resolves(mockSites);

        const result = await instance.getSitesByProjectName('Test Project');

        expect(result).to.deep.equal(mockSites);
        expect(mockProjectCollection.findByProjectName).to.have.been.calledOnceWith('Test Project');
        expect(instance.allByProjectId).to.have.been.calledOnceWith('project-123');
      });

      it('should return empty array when project is not found', async () => {
        mockProjectCollection.findByProjectName.resolves(null);

        const result = await instance.getSitesByProjectName('Non-existent Project');

        expect(result).to.deep.equal([]);
        expect(mockProjectCollection.findByProjectName).to.have.been.calledOnceWith('Non-existent Project');
      });

      it('should throw error for empty project name', async () => {
        await expect(instance.getSitesByProjectName('')).to.be.rejectedWith('projectName is required');
        await expect(instance.getSitesByProjectName(null)).to.be.rejectedWith('projectName is required');
        await expect(instance.getSitesByProjectName(undefined)).to.be.rejectedWith('projectName is required');
      });
    });

    describe('getSitesByProjectId', () => {
      it('should return sites for a valid project ID', async () => {
        instance.allByProjectId = stub().resolves(mockSites);

        const result = await instance.getSitesByProjectId('project-123');

        expect(result).to.deep.equal(mockSites);
        expect(instance.allByProjectId).to.have.been.calledOnceWith('project-123');
      });

      it('should throw error for empty project ID', async () => {
        await expect(instance.getSitesByProjectId('')).to.be.rejectedWith('projectId is required');
        await expect(instance.getSitesByProjectId(null)).to.be.rejectedWith('projectId is required');
        await expect(instance.getSitesByProjectId(undefined)).to.be.rejectedWith('projectId is required');
      });
    });

    describe('getSitesByOrganizationIdAndProjectId', () => {
      it('should return sites when project belongs to organization', async () => {
        mockProjectCollection.findById.resolves(mockProject);
        instance.allByProjectId = stub().resolves(mockSites);

        const result = await instance.getSitesByOrganizationIdAndProjectId('org-123', 'project-123');

        expect(result).to.deep.equal(mockSites);
        expect(mockProjectCollection.findById).to.have.been.calledOnceWith('project-123');
        expect(instance.allByProjectId).to.have.been.calledOnceWith('project-123');
      });

      it('should return empty array when project does not belong to organization', async () => {
        const differentOrgProject = {
          getId: () => 'project-123',
          getOrganizationId: () => 'different-org',
        };
        mockProjectCollection.findById.resolves(differentOrgProject);

        const result = await instance.getSitesByOrganizationIdAndProjectId('org-123', 'project-123');

        expect(result).to.deep.equal([]);
        expect(mockProjectCollection.findById).to.have.been.calledOnceWith('project-123');
      });

      it('should return empty array when project is not found', async () => {
        mockProjectCollection.findById.resolves(null);

        const result = await instance.getSitesByOrganizationIdAndProjectId('org-123', 'project-123');

        expect(result).to.deep.equal([]);
        expect(mockProjectCollection.findById).to.have.been.calledOnceWith('project-123');
      });

      it('should throw error for empty organization ID', async () => {
        await expect(instance.getSitesByOrganizationIdAndProjectId('', 'project-123'))
          .to.be.rejectedWith('organizationId is required');
      });

      it('should throw error for empty project ID', async () => {
        await expect(instance.getSitesByOrganizationIdAndProjectId('org-123', ''))
          .to.be.rejectedWith('projectId is required');
      });
    });

    describe('getSitesByOrganizationIdAndProjectName', () => {
      it('should return sites when project belongs to organization', async () => {
        mockProjectCollection.allByOrganizationId.resolves([mockProject]);
        instance.allByProjectId = stub().resolves(mockSites);

        const result = await instance.getSitesByOrganizationIdAndProjectName('org-123', 'Test Project');

        expect(result).to.deep.equal(mockSites);
        expect(mockProjectCollection.allByOrganizationId).to.have.been.calledOnceWith('org-123');
        expect(instance.allByProjectId).to.have.been.calledOnceWith('project-123');
      });

      it('should return empty array when project is not found in organization', async () => {
        mockProjectCollection.allByOrganizationId.resolves([]);

        const result = await instance.getSitesByOrganizationIdAndProjectName('org-123', 'Non-existent Project');

        expect(result).to.deep.equal([]);
        expect(mockProjectCollection.allByOrganizationId).to.have.been.calledOnceWith('org-123');
      });

      it('should return empty array when project name does not match', async () => {
        const differentProject = {
          getId: () => 'project-456',
          getOrganizationId: () => 'org-123',
          getProjectName: () => 'Different Project',
        };
        mockProjectCollection.allByOrganizationId.resolves([differentProject]);

        const result = await instance.getSitesByOrganizationIdAndProjectName('org-123', 'Test Project');

        expect(result).to.deep.equal([]);
        expect(mockProjectCollection.allByOrganizationId).to.have.been.calledOnceWith('org-123');
      });

      it('should throw error for empty organization ID', async () => {
        await expect(instance.getSitesByOrganizationIdAndProjectName('', 'Test Project'))
          .to.be.rejectedWith('organizationId is required');
      });

      it('should throw error for empty project name', async () => {
        await expect(instance.getSitesByOrganizationIdAndProjectName('org-123', ''))
          .to.be.rejectedWith('projectName is required');
      });
    });
  });
});
