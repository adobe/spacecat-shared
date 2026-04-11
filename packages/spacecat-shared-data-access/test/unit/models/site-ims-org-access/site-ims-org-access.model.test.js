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
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import SiteImsOrgAccess from '../../../../src/models/site-ims-org-access/site-ims-org-access.model.js';
import siteImsOrgAccessFixtures from '../../../fixtures/site-ims-org-accesses.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleAccess = siteImsOrgAccessFixtures[0];

describe('SiteImsOrgAccessModel', () => {
  let instance;
  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleAccess;
    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(SiteImsOrgAccess, mockRecord));
    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the SiteImsOrgAccess instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('ENTITY_NAME', () => {
    it('has the correct entity name', () => {
      expect(SiteImsOrgAccess.ENTITY_NAME).to.equal('SiteImsOrgAccess');
    });
  });

  describe('DELEGATION_ROLES', () => {
    it('has the correct roles', () => {
      expect(SiteImsOrgAccess.DELEGATION_ROLES).to.deep.equal({
        COLLABORATOR: 'collaborator',
        AGENCY: 'agency',
        VIEWER: 'viewer',
      });
    });
  });

  describe('siteId', () => {
    it('gets siteId', () => {
      expect(instance.getSiteId()).to.equal('78fec9c7-2141-4600-b7b1-ea5c78752b91');
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(instance.getOrganizationId()).to.equal('5d42bdf8-b65d-4de8-b849-a4f28ebc93cd');
    });
  });

  describe('targetOrganizationId', () => {
    it('gets targetOrganizationId', () => {
      expect(instance.getTargetOrganizationId()).to.equal('757ceb98-05c8-4e07-bb23-bc722115b2b0');
    });
  });

  describe('productCode', () => {
    it('gets productCode', () => {
      expect(instance.getProductCode()).to.equal('LLMO');
    });
  });

  describe('role', () => {
    it('gets role', () => {
      expect(instance.getRole()).to.equal('agency');
    });
  });

  describe('grantedBy', () => {
    it('gets grantedBy', () => {
      expect(instance.getGrantedBy()).to.equal('ims:user123');
    });
  });

  describe('expiresAt', () => {
    it('gets expiresAt', () => {
      expect(instance.getExpiresAt()).to.equal('2026-12-31T23:59:59.000Z');
    });
  });
});
