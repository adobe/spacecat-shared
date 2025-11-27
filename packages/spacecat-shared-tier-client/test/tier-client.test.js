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

import { use, expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import { Organization, Site } from '@adobe/spacecat-shared-data-access';
import TierClient from '../src/tier-client.js';

use(chaiAsPromised);
use(sinonChai);

describe('TierClient', () => {
  const sandbox = sinon.createSandbox();
  const orgId = '123e4567-e89b-12d3-a456-426614174000';
  const siteId = '456e7890-e89b-12d3-a456-426614174000';
  const productCode = 'LLMO';

  const mockEntitlement = {
    getId: () => 'entitlement-123',
    getOrganizationId: () => orgId,
    getProductCode: () => productCode,
    getTier: () => 'FREE_TRIAL',
  };

  const mockSiteEnrollment = {
    getId: () => 'enrollment-123',
    getSiteId: () => siteId,
    getEntitlementId: () => 'entitlement-123',
    getStatus: () => 'ACTIVE',
  };

  const mockOrganization = {
    getId: () => orgId,
    getImsOrgId: () => 'ims-org-123',
  };

  // Create actual Organization instance for instanceof checks
  const organizationInstance = Object.create(Organization.prototype);
  Object.assign(organizationInstance, mockOrganization);

  const mockSite = {
    getId: () => siteId,
    getName: () => 'Test Site',
    getOrganization: () => organizationInstance,
  };

  // Create actual Site instance for instanceof checks
  const siteInstance = Object.create(Site.prototype);
  Object.assign(siteInstance, mockSite);

  const mockDataAccess = {
    Entitlement: {
      findByOrganizationIdAndProductCode: sandbox.stub(),
      findById: sandbox.stub(),
      create: sandbox.stub(),
    },
    SiteEnrollment: {
      allBySiteId: sandbox.stub(),
      create: sandbox.stub(),
    },
    Organization: {
      findById: sandbox.stub(),
    },
    Site: {
      findById: sandbox.stub(),
    },
  };

  const mockContext = {
    dataAccess: mockDataAccess,
    log: {
      info: sandbox.stub(),
      error: sandbox.stub(),
      debug: sandbox.stub(),
      warn: sandbox.stub(),
    },
    attributes: {
      authInfo: {
        getProfile: () => ({ provider: 'IMS' }),
      },
    },
  };

  let tierClient;

  beforeEach(() => {
    sandbox.restore();

    // Reset all stubs
    Object.values(mockDataAccess).forEach((service) => {
      Object.values(service).forEach((method) => {
        if (typeof method === 'function' && method.reset) {
          method.reset();
        }
      });
    });

    tierClient = new TierClient(mockContext, organizationInstance, siteInstance, productCode);
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Static Factory Methods', () => {
    const testOrganization = Object.create(Organization.prototype);
    Object.assign(testOrganization, { getId: () => orgId });

    const testSite = Object.create(Site.prototype);
    Object.assign(testSite, {
      getId: () => siteId,
      getOrganizationId: () => orgId,
      getOrganization: () => testOrganization,
    });

    const testSiteWithOrgRef = Object.create(Site.prototype);
    Object.assign(testSiteWithOrgRef, {
      getId: () => siteId,
      getOrganizationId: () => orgId,
    });

    describe('createForOrg', () => {
      it('should create TierClient for organization', () => {
        const client = TierClient.createForOrg(mockContext, testOrganization, productCode);

        expect(client).to.be.an('object');
        expect(client.checkValidEntitlement).to.be.a('function');
        expect(client.createEntitlement).to.be.a('function');
      });

      it('should throw error when organization is not provided', () => {
        expect(() => TierClient.createForOrg(mockContext, null, productCode)).to.throw('Entity must be an instance of Organization');
      });

      it('should throw error when organization has no getId method', () => {
        const invalidOrg = { name: 'test' };
        expect(() => TierClient.createForOrg(mockContext, invalidOrg, productCode)).to.throw('Entity must be an instance of Organization');
      });

      it('should throw error when context is invalid', () => {
        expect(() => TierClient.createForOrg(null, testOrganization, productCode)).to.throw('Context is required');
      });

      it('should throw error when productCode is not provided', () => {
        expect(() => TierClient.createForOrg(mockContext, testOrganization, '')).to.throw('Product code is required');
      });

      it('should throw error when dataAccess is missing', () => {
        const invalidContext = { log: {} };
        expect(() => TierClient.createForOrg(invalidContext, testOrganization, productCode)).to.throw('Cannot destructure property');
      });
    });

    describe('createForSite', () => {
      it('should create TierClient for site with getOrganizationId', async () => {
        mockDataAccess.Organization.findById.resolves(testOrganization);
        const client = await TierClient.createForSite(mockContext, testSite, productCode);

        expect(client).to.be.an('object');
        expect(client.checkValidEntitlement).to.be.a('function');
        expect(client.createEntitlement).to.be.a('function');
        expect(mockDataAccess.Organization.findById).to.have.been.calledWith(orgId);
      });

      it('should create TierClient for site with getOrganizationId (alternative)', async () => {
        mockDataAccess.Organization.findById.resolves(testOrganization);
        const client = await TierClient.createForSite(mockContext, testSiteWithOrgRef, productCode);

        expect(client).to.be.an('object');
        expect(client.checkValidEntitlement).to.be.a('function');
        expect(client.createEntitlement).to.be.a('function');
        expect(mockDataAccess.Organization.findById).to.have.been.calledWith(orgId);
      });

      it('should throw error when organization not found for site', async () => {
        mockDataAccess.Organization.findById.resolves(null);

        await expect(TierClient.createForSite(mockContext, testSite, productCode))
          .to.be.rejectedWith(`[TierClient] Organization not found for organizationId: ${orgId}`);
      });

      it('should throw error when site is not provided', async () => {
        await expect(TierClient.createForSite(mockContext, null, productCode)).to.be.rejectedWith('Entity must be an instance of Site');
      });

      it('should throw error when site has no getId method', async () => {
        const invalidSite = { name: 'test' };
        await expect(TierClient.createForSite(mockContext, invalidSite, productCode)).to.be.rejectedWith('Entity must be an instance of Site');
      });

      it('should throw error when context is invalid', async () => {
        await expect(TierClient.createForSite(null, testSite, productCode)).to.be.rejectedWith('Context is required');
      });

      it('should throw error when productCode is not provided', async () => {
        await expect(TierClient.createForSite(mockContext, testSite, '')).to.be.rejectedWith('Product code is required');
      });

      it('should throw error when dataAccess is missing', async () => {
        const invalidContext = { log: {} };
        await expect(TierClient.createForSite(invalidContext, testSite, productCode)).to.be.rejectedWith('Cannot read properties of undefined');
      });
    });
  });

  describe('Constructor Validation', () => {
    it('should allow direct constructor usage', () => {
      const client = new TierClient(mockContext, organizationInstance, siteInstance, productCode);
      expect(client).to.be.an('object');
      expect(client.checkValidEntitlement).to.be.a('function');
      expect(client.createEntitlement).to.be.a('function');
    });

    it('should allow site to be null', () => {
      // site is now optional, so this should not throw an error
      expect(() => new TierClient(mockContext, organizationInstance, null, productCode))
        .to.not.throw();
    });
  });

  describe('checkValidEntitlement', () => {
    it('should return empty object when no entitlement exists', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);

      const result = await tierClient.checkValidEntitlement();

      expect(result).to.deep.equal({});
      expect(mockDataAccess.Entitlement.findByOrganizationIdAndProductCode)
        .to.have.been.calledWith(orgId, productCode);
    });

    it('should return only entitlement when site enrollment is missing', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      const result = await tierClient.checkValidEntitlement();

      expect(result).to.deep.equal({ entitlement: mockEntitlement });
      expect(mockDataAccess.SiteEnrollment.allBySiteId).to.have.been.calledWith(siteId);
    });

    it('should return both entitlement and site enrollment when both exist', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([mockSiteEnrollment]);

      const result = await tierClient.checkValidEntitlement();

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        siteEnrollment: mockSiteEnrollment,
      });
    });

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.rejects(error);

      await expect(tierClient.checkValidEntitlement()).to.be.rejectedWith('Database error');
    });

    it('should return only entitlement when no site is provided', async () => {
      // Create a TierClient without site
      const tierClientWithoutSite = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);

      const result = await tierClientWithoutSite.checkValidEntitlement();

      expect(result).to.deep.equal({ entitlement: mockEntitlement });
      expect(mockDataAccess.Entitlement.findByOrganizationIdAndProductCode)
        .to.have.been.calledWith(orgId, productCode);
      // SiteEnrollment.allBySiteId should not be called when site is null
      expect(mockDataAccess.SiteEnrollment.allBySiteId).to.not.have.been.called;
    });
  });

  describe('createEntitlement', () => {
    beforeEach(() => {
      mockDataAccess.Organization.findById.resolves(mockOrganization);
      mockDataAccess.Site.findById.resolves(mockSite);
    });

    it('should return existing entitlement and site enrollment when both exist', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([mockSiteEnrollment]);

      const result = await tierClient.createEntitlement('FREE_TRIAL');

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        siteEnrollment: mockSiteEnrollment,
      });
      expect(mockDataAccess.Entitlement.create).to.not.have.been.called;
      expect(mockDataAccess.SiteEnrollment.create).to.not.have.been.called;
    });

    it('should create site enrollment when only entitlement exists', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);
      mockDataAccess.SiteEnrollment.create.resolves(mockSiteEnrollment);

      const result = await tierClient.createEntitlement('FREE_TRIAL');

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        siteEnrollment: mockSiteEnrollment,
      });
      expect(mockDataAccess.Entitlement.create).to.not.have.been.called;
      expect(mockDataAccess.SiteEnrollment.create).to.have.been.calledWith({
        siteId,
        entitlementId: mockEntitlement.getId(),
      });
    });

    it('should create everything when nothing exists', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);
      mockDataAccess.Entitlement.create.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.create.resolves(mockSiteEnrollment);

      const result = await tierClient.createEntitlement('FREE_TRIAL');

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        siteEnrollment: mockSiteEnrollment,
      });
      expect(mockDataAccess.Entitlement.create).to.have.been.calledWith({
        organizationId: orgId,
        productCode,
        tier: 'FREE_TRIAL',
        quotas: { llmo_trial_prompts: 200, llmo_trial_prompts_consumed: 0 },
      });
      expect(mockDataAccess.SiteEnrollment.create).to.have.been.calledWith({
        siteId,
        entitlementId: mockEntitlement.getId(),
      });
    });

    it('should throw error for invalid tier', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);

      await expect(tierClient.createEntitlement('INVALID_TIER')).to.be.rejectedWith('Invalid tier: INVALID_TIER');
    });

    it('should work without site for createEntitlement (organization only)', async () => {
      // Create a TierClient without site
      const tierClientWithoutSite = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);
      mockDataAccess.Entitlement.create.resolves(mockEntitlement);

      const result = await tierClientWithoutSite.createEntitlement('FREE_TRIAL');

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
      });
      expect(mockDataAccess.Entitlement.create).to.have.been.calledWith({
        organizationId: orgId,
        productCode,
        tier: 'FREE_TRIAL',
        quotas: { llmo_trial_prompts: 200, llmo_trial_prompts_consumed: 0 },
      });
      expect(mockDataAccess.SiteEnrollment.create).to.not.have.been.called;
    });

    it('should return existing entitlement when site is not provided and entitlement exists', async () => {
      // Create a TierClient without site
      const tierClientWithoutSite = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);

      const result = await tierClientWithoutSite.createEntitlement('FREE_TRIAL');

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
      });
      expect(mockDataAccess.Entitlement.create).to.not.have.been.called;
      expect(mockDataAccess.SiteEnrollment.create).to.not.have.been.called;
    });

    it('should update tier when entitlement exists with different tier', async () => {
      const mockEntitlementWithDifferentTier = {
        ...mockEntitlement,
        getTier: () => 'PAID',
        setTier: sandbox.stub().returnsThis(),
        save: sandbox.stub().resolves(),
      };

      mockDataAccess.Entitlement
        .findByOrganizationIdAndProductCode.resolves(mockEntitlementWithDifferentTier);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([mockSiteEnrollment]);

      const result = await tierClient.createEntitlement('FREE_TRIAL');

      expect(mockEntitlementWithDifferentTier.setTier).to.have.been.calledWith('FREE_TRIAL');
      expect(mockEntitlementWithDifferentTier.save).to.have.been.called;
      expect(result).to.deep.equal({
        entitlement: mockEntitlementWithDifferentTier,
        siteEnrollment: mockSiteEnrollment,
      });
      expect(mockDataAccess.Entitlement.create).to.not.have.been.called;
    });

    it('should throw error when organization not found', async () => {
      mockDataAccess.Organization.findById.resolves(null);

      await expect(tierClient.createEntitlement('FREE_TRIAL')).to.be.rejectedWith('Cannot read properties of undefined');
    });

    it('should throw error when site not found', async () => {
      mockDataAccess.Site.findById.resolves(null);

      await expect(tierClient.createEntitlement('FREE_TRIAL')).to.be.rejectedWith('Cannot read properties of undefined');
    });

    it('should handle database errors during creation', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);
      mockDataAccess.Entitlement.create.rejects(new Error('Database error'));

      await expect(tierClient.createEntitlement('FREE_TRIAL')).to.be.rejectedWith('Database error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle context without authInfo', async () => {
      const contextWithoutAuth = {
        ...mockContext,
        attributes: {},
      };
      const clientWithoutAuth = new TierClient(
        contextWithoutAuth,
        organizationInstance,
        siteInstance,
        productCode,
      );

      mockDataAccess.Organization.findById.resolves(mockOrganization);
      mockDataAccess.Site.findById.resolves(mockSite);
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);
      mockDataAccess.Entitlement.create.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.create.resolves(mockSiteEnrollment);

      const result = await clientWithoutAuth.createEntitlement('FREE_TRIAL');

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        siteEnrollment: mockSiteEnrollment,
      });
    });

    it('should handle multiple site enrollments with different entitlements', async () => {
      const otherSiteEnrollment = {
        getId: () => 'other-enrollment-123',
        getSiteId: () => siteId,
        getEntitlementId: () => 'other-entitlement-123',
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([otherSiteEnrollment]);

      const result = await tierClient.checkValidEntitlement();

      expect(result).to.deep.equal({ entitlement: mockEntitlement });
    });
  });

  describe('revokeSiteEnrollment', () => {
    it('should successfully revoke site enrollment when it exists', async () => {
      const mockSiteEnrollmentWithRemove = {
        ...mockSiteEnrollment,
        remove: sandbox.stub().resolves(),
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([mockSiteEnrollmentWithRemove]);

      await tierClient.revokeSiteEnrollment();

      expect(mockSiteEnrollmentWithRemove.remove.calledOnce).to.be.true;
    });

    it('should throw error when site enrollment does not exist', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      await expect(tierClient.revokeSiteEnrollment()).to.be.rejectedWith('Site enrollment not found');
    });

    it('should throw error when entitlement does not exist', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);

      await expect(tierClient.revokeSiteEnrollment()).to.be.rejectedWith('Site enrollment not found');
    });

    it('should handle database errors during revocation', async () => {
      const mockSiteEnrollmentWithRemove = {
        ...mockSiteEnrollment,
        remove: sandbox.stub().rejects(new Error('Database error')),
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([mockSiteEnrollmentWithRemove]);

      await expect(tierClient.revokeSiteEnrollment()).to.be.rejectedWith('Database error');
    });

    it('should handle errors when checking valid entitlement', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.rejects(new Error('Database error'));

      await expect(tierClient.revokeSiteEnrollment()).to.be.rejectedWith('Database error');
    });

    it('should throw error with organization-only client (no site)', async () => {
      const orgOnlyClient = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);

      await expect(orgOnlyClient.revokeSiteEnrollment()).to.be.rejectedWith('Site enrollment not found');
    });
  });

  describe('revokeEntitlement', () => {
    it('should successfully revoke entitlement when it exists', async () => {
      const mockEntitlementWithRemove = {
        ...mockEntitlement,
        remove: sandbox.stub().resolves(),
      };

      mockDataAccess.Entitlement
        .findByOrganizationIdAndProductCode.resolves(mockEntitlementWithRemove);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      await tierClient.revokeEntitlement();

      expect(mockEntitlementWithRemove.remove.calledOnce).to.be.true;
    });

    it('should throw error when entitlement is PAID tier', async () => {
      const mockPaidEntitlement = {
        ...mockEntitlement,
        getTier: () => 'PAID',
        remove: sandbox.stub().resolves(),
      };

      mockDataAccess.Entitlement
        .findByOrganizationIdAndProductCode.resolves(mockPaidEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      await expect(tierClient.revokeEntitlement()).to.be.rejectedWith('Paid entitlement cannot be revoked');
      expect(mockPaidEntitlement.remove).to.not.have.been.called;
    });

    it('should throw error when entitlement does not exist', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      await expect(tierClient.revokeEntitlement()).to.be.rejectedWith('Entitlement not found');
    });

    it('should handle database errors during entitlement removal', async () => {
      const mockEntitlementWithRemoveError = {
        ...mockEntitlement,
        remove: sandbox.stub().rejects(new Error('Database error')),
      };

      mockDataAccess.Entitlement
        .findByOrganizationIdAndProductCode.resolves(mockEntitlementWithRemoveError);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      await expect(tierClient.revokeEntitlement()).to.be.rejectedWith('Database error');
    });

    it('should handle errors when checking valid entitlement', async () => {
      mockDataAccess.Entitlement
        .findByOrganizationIdAndProductCode
        .rejects(new Error('Database error'));

      await expect(tierClient.revokeEntitlement()).to.be.rejectedWith('Database error');
    });

    it('should work with organization-only client (no site)', async () => {
      const mockEntitlementWithRemove = {
        ...mockEntitlement,
        remove: sandbox.stub().resolves(),
      };

      const orgOnlyClient = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      mockDataAccess.Entitlement
        .findByOrganizationIdAndProductCode.resolves(mockEntitlementWithRemove);

      await orgOnlyClient.revokeEntitlement();

      expect(mockEntitlementWithRemove.remove.calledOnce).to.be.true;
    });
  });

  describe('revokePaidEntitlement', () => {
    it('should successfully revoke entitlement regardless of tier', async () => {
      const mockPaidEntitlement = {
        ...mockEntitlement,
        getTier: () => 'PAID',
        remove: sandbox.stub().resolves(),
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockPaidEntitlement);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      await tierClient.revokePaidEntitlement();

      expect(mockPaidEntitlement.remove.calledOnce).to.be.true;
    });

    it('should throw error when entitlement does not exist', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      await expect(tierClient.revokePaidEntitlement()).to.be.rejectedWith('Entitlement not found');
    });

    it('should handle database errors during entitlement removal', async () => {
      const mockEntitlementWithRemoveError = {
        ...mockEntitlement,
        remove: sandbox.stub().rejects(new Error('Database error')),
      };

      mockDataAccess.Entitlement
        .findByOrganizationIdAndProductCode.resolves(mockEntitlementWithRemoveError);
      mockDataAccess.SiteEnrollment.allBySiteId.resolves([]);

      await expect(tierClient.revokePaidEntitlement()).to.be.rejectedWith('Database error');
    });

    it('should propagate errors when checking valid entitlement', async () => {
      mockDataAccess.Entitlement
        .findByOrganizationIdAndProductCode
        .rejects(new Error('Database error'));

      await expect(tierClient.revokePaidEntitlement()).to.be.rejectedWith('Database error');
    });
  });
  describe('getAllEnrollment', () => {
    beforeEach(() => {
      mockDataAccess.SiteEnrollment.allByEntitlementId = sandbox.stub();
    });

    it('should return entitlement and enrollments when both exist (org-only)', async () => {
      const tierClientWithoutSite = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      const mockEnrollment2 = {
        getId: () => 'enrollment-456',
        getSiteId: () => '789-site-id',
        getEntitlementId: () => 'entitlement-123',
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([
        mockSiteEnrollment,
        mockEnrollment2,
      ]);

      const result = await tierClientWithoutSite.getAllEnrollment();

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        enrollments: [mockSiteEnrollment, mockEnrollment2],
      });
      expect(mockDataAccess.Entitlement.findByOrganizationIdAndProductCode)
        .to.have.been.calledWith(orgId, productCode);
      expect(mockDataAccess.SiteEnrollment.allByEntitlementId)
        .to.have.been.calledWith('entitlement-123');
    });

    it('should return filtered enrollments when site is provided', async () => {
      const mockEnrollment2 = {
        getId: () => 'enrollment-456',
        getSiteId: () => 'other-site-id',
        getEntitlementId: () => 'entitlement-123',
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([
        mockSiteEnrollment,
        mockEnrollment2,
      ]);

      const result = await tierClient.getAllEnrollment();

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        enrollments: [mockSiteEnrollment],
      });
      expect(mockDataAccess.SiteEnrollment.allByEntitlementId)
        .to.have.been.calledWith('entitlement-123');
    });

    it('should return null entitlement and empty enrollments when no entitlement exists', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);

      const result = await tierClient.getAllEnrollment();

      expect(result).to.deep.equal({
        entitlement: null,
        enrollments: [],
      });
      expect(mockDataAccess.SiteEnrollment.allByEntitlementId).to.not.have.been.called;
    });

    it('should return empty enrollments when entitlement exists but no enrollments', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([]);

      const result = await tierClient.getAllEnrollment();

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        enrollments: [],
      });
    });

    it('should handle database errors', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.rejects(new Error('Database error'));

      await expect(tierClient.getAllEnrollment()).to.be.rejectedWith('Database error');
      expect(mockContext.log.error).to.have.been.calledWith('Error getting all enrollments: Database error');
    });

    it('should filter out enrollments not matching site ID', async () => {
      const mockEnrollment2 = {
        getId: () => 'enrollment-456',
        getSiteId: () => 'different-site-id',
        getEntitlementId: () => 'entitlement-123',
      };

      const mockEnrollment3 = {
        getId: () => 'enrollment-789',
        getSiteId: () => siteId,
        getEntitlementId: () => 'entitlement-123',
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([
        mockSiteEnrollment,
        mockEnrollment2,
        mockEnrollment3,
      ]);

      const result = await tierClient.getAllEnrollment();

      expect(result.enrollments).to.have.lengthOf(2);
      expect(result.enrollments).to.deep.equal([mockSiteEnrollment, mockEnrollment3]);
    });
  });

  describe('getFirstEnrollment', () => {
    beforeEach(() => {
      mockDataAccess.SiteEnrollment.allByEntitlementId = sandbox.stub();
    });

    it('should return entitlement, first enrollment, and site when all exist', async () => {
      const mockSiteObject = {
        getId: () => siteId,
        getName: () => 'Test Site',
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([mockSiteEnrollment]);
      mockDataAccess.Site.findById.resolves(mockSiteObject);

      const tierClientWithoutSite = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      const result = await tierClientWithoutSite.getFirstEnrollment();

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        enrollment: mockSiteEnrollment,
        site: mockSiteObject,
      });
      expect(mockDataAccess.Site.findById).to.have.been.calledWith(siteId);
    });

    it('should return first enrollment when multiple exist', async () => {
      const mockSiteObject = {
        getId: () => siteId,
        getName: () => 'Test Site',
      };

      const mockEnrollment2 = {
        getId: () => 'enrollment-456',
        getSiteId: () => 'other-site-id',
        getEntitlementId: () => 'entitlement-123',
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([
        mockSiteEnrollment,
        mockEnrollment2,
      ]);
      mockDataAccess.Site.findById.resolves(mockSiteObject);

      const tierClientWithoutSite = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      const result = await tierClientWithoutSite.getFirstEnrollment();

      expect(result.enrollment).to.equal(mockSiteEnrollment);
      expect(mockDataAccess.Site.findById).to.have.been.calledWith(siteId);
    });

    it('should return nulls when no entitlement exists', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(null);

      const result = await tierClient.getFirstEnrollment();

      expect(result).to.deep.equal({
        entitlement: null,
        enrollment: null,
        site: null,
      });
      expect(mockDataAccess.Site.findById).to.not.have.been.called;
    });

    it('should return nulls when no enrollments exist', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([]);

      const result = await tierClient.getFirstEnrollment();

      expect(result).to.deep.equal({
        entitlement: null,
        enrollment: null,
        site: null,
      });
      expect(mockDataAccess.Site.findById).to.not.have.been.called;
    });

    it('should return null site when site not found in database', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([mockSiteEnrollment]);
      mockDataAccess.Site.findById.resolves(null);

      const tierClientWithoutSite = new TierClient(
        mockContext,
        organizationInstance,
        null,
        productCode,
      );

      const result = await tierClientWithoutSite.getFirstEnrollment();

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        enrollment: mockSiteEnrollment,
        site: null,
      });
      expect(mockContext.log.warn).to.have.been.calledWith(
        `Site not found for enrollment ${mockSiteEnrollment.getId()} with site ID ${siteId}`,
      );
    });

    it('should handle database errors', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.rejects(new Error('Database error'));

      await expect(tierClient.getFirstEnrollment()).to.be.rejectedWith('Database error');
      expect(mockContext.log.error).to.have.been.calledWith('Error getting first enrollment: Database error');
    });

    it('should work with site-specific client', async () => {
      const mockSiteObject = {
        getId: () => siteId,
        getName: () => 'Test Site',
      };

      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([mockSiteEnrollment]);
      mockDataAccess.Site.findById.resolves(mockSiteObject);

      const result = await tierClient.getFirstEnrollment();

      expect(result).to.deep.equal({
        entitlement: mockEntitlement,
        enrollment: mockSiteEnrollment,
        site: mockSiteObject,
      });
    });

    it('should handle error when fetching site', async () => {
      mockDataAccess.Entitlement.findByOrganizationIdAndProductCode.resolves(mockEntitlement);
      mockDataAccess.SiteEnrollment.allByEntitlementId.resolves([mockSiteEnrollment]);
      mockDataAccess.Site.findById.rejects(new Error('Site fetch error'));

      await expect(tierClient.getFirstEnrollment()).to.be.rejectedWith('Site fetch error');
    });
  });
});
