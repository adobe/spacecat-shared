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

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import nock from 'nock';
import sinon from 'sinon';

import ImsEdgeClient from '../../src/clients/ims-edge-client.js';

import {
  GROUP_1_ID,
  GROUP_2_ID,
  IMS_FETCH_GROUP_1_MEMBERS_RESPONSE,
  IMS_FETCH_GROUP_2_MEMBERS_RESPONSE,
  IMS_FETCH_ORG_DETAILS_NO_GROUPS_RESPONSE,
  IMS_FETCH_ORG_DETAILS_RESPONSE,
} from './ims-sample-responses.js';

use(chaiAsPromised);

describe('ImsEdgeClient', () => {
  const DUMMY_HOST = 'ims.example.com';
  const SERVICE_CONTEXT = {
    env: {
      IMS_HOST: DUMMY_HOST,
      IMS_EDGE_CLIENT_ID: 'edge-client-id',
      IMS_EDGE_CLIENT_SECRET: 'edge-secret',
      IMS_EDGE_SCOPE: 'openid,AdobeID,additional_info.projectedProductContext',
    },
    log: console,
  };
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    nock.cleanAll();
    sandbox.restore();
  });

  function mockServiceTokenResponse() {
    return nock(`https://${DUMMY_HOST}`)
      .post('/ims/token/v3')
      .reply(200, { access_token: 'service-token', token_type: 'bearer', expires_in: 3600 });
  }

  describe('createFrom', () => {
    it('throws when IMS_EDGE_CLIENT_ID is missing', () => {
      expect(() => ImsEdgeClient.createFrom({
        env: { IMS_HOST: DUMMY_HOST, IMS_EDGE_CLIENT_SECRET: 'secret' },
        log: console,
      })).to.throw('Context env must include IMS_HOST, IMS_EDGE_CLIENT_ID, and IMS_EDGE_CLIENT_SECRET.');
    });

    it('throws when IMS_EDGE_CLIENT_SECRET is missing', () => {
      expect(() => ImsEdgeClient.createFrom({
        env: { IMS_HOST: DUMMY_HOST, IMS_EDGE_CLIENT_ID: 'edge-client-id' },
        log: console,
      })).to.throw('Context env must include IMS_HOST, IMS_EDGE_CLIENT_ID, and IMS_EDGE_CLIENT_SECRET.');
    });

    it('throws when IMS_HOST is missing', () => {
      expect(() => ImsEdgeClient.createFrom({
        env: { IMS_EDGE_CLIENT_ID: 'edge-client-id', IMS_EDGE_CLIENT_SECRET: 'secret' },
        log: console,
      })).to.throw('Context env must include IMS_HOST, IMS_EDGE_CLIENT_ID, and IMS_EDGE_CLIENT_SECRET.');
    });

    it('creates client with default scope when IMS_EDGE_SCOPE is not set', () => {
      const client = ImsEdgeClient.createFrom({
        env: {
          IMS_HOST: DUMMY_HOST,
          IMS_EDGE_CLIENT_ID: 'edge-client-id',
          IMS_EDGE_CLIENT_SECRET: 'edge-secret',
        },
        log: console,
      });
      expect(client).to.be.instanceOf(ImsEdgeClient);
      expect(client.config.scope).to.equal('openid,AdobeID,additional_info.projectedProductContext');
    });

    it('creates client with explicit scope when IMS_EDGE_SCOPE is set', () => {
      const client = ImsEdgeClient.createFrom({
        env: {
          IMS_HOST: DUMMY_HOST,
          IMS_EDGE_CLIENT_ID: 'edge-client-id',
          IMS_EDGE_CLIENT_SECRET: 'edge-secret',
          IMS_EDGE_SCOPE: 'openid,custom_scope',
        },
        log: console,
      });
      expect(client.config.scope).to.equal('openid,custom_scope');
    });
  });

  describe('getServiceAccessToken', () => {
    let client;

    beforeEach(() => {
      client = ImsEdgeClient.createFrom(SERVICE_CONTEXT);
    });

    it('fetches and caches a service token', async () => {
      nock(`https://${DUMMY_HOST}`)
        .post('/ims/token/v3')
        .reply(200, { access_token: 'cached-token', token_type: 'bearer', expires_in: 3600 });

      const t1 = await client.getServiceAccessToken();
      const t2 = await client.getServiceAccessToken();
      expect(t1.access_token).to.equal('cached-token');
      expect(t2.access_token).to.equal('cached-token');
      // Only one HTTP call made (second call uses cache)
      expect(nock.isDone()).to.be.true;
    });

    it('throws on non-200 response', async () => {
      client.retryBaseDelayMs = 0;
      nock(`https://${DUMMY_HOST}`)
        .post('/ims/token/v3')
        .times(3)
        .reply(500, { error: 'server error' });

      await expect(client.getServiceAccessToken())
        .to.be.rejectedWith('IMS getServiceAccessToken request failed with status: 500');
    });
  });

  describe('getServicePrincipalToken', () => {
    const TEST_ORG_ID = '1234567890ABCDEF12345678@AdobeOrg';
    let client;

    beforeEach(() => {
      client = ImsEdgeClient.createFrom(SERVICE_CONTEXT);
    });

    it('throws when imsOrgId is missing', async () => {
      await expect(client.getServicePrincipalToken('')).to.be.rejectedWith('imsOrgId param is required.');
      await expect(client.getServicePrincipalToken(null)).to.be.rejectedWith('imsOrgId param is required.');
    });

    it('returns SP access token for a valid org', async () => {
      nock(`https://${DUMMY_HOST}`)
        .post('/ims/token/v3')
        .reply(200, {
          access_token: 'sp-access-token',
          token_type: 'bearer',
          expires_in: 86399,
        });

      const result = await client.getServicePrincipalToken(TEST_ORG_ID);
      expect(result.access_token).to.equal('sp-access-token');
      expect(result.token_type).to.equal('bearer');
      expect(result.expires_in).to.equal(86399);
    });

    it('throws on non-200 response', async () => {
      nock(`https://${DUMMY_HOST}`)
        .post('/ims/token/v3')
        .reply(401, { error: 'unauthorized' });

      await expect(client.getServicePrincipalToken(TEST_ORG_ID))
        .to.be.rejectedWith('IMS getServicePrincipalToken request failed with status: 401');
    });

    it('does not cache the token between calls', async () => {
      nock(`https://${DUMMY_HOST}`)
        .post('/ims/token/v3')
        .reply(200, { access_token: 'token-1', token_type: 'bearer', expires_in: 3600 })
        .post('/ims/token/v3')
        .reply(200, { access_token: 'token-2', token_type: 'bearer', expires_in: 3600 });

      const result1 = await client.getServicePrincipalToken(TEST_ORG_ID);
      const result2 = await client.getServicePrincipalToken(TEST_ORG_ID);
      expect(result1.access_token).to.equal('token-1');
      expect(result2.access_token).to.equal('token-2');
    });
  });

  describe('getOrgGroups', () => {
    const TEST_ORG_ID = '1234567890ABCDEF12345678@AdobeOrg';
    let client;

    beforeEach(() => {
      client = ImsEdgeClient.createFrom(SERVICE_CONTEXT);
      client.retryBaseDelayMs = 0;
    });

    it('throws when imsOrgId is missing', async () => {
      await expect(client.getOrgGroups('')).to.be.rejectedWith('imsOrgId param is required.');
    });

    it('returns groups from org details', async () => {
      mockServiceTokenResponse()
        .get(`/ims/organizations/${TEST_ORG_ID}/v2`)
        .query({ client_id: SERVICE_CONTEXT.env.IMS_EDGE_CLIENT_ID })
        .reply(200, IMS_FETCH_ORG_DETAILS_RESPONSE);

      const groups = await client.getOrgGroups(TEST_ORG_ID);
      expect(groups).to.deep.equal(IMS_FETCH_ORG_DETAILS_RESPONSE.groups);
    });

    it('returns empty array when org has no groups', async () => {
      mockServiceTokenResponse()
        .get(`/ims/organizations/${TEST_ORG_ID}/v2`)
        .query({ client_id: SERVICE_CONTEXT.env.IMS_EDGE_CLIENT_ID })
        .reply(200, IMS_FETCH_ORG_DETAILS_NO_GROUPS_RESPONSE);

      const groups = await client.getOrgGroups(TEST_ORG_ID);
      expect(groups).to.deep.equal([]);
    });

    it('throws when the org details endpoint fails', async () => {
      mockServiceTokenResponse()
        .get(`/ims/organizations/${TEST_ORG_ID}/v2`)
        .query({ client_id: SERVICE_CONTEXT.env.IMS_EDGE_CLIENT_ID })
        .times(3)
        .reply(500, { error: 'server error' });

      await expect(client.getOrgGroups(TEST_ORG_ID))
        .to.be.rejectedWith('IMS getImsOrgDetails request failed with status: 500');
    });
  });

  describe('isUserInImsGroup', () => {
    const TEST_ORG_ID = '1234567890ABCDEF12345678@AdobeOrg';
    const TEST_GROUP_ID = String(GROUP_1_ID);
    let client;

    beforeEach(() => {
      client = ImsEdgeClient.createFrom(SERVICE_CONTEXT);
    });

    it('throws when required params are missing', async () => {
      await expect(client.isUserInImsGroup('', TEST_GROUP_ID, 'user@example.com'))
        .to.be.rejectedWith('imsOrgId, groupId, and userEmail params are required.');
      await expect(client.isUserInImsGroup(TEST_ORG_ID, '', 'user@example.com'))
        .to.be.rejectedWith('imsOrgId, groupId, and userEmail params are required.');
      await expect(client.isUserInImsGroup(TEST_ORG_ID, TEST_GROUP_ID, ''))
        .to.be.rejectedWith('imsOrgId, groupId, and userEmail params are required.');
    });

    it('returns true when user email is in the group', async () => {
      mockServiceTokenResponse()
        .get(`/ims/organizations/${TEST_ORG_ID}/groups/${TEST_GROUP_ID}/members`)
        .query({ client_id: SERVICE_CONTEXT.env.IMS_EDGE_CLIENT_ID })
        .reply(200, IMS_FETCH_GROUP_1_MEMBERS_RESPONSE);

      const result = await client.isUserInImsGroup(TEST_ORG_ID, TEST_GROUP_ID, 'test-user-1@example.com');
      expect(result).to.be.true;
    });

    it('is case-insensitive for email matching', async () => {
      mockServiceTokenResponse()
        .get(`/ims/organizations/${TEST_ORG_ID}/groups/${TEST_GROUP_ID}/members`)
        .query({ client_id: SERVICE_CONTEXT.env.IMS_EDGE_CLIENT_ID })
        .reply(200, IMS_FETCH_GROUP_1_MEMBERS_RESPONSE);

      const result = await client.isUserInImsGroup(TEST_ORG_ID, TEST_GROUP_ID, 'TEST-USER-1@EXAMPLE.COM');
      expect(result).to.be.true;
    });

    it('matches by username when email field is absent', async () => {
      mockServiceTokenResponse()
        .get(`/ims/organizations/${TEST_ORG_ID}/groups/${String(GROUP_2_ID)}/members`)
        .query({ client_id: SERVICE_CONTEXT.env.IMS_EDGE_CLIENT_ID })
        .reply(200, IMS_FETCH_GROUP_2_MEMBERS_RESPONSE);

      const result = await client.isUserInImsGroup(TEST_ORG_ID, String(GROUP_2_ID), 'test-user-1@example.com');
      expect(result).to.be.true;
    });

    it('returns false when user email is not in the group', async () => {
      mockServiceTokenResponse()
        .get(`/ims/organizations/${TEST_ORG_ID}/groups/${TEST_GROUP_ID}/members`)
        .query({ client_id: SERVICE_CONTEXT.env.IMS_EDGE_CLIENT_ID })
        .reply(200, IMS_FETCH_GROUP_1_MEMBERS_RESPONSE);

      const result = await client.isUserInImsGroup(TEST_ORG_ID, TEST_GROUP_ID, 'other-user@example.com');
      expect(result).to.be.false;
    });

    it('throws when the group members endpoint fails', async () => {
      client.retryBaseDelayMs = 0;
      mockServiceTokenResponse()
        .get(`/ims/organizations/${TEST_ORG_ID}/groups/${TEST_GROUP_ID}/members`)
        .query({ client_id: SERVICE_CONTEXT.env.IMS_EDGE_CLIENT_ID })
        .times(3)
        .reply(500, { error: 'server error' });

      await expect(client.isUserInImsGroup(TEST_ORG_ID, TEST_GROUP_ID, 'user@example.com'))
        .to.be.rejectedWith('IMS getUsersByImsGroupId request failed with status: 500');
    });
  });
});
