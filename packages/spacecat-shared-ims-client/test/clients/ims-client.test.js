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

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';

import ImsClient from '../../src/clients/ims-client.js';

import {
  GROUP_1_ID,
  GROUP_2_ID,
  IMS_FETCH_GROUP_1_MEMBERS_RESPONSE,
  IMS_FETCH_GROUP_2_MEMBERS_RESPONSE,
  IMS_FETCH_ORG_DETAILS_RESPONSE,
  IMS_FETCH_PC_BY_ORG_RESPONSE,
} from './ims-sample-responses.js';

chai.use(chaiAsPromised);

const { expect } = chai;

describe('ImsClient', () => {
  const DUMMY_HOST = 'ims.example.com';
  let mockLog;
  let sandbox;
  let mockContext;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockLog = sinon.mock(console);
    mockContext = {
      log: mockLog.object,
      env: {
        IMS_HOST: DUMMY_HOST,
        IMS_CLIENT_ID: 'clientIdExample',
        IMS_CLIENT_CODE: 'clientCodeExample',
        IMS_CLIENT_SECRET: 'clientSecretExample',
      },
    };
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  function mockImsTokenResponse() {
    return nock(`https://${DUMMY_HOST}`)
      .post('/ims/token/v4')
      .reply(200, {
        access_token: 'ZHVtbXktYWNjZXNzLXRva2Vu',
      });
  }

  describe('constructor and createFrom', () => {
    it('throws errors for missing configuration using createFrom', () => {
      expect(() => ImsClient.createFrom({
        env: {},
        log: console,
      })).to.throw('Context param must include properties: imsHost, clientId, clientCode, and clientSecret.');
      expect(() => ImsClient.createFrom({
        env: {
          IMS_HOST: 'ims.example.com',
        },
        log: console,
      })).to.throw('Context param must include properties: imsHost, clientId, clientCode, and clientSecret.');
      expect(() => ImsClient.createFrom({
        env: {
          IMS_HOST: 'ims.example.com',
          IMS_CLIENT_ID: 'clientIdExample',
        },
        log: console,
      })).to.throw('Context param must include properties: imsHost, clientId, clientCode, and clientSecret.');
      expect(() => ImsClient.createFrom({
        env: {
          IMS_HOST: 'ims.example.com',
          IMS_CLIENT_ID: 'clientIdExample',
          IMS_CLIENT_CODE: 'clientCodeExample',
        },
        log: console,
      })).to.throw('Context param must include properties: imsHost, clientId, clientCode, and clientSecret.');
    });
  });

  describe('getImsOrganizationDetails', () => {
    const testOrgId = '1234567890ABCDEF12345678@AdobeOrg';
    let client;

    beforeEach(() => {
      client = ImsClient.createFrom(mockContext);
    });

    it('should throw an error for invalid imsOrgId', async () => {
      await expect(client.getImsOrganizationDetails('')).to.be.rejectedWith('imsOrgId param is required.');
    });

    it('should respond with a list of users for the given organization', async () => {
      // Mock all the IMS API interactions
      mockImsTokenResponse()
        // Mock the request for the organization's product context
        .post('/ims/fetch_pc_by_org/v1')
        .reply(200, IMS_FETCH_PC_BY_ORG_RESPONSE)
        // Mock the request for the organization's details
        .get(`/ims/organizations/${testOrgId}/v2`)
        .query(true)
        .reply(200, IMS_FETCH_ORG_DETAILS_RESPONSE)
        // Mock the request for group members in 123456789
        .get(`/ims/organizations/${testOrgId}/groups/${GROUP_1_ID}/members`)
        .query(true)
        .reply(200, IMS_FETCH_GROUP_1_MEMBERS_RESPONSE)
        // Mock the request for group members in 222223333
        .get(`/ims/organizations/${testOrgId}/groups/${GROUP_2_ID}/members`)
        .query(true)
        .reply(200, IMS_FETCH_GROUP_2_MEMBERS_RESPONSE);

      const orgDetails = await client.getImsOrganizationDetails(testOrgId);

      expect(orgDetails).to.be.an('object');
      expect(orgDetails.orgName).to.equal('Example Org Human Readable Name');
      expect(orgDetails.tenantId).to.equal('example-tenant-id');
      expect(orgDetails.orgType).to.equal('Enterprise');
      expect(orgDetails.countryCode).to.equal('CA');

      expect(orgDetails.admins).to.be.an('array');
      expect(orgDetails.admins).to.have.length(2);
      expect(orgDetails.admins[0].email).to.equal('test-user-1@example.com');
      expect(orgDetails.admins[1].email).to.equal('test-user-2@example.com');
    });
  });
});
