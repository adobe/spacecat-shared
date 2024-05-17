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

import { expect } from 'chai';
import sinon from 'sinon';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import GoogleClient from '../src/index.js';

describe('GoogleClient', () => {
  const context = {
    env: {
      GOOGLE_CLIENT_ID: 'testClientId',
      GOOGLE_CLIENT_SECRET: 'testClientSecret',
      GOOGLE_REDIRECT_URI: 'testRedirectUri',
    },
    func: {
      version: 'v1',
    },
    log: console,
  };

  let config;

  const baseURL = 'https://www.example.com';
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-05-14');

  let authClientStub;

  beforeEach(() => {
    config = {
      access_token: 'testAccessToken',
      refresh_token: 'testRefreshToken',
      token_type: 'Bearer',
      site_url: baseURL,
      expiration_date: Date.now() + 3600 * 1000,
    };
    authClientStub = sinon.stub(OAuth2Client.prototype);
    authClientStub.setCredentials.returns();
    authClientStub.refreshAccessToken.resolves({
      credentials: {
        test_token: 'testToken',
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createFrom', () => {
    it('should create a new GoogleClient instance with the provided context', async () => {
      sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
        SecretString: JSON.stringify(config),
      });
      const googleClient = await GoogleClient.createFrom(context, baseURL);

      expect(googleClient).to.be.instanceOf(GoogleClient);
      expect(googleClient.authClient).to.be.instanceOf(OAuth2Client);
      expect(googleClient.log).to.equal(context.log);
    });
  });

  describe('getOrganicSearchData', () => {
    it('should return organic search data for the provided baseURL, startDate, and endDate', async () => {
      sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
        SecretString: JSON.stringify(config),
      });
      const testResult = { data: 'testData' };
      const webmastersStub = sinon.stub().resolves(testResult);
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);

      const result = await googleClient.getOrganicSearchData(startDate, endDate, ['page']);
      expect(result).to.eql(testResult);
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should handle errors when the Google API call fails', async () => {
      sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
        SecretString: JSON.stringify(config),
      });
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: sinon.stub().rejects(new Error('Google API call failed')),
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);

      try {
        await googleClient.getOrganicSearchData(startDate, endDate);
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Google API call failed');
      }
    });

    it('should return 500 when access token is missing', async () => {
      delete config.access_token;

      sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
        SecretString: JSON.stringify(config),
      });
      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Missing access token in secret');
      }
    });

    it('should return 500 when refresh token is missing', async () => {
      delete config.refresh_token;

      sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
        SecretString: JSON.stringify(config),
      });
      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Missing refresh token in secret');
      }
    });

    it('should refresh access token when it is expired', async () => {
      config.expiry_date = Date.now() - 1000;
      sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
        SecretString: JSON.stringify(config),
      });
      const testResult = { data: 'testData' };
      const webmastersStub = sinon.stub().resolves(testResult);
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: webmastersStub,
        },
      });
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.getOrganicSearchData(startDate, endDate);
      expect(result).to.eql(testResult);
    });
  });

  describe('listSites', () => {
    const sites = {
      data: {
        siteEntry: [
          { siteUrl: 'https://www.example1.com' },
          { siteUrl: 'https://www.example2.com' },
        ],
      },
    };

    it('should return a list of sites', async () => {
      sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
        SecretString: JSON.stringify(config),
      });
      const webmastersStub = sinon.stub().resolves(sites);
      sinon.stub(google, 'webmasters').returns({
        sites: {
          list: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);

      const result = await googleClient.listSites();
      expect(result).to.eql(sites);
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should handle errors when the Google API call fails', async () => {
      const failMessage = 'Google API call failed';
      sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
        SecretString: JSON.stringify(config),
      });
      sinon.stub(google, 'webmasters').returns({
        sites: {
          list: sinon.stub().rejects(new Error(failMessage)),
        },
      });
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.listSites();
      } catch (error) {
        expect(error.message).to.equal(`Error retrieving sites from Google API: ${failMessage}`);
      }
    });
  });
});
