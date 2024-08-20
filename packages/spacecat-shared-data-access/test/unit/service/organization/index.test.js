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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';

import { organizationFunctions } from '../../../../src/service/organizations/index.js';
import { createOrganization } from '../../../../src/models/organization.js';

use(chaiAsPromised);

const TEST_DA_CONFIG = {
  tableNameOrganizations: 'spacecat-services-organizations',
  indexNameAllOrganizations: 'spacecat-services-all-organizations',
  pkAllOrganizations: 'ALL_ORGANIZATIONS',
};

describe('Organization Access Pattern Tests', () => {
  describe('Organization Functions Export Tests', () => {
    const mockDynamoClient = {};
    const mockLog = {};

    const exportedFunctions = organizationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);

    it('exports getOrganizations function', () => {
      expect(exportedFunctions).to.have.property('getOrganizations');
      expect(exportedFunctions.getOrganizations).to.be.a('function');
    });

    it('exports getOrganizationByID function', () => {
      expect(exportedFunctions).to.have.property('getOrganizationByID');
      expect(exportedFunctions.getOrganizationByID).to.be.a('function');
    });
  });

  describe('Organization Functions Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    const mockOrgData = {
      id: 'organization1',
      name: 'Organization1',
      imsOrgId: '1234567890ABCDEF12345678@AdobeOrg',
    };

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        getItem: sinon.stub().returns(Promise.resolve(null)),
      };
      mockLog = { log: sinon.stub() };

      exportedFunctions = organizationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('calls getOrganizations and returns an array', async () => {
      const result = await exportedFunctions.getOrganizations();
      expect(result).to.be.an('array');
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getOrganizationByID and returns null', async () => {
      const result = await exportedFunctions.getOrganizationByID();
      expect(result).to.be.null;
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getOrganizationByImsOrgID and returns null', async () => {
      const result = await exportedFunctions.getOrganizationByImsOrgID();
      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getOrganizationByID and returns site', async () => {
      mockDynamoClient.getItem.onFirstCall().resolves(mockOrgData);

      const result = await exportedFunctions.getOrganizationByID();

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal(mockOrgData.id);
      expect(result.getName()).to.equal(mockOrgData.name);
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getOrganizationByImsOrgID and returns site', async () => {
      mockDynamoClient.query.onFirstCall().resolves([mockOrgData]);

      const result = await exportedFunctions.getOrganizationByImsOrgID();

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal(mockOrgData.id);
      expect(result.getName()).to.equal(mockOrgData.name);
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('should return null when an organization is not found by IMS org ID', async () => {
      mockDynamoClient.query.onFirstCall().resolves([]);

      const result = await exportedFunctions.getOrganizationByImsOrgID('notfoundorg123@AdobeOrg');

      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });

    describe('addOrganization Tests', () => {
      beforeEach(() => {
        mockDynamoClient = {
          query: sinon.stub().returns(Promise.resolve([])),
          putItem: sinon.stub().returns(Promise.resolve()),
        };
        mockLog = { log: sinon.stub() };
        exportedFunctions = organizationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
      });

      it('adds a new organization successfully', async () => {
        const orgData = { name: 'Org1' };
        const result = await exportedFunctions.addOrganization(orgData);
        expect(mockDynamoClient.putItem.calledOnce).to.be.true;
        expect(result.getName()).to.equal(orgData.name);
        expect(result.getId()).to.be.a('string');
      });
    });
  });

  describe('updateOrganization Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        getItem: sinon.stub().returns(Promise.resolve()),
        putItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = { log: sinon.stub() };
      exportedFunctions = organizationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('updates an existing organization successfully', async () => {
      const orgData = { name: 'Org1' };
      mockDynamoClient.getItem.resolves(Promise.resolve(orgData));

      const org = await exportedFunctions.getOrganizationByID('id1');
      // site.updateBaseURL('https://newsite.com');
      org.updateImsOrgId('newOrg123');

      const result = await exportedFunctions.updateOrganization(org);
      expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      expect(result.getName()).to.equal(org.getName());
      expect(result.getImsOrgId()).to.equal(org.getImsOrgId());
    });

    it('throws an error if organization does not exist', async () => {
      const org = createOrganization({ name: 'Org1' });
      await expect(exportedFunctions.updateOrganization(org)).to.be.rejectedWith('Organization not found');
    });
  });

  describe('removeOrganization Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        removeItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = {
        log: sinon.stub(),
        error: sinon.stub(),
      };
      exportedFunctions = organizationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('removes the organization', async () => {
      await exportedFunctions.removeOrganization('some-id');

      expect(mockDynamoClient.removeItem.calledOnce).to.be.true;
    });

    it('logs an error and reject if the organization removal fails', async () => {
      const errorMessage = 'Failed to delete org';
      mockDynamoClient.removeItem.rejects(new Error(errorMessage));

      await expect(exportedFunctions.removeOrganization('some-id')).to.be.rejectedWith(errorMessage);
      expect(mockLog.error.calledOnce).to.be.true;
    });
  });
});
