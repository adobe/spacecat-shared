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
import nock from 'nock';
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
    log: {
      info: sinon.stub(),
      error: sinon.stub(),
    },
  };

  let defaultConfig;

  const baseURL = 'https://example.com/';
  const auditURL = 'www.example.com';
  const startDateString = '2024-01-01';
  const startDate = new Date(startDateString);
  const endDateString = '2024-01-31';
  const endDate = new Date(endDateString);

  let authClientStub;

  const stubSecretManager = (config) => {
    sinon.stub(SecretsManagerClient.prototype, 'send').resolves({
      SecretString: JSON.stringify(config),
    });
  };

  beforeEach(() => {
    defaultConfig = {
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
      stubSecretManager(defaultConfig);

      const googleClient = await GoogleClient.createFrom(context, baseURL);

      expect(googleClient).to.be.instanceOf(GoogleClient);
      expect(googleClient.authClient).to.be.instanceOf(OAuth2Client);
      expect(googleClient.log).to.equal(context.log);
    });

    it('should throw an error if the google client cannot be created', async () => {
      sinon.stub(SecretsManagerClient.prototype, 'send').rejects(new Error('Secrets Manager error'));
      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Secrets Manager error');
      }
    });

    it('should throw an error if the base URL is invalid', async () => {
      try {
        await GoogleClient.createFrom(context, 'not a valid url');
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Invalid base URL');
      }
    });

    it('should throw an error if the base URL in secrets is invalid', async () => {
      stubSecretManager({ ...defaultConfig, site_url: 'not a valid url' });

      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Invalid site URL in secret');
      }
    });
  });

  describe('getOrganicSearchData', () => {
    beforeEach(() => {
      nock(baseURL)
        .get('/')
        .reply(301, {}, { Location: 'https://www.example.com' });
    });
    it('should return organic search data for the provided baseURL, startDate, and endDate', async () => {
      stubSecretManager(defaultConfig);
      const testResult = { data: 'testData' };
      const webmastersStub = sinon.stub().resolves(testResult);
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const expectedRequest = {
        siteUrl: baseURL,
        requestBody: {
          startDate: startDateString,
          endDate: endDateString,
          dimensions: ['page'],
          startRow: 0,
          rowLimit: 1000,
          dimensionFilterGroups: [
            {
              filters: [
                {
                  dimension: 'page',
                  operator: 'contains',
                  expression: auditURL,
                },
              ],
            },
          ],
        },
      };
      const result = await googleClient.getOrganicSearchData(startDate, endDate, ['page']);
      expect(context.log.info.calledWith(`Retrieving organic search data: ${JSON.stringify(expectedRequest)}`)).to.be.true;
      expect(result).to.eql(testResult);
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should handle errors when the Google API call fails', async () => {
      stubSecretManager(defaultConfig);
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
      delete defaultConfig.access_token;
      stubSecretManager(defaultConfig);

      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Missing access token in secret');
      }
    });

    it('should return 500 when refresh token is missing', async () => {
      delete defaultConfig.refresh_token;
      stubSecretManager(defaultConfig);

      try {
        await GoogleClient.createFrom(context, baseURL);
      } catch (error) {
        expect(error.message).to.equal('Error creating GoogleClient: Missing refresh token in secret');
      }
    });

    it('should refresh access token when it is expired', async () => {
      defaultConfig.expiry_date = Date.now() - 1000;
      stubSecretManager(defaultConfig);

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

    it('should throw an error if the date format is invalid', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData('2024-01-01', '2024-05-14');
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Invalid date format');
      }
    });

    it('should throw an error if the dimensions format is invalid', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, 'page');
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Invalid dimensions format');
      }
    });

    it('should throw an error if the row limit format is invalid', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, ['page'], '1000');
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Invalid row limit or start row format');
      }
    });

    it('should throw an error if the row limit is greater than 1000', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, ['page'], 1001);
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Row limit must be between 1 and 1000');
      }
    });

    it('should throw an error if the start row is less than 0', async () => {
      stubSecretManager(defaultConfig);
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      try {
        await googleClient.getOrganicSearchData(startDate, endDate, ['page'], 1000, -1);
      } catch (error) {
        expect(error.message).to.equal('Error retrieving organic search data from Google API: Start row must be greater than or equal to 0');
      }
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
      stubSecretManager(defaultConfig);
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
      stubSecretManager(defaultConfig);
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

    it('should refresh access token when it is expired', async () => {
      defaultConfig.expiry_date = Date.now() - 2000;
      stubSecretManager(defaultConfig);

      const testResult = { data: 'testData' };
      const webmastersStub = sinon.stub().resolves(testResult);
      sinon.stub(google, 'webmasters').returns({
        sites: {
          list: webmastersStub,
        },
      });
      const googleClient = await GoogleClient.createFrom(context, baseURL);
      const result = await googleClient.listSites();
      expect(result).to.eql(testResult);
    });
  });
});
