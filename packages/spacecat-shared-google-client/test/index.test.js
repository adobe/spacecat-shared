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
import sinon from 'sinon';
import crypto from 'crypto';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { GoogleClient } from '../src/index.js';

chai.use(chaiAsPromised);
const { expect } = chai;
const sandbox = sinon.createSandbox();

describe('GoogleClient', () => {
  let googleClient;

  // AES-256 key, base64 encoded
  const key = crypto.randomBytes(32).toString('base64');
  // AES block size in CBC mode, base64 encoded
  const iv = crypto.randomBytes(16).toString('base64');

  let siteConfig;
  let site;
  let authClient;

  beforeEach(() => {
    googleClient = new GoogleClient({
      siteId: 'testSiteId',
      dataAccess: {},
      GOOGLE_ENCRYPTION_KEY: key,
      GOOGLE_ENCRYPTION_IV: iv,
    });

    authClient = new OAuth2Client();

    site = {
      getConfig: () => siteConfig,
      getBaseURL: () => 'https://www.example.com',
      updateConfig: sandbox.stub().resolves(),
    };

    googleClient.dataAccess.getSiteByID = sandbox.stub().resolves(site);
    googleClient.dataAccess.updateSite = sandbox.stub().resolves();

    siteConfig = {
      auth: {
        google: {
          client_id: 'testClientId',
          client_secret: googleClient.encryptSecret('testClientSecret'),
          redirect_uri: 'testRedirectUri',
          access_token: googleClient.encryptSecret('testToken'),
          refresh_token: googleClient.encryptSecret('testRefreshToken'),
          expiration: Date.now() + 10000,
        },
      },
    };
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('createFrom', () => {
    it('should create a new GoogleClient instance with the provided context and siteId', () => {
      const context = {
        dataAccess: {},
        env: {
          GOOGLE_ENCRYPTION_KEY: key,
          GOOGLE_ENCRYPTION_IV: iv,
        },
      };
      const siteId = 'testSiteId';

      const client = GoogleClient.createFrom(context, siteId);

      expect(client).to.be.instanceOf(GoogleClient);
      expect(client.siteId).to.equal(siteId);
      expect(client.dataAccess).to.equal(context.dataAccess);
      expect(client.GOOGLE_ENCRYPTION_KEY).to.equal(context.env.GOOGLE_ENCRYPTION_KEY);
      expect(client.GOOGLE_ENCRYPTION_IV).to.equal(context.env.GOOGLE_ENCRYPTION_IV);
    });
  });

  describe('decryptSecret', () => {
    it('should return the decrypted secret when given an encrypted secret', () => {
      const secret = 'testSecret';
      const encryptedSecret = googleClient.encryptSecret(secret);
      const decryptedSecret = googleClient.decryptSecret(encryptedSecret);

      expect(decryptedSecret).to.equal(secret);
    });
  });

  describe('encryptSecret', () => {
    it('should return the encrypted secret when given a secret', () => {
      const secret = 'testSecret';
      const encryptedSecret = googleClient.encryptSecret(secret);
      const decryptedSecret = googleClient.decryptSecret(encryptedSecret);

      expect(decryptedSecret).to.equal(secret);
    });
  });

  describe('generateAuthClient', () => {
    it('should return an instance of OAuth2Client with the correct parameters', async () => {
      const googleAuthClient = await googleClient.generateAuthClient();

      expect(googleAuthClient).to.be.instanceOf(OAuth2Client);
      // eslint-disable-next-line no-underscore-dangle
      expect(googleAuthClient._clientId).to.equal(siteConfig.auth.google.client_id);
      // eslint-disable-next-line no-underscore-dangle
      expect(googleAuthClient._clientSecret).to.equal('testClientSecret');
      expect(googleAuthClient.redirectUri).to.equal(siteConfig.auth.google.redirect_uri);
    });
  });

  describe('getOrganicSearchData', () => {
    it('should return the organic search data for the given date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      const testData = {
        rows: [
          {
            keys: [
              'testKey1',
              'testKey2',
            ],
            clicks: 100,
            impressions: 1000,
            ctr: 5.5,
            position: 1.5,
          },
        ],
        responseAggregationType: 'byPage',
      };

      const webmastersStub = sandbox.stub().resolves({
        data: testData,
      });

      sandbox.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: webmastersStub,
        },
      });

      const result = await googleClient.getOrganicSearchData(startDate, endDate);
      const response = await result.text();

      expect(result.status).to.equal(200);
      expect(JSON.parse(response)).to.deep.equal(testData);
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should return a bad request response if there is no token or refreshToken', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      siteConfig.auth.google.access_token = null;
      siteConfig.auth.google.refresh_token = null;

      const result = await googleClient.getOrganicSearchData(startDate, endDate);
      const response = await result.json();

      expect(result.status).to.equal(400);
      expect(response.message).to.equal('Google token or refresh token not found');
    });
  });

  it('should refresh the token if it has expired and then proceed with the request', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');
    siteConfig.auth.google.expiration = Date.now() - 10000; // token has expired

    const testData = {
      rows: [
        {
          keys: [
            'testKey1',
            'testKey2',
          ],
          clicks: 100,
          impressions: 1000,
          ctr: 5.5,
          position: 1.5,
        },
      ],
      responseAggregationType: 'byPage',
    };

    const webmastersStub = sandbox.stub().resolves({
      data: testData,
    });

    const refreshAccessTokenStub = sandbox.stub(authClient, 'refreshAccessToken').resolves({
      tokens: {
        access_token: 'newAccessToken',
        expiry_date: Date.now() + 10000,
      },
    });

    sandbox.stub(google, 'webmasters').returns({
      searchanalytics: {
        query: webmastersStub,
      },
    });

    const generateAuthClientStub = sandbox.stub(googleClient, 'generateAuthClient').resolves(authClient);

    const result = await googleClient.getOrganicSearchData(startDate, endDate);
    const response = await result.json();

    expect(result.status).to.equal(200);
    expect(response).to.deep.equal(testData);
    expect(webmastersStub.calledOnce).to.be.true;
    expect(refreshAccessTokenStub.calledOnce).to.be.true;
    expect(generateAuthClientStub.calledOnce).to.be.true;
  });

  it('should return an internal server error response if an error occurs', async () => {
    const startDate = new Date('2024-01-01');
    const endDate = new Date('2024-12-31');

    const webmastersStub = sandbox.stub().rejects(new Error('Test error'));
    sandbox.stub(google, 'webmasters').returns({
      searchanalytics: {
        query: webmastersStub,
      },
    });

    const generateAuthClientStub = sandbox.stub(googleClient, 'generateAuthClient').resolves(authClient);

    const result = await googleClient.getOrganicSearchData(startDate, endDate);
    const response = await result.json();

    expect(result.status).to.equal(500);
    expect(response.message).to.equal('Test error');
    expect(webmastersStub.calledOnce).to.be.true;
    expect(generateAuthClientStub.calledOnce).to.be.true;
  });
});
