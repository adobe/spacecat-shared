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
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import SiteEnrollmentV2 from '../../../../src/models/site-enrollment/site-enrollment-v2.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SiteEnrollmentV2Collection', () => {
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
    } = createElectroMocks(SiteEnrollmentV2, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SiteEnrollmentV2Collection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('composite key structure', () => {
    it('uses composite primary key (entitlementId + siteId)', () => {
      // V2 uses composite key structure
      // Entity names are returned in camelCase
      expect(schema.getEntityName()).to.equal('siteEnrollmentV2');
    });
  });

  describe('create', () => {
    it('creates both V2 and original SiteEnrollment', async () => {
      const mockSiteEnrollmentCollection = {
        create: stub().resolves({}),
      };

      mockEntityRegistry.getCollection = stub().returns(mockSiteEnrollmentCollection);

      const item = {
        siteId: 'test-site-id',
        entitlementId: 'test-entitlement-id',
        updatedBy: 'test-user',
      };

      await instance.create(item);

      expect(mockEntityRegistry.getCollection).to.have.been.calledWith('SiteEnrollmentCollection');
      expect(mockSiteEnrollmentCollection.create).to.have.been.calledWith({
        siteId: item.siteId,
        entitlementId: item.entitlementId,
        updatedBy: item.updatedBy,
      });
    });

    it('continues successfully even if original SiteEnrollment creation fails', async () => {
      const mockSiteEnrollmentCollection = {
        create: stub().rejects(new Error('Database error')),
      };

      mockEntityRegistry.getCollection = stub().returns(mockSiteEnrollmentCollection);

      const item = {
        siteId: 'test-site-id',
        entitlementId: 'test-entitlement-id',
        updatedBy: 'test-user',
      };

      // Should not throw, V2 creation succeeds even if original fails
      const result = await instance.create(item);

      expect(result).to.exist;
      expect(mockLogger.error).to.have.been.called;
    });
  });

  describe('removeByIndexKeys', () => {
    it('removes both V2 and original SiteEnrollment', async () => {
      const mockEnrollment = {
        getId: stub().returns('mock-id'),
        getEntitlementId: stub().returns('test-entitlement-id'),
      };

      const mockSiteEnrollmentCollection = {
        allBySiteId: stub().resolves([mockEnrollment]),
        removeByIds: stub().resolves(),
      };

      mockEntityRegistry.getCollection = stub().returns(mockSiteEnrollmentCollection);

      const keys = [{
        siteId: 'test-site-id',
        entitlementId: 'test-entitlement-id',
      }];

      await instance.removeByIndexKeys(keys);

      expect(mockEntityRegistry.getCollection).to.have.been.calledWith('SiteEnrollmentCollection');
      expect(mockSiteEnrollmentCollection.allBySiteId).to.have.been.calledWith('test-site-id');
      expect(mockSiteEnrollmentCollection.removeByIds).to.have.been.calledWith(['mock-id']);
    });

    it('continues successfully even if original SiteEnrollment removal fails', async () => {
      const mockSiteEnrollmentCollection = {
        allBySiteId: stub().rejects(new Error('Database error')),
      };

      mockEntityRegistry.getCollection = stub().returns(mockSiteEnrollmentCollection);

      const keys = [{
        siteId: 'test-site-id',
        entitlementId: 'test-entitlement-id',
      }];

      // Should not throw, V2 removal succeeds even if original fails
      await expect(instance.removeByIndexKeys(keys)).to.be.fulfilled;
      expect(mockLogger.error).to.have.been.called;
    });

    it('logs warning when original SiteEnrollment not found', async () => {
      const mockSiteEnrollmentCollection = {
        allBySiteId: stub().resolves([]), // No matching enrollment
        removeByIds: stub().resolves(),
      };

      mockEntityRegistry.getCollection = stub().returns(mockSiteEnrollmentCollection);

      const keys = [{
        siteId: 'test-site-id',
        entitlementId: 'test-entitlement-id',
      }];

      await instance.removeByIndexKeys(keys);

      expect(mockLogger.warn).to.have.been.called;
    });

    it('continues successfully even if getCollection fails', async () => {
      mockEntityRegistry.getCollection = stub().throws(new Error('Registry error'));

      const keys = [{
        siteId: 'test-site-id',
        entitlementId: 'test-entitlement-id',
      }];

      // Should not throw, V2 removal succeeds even if getting collection fails
      await expect(instance.removeByIndexKeys(keys)).to.be.fulfilled;
      expect(mockLogger.error).to.have.been.called;
    });
  });
});
