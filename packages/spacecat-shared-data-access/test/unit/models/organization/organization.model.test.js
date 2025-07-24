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

import Organization from '../../../../src/models/organization/organization.model.js';
import organizationFixtures from '../../../fixtures/organizations.fixture.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const sampleOrganization = organizationFixtures[0];

describe('OrganizationModel', () => {
  let instance;

  let mockElectroService;
  let mockRecord;

  beforeEach(() => {
    mockRecord = sampleOrganization;

    ({
      mockElectroService,
      model: instance,
    } = createElectroMocks(Organization, mockRecord));

    mockElectroService.entities.patch = stub().returns({ set: stub() });
  });

  describe('constructor', () => {
    it('initializes the Organization instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.record).to.deep.equal(mockRecord);
    });
  });

  describe('organizationId', () => {
    it('gets organizationId', () => {
      expect(instance.getId()).to.equal('4854e75e-894b-4a74-92bf-d674abad1423');
    });
  });

  describe('config', () => {
    it('gets config', () => {
      const config = instance.getConfig();
      delete config.imports;
      expect(config).to.deep.equal(sampleOrganization.config);
    });
  });

  describe('name', () => {
    it('gets name', () => {
      expect(instance.getName()).to.equal('0-1234Name');
    });

    it('sets name', () => {
      instance.setName('Some Name');
      expect(instance.record.name).to.equal('Some Name');
    });
  });

  describe('imsOrgId', () => {
    it('gets imsOrgId', () => {
      expect(instance.getImsOrgId()).to.equal('1234567890ABCDEF12345678@AdobeOrg');
    });

    it('sets imsOrgId', () => {
      instance.setImsOrgId('newImsOrgId');
      expect(instance.getImsOrgId()).to.equal('newImsOrgId');
    });
  });

  describe('fulfillableItems', () => {
    it('gets fulfillableItems', () => {
      expect(instance.getFulfillableItems()).to.deep.equal(undefined);
    });

    it('sets fulfillableItems', () => {
      instance.setFulfillableItems(['item3', 'item4']);
      expect(instance.getFulfillableItems()).to.deep.equal(['item3', 'item4']);
    });
  });

  describe('tenantId', () => {
    it('gets tenantId when present', () => {
      expect(instance.getTenantId()).to.equal('tenant-0');
    });

    it('gets undefined tenantId when not present', () => {
      // Create a new instance with no tenantId
      const orgWithoutTenantId = { ...sampleOrganization };
      delete orgWithoutTenantId.tenantId;

      const {
        model: instanceWithoutTenantId,
      } = createElectroMocks(Organization, orgWithoutTenantId);

      expect(instanceWithoutTenantId.getTenantId()).to.be.undefined;
    });

    it('sets tenantId to a string value', () => {
      instance.setTenantId('new-tenant-id');
      expect(instance.getTenantId()).to.equal('new-tenant-id');
      expect(instance.record.tenantId).to.equal('new-tenant-id');
    });

    it('sets tenantId to undefined', () => {
      instance.setTenantId(undefined);
      expect(instance.getTenantId()).to.be.undefined;
      expect(instance.record.tenantId).to.be.undefined;
    });

    it('overwrites existing tenantId', () => {
      // First set a tenantId
      instance.setTenantId('original-tenant');
      expect(instance.getTenantId()).to.equal('original-tenant');

      // Then overwrite it
      instance.setTenantId('updated-tenant');
      expect(instance.getTenantId()).to.equal('updated-tenant');
      expect(instance.record.tenantId).to.equal('updated-tenant');
    });

    it('returns the organization instance when setting tenantId', () => {
      const result = instance.setTenantId('test-tenant');
      expect(result).to.equal(instance);
    });
  });
});
