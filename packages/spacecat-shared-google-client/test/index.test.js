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
import GoogleClient from '../src/index.js';

describe('GoogleClient', () => {
  const context = {
    env: {
      GOOGLE_CLIENT_ID: 'testClientId',
      GOOGLE_CLIENT_SECRET: 'testClientSecret',
      GOOGLE_REDIRECT_URI: 'testRedirectUri',
      ACCESS_TOKEN: 'testAccessToken',
      REFRESH_TOKEN: 'testRefreshToken',
      EXPIRATION: Date.now() - 1000,
    },
    log: console,
  };

  const baseURL = 'https://www.example.com';
  const startDate = new Date('2024-01-01');
  const endDate = new Date('2024-12-31');

  let authClientStub;

  beforeEach(() => {
    authClientStub = sinon.stub(OAuth2Client.prototype);
    authClientStub.setCredentials.returns();
    authClientStub.refreshAccessToken.resolves({
      tokens: {
        test_token: 'testToken',
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('createFrom', () => {
    it('should create a new GoogleClient instance with the provided context', async () => {
      const googleClient = await GoogleClient.createFrom(context);

      expect(googleClient).to.be.instanceOf(GoogleClient);
      expect(googleClient.authClient).to.be.instanceOf(OAuth2Client);
      expect(googleClient.log).to.equal(context.log);
    });
  });

  describe('getOrganicSearchData', () => {
    it('should return organic search data for the provided baseURL, startDate, and endDate', async () => {
      const webmastersStub = sinon.stub().resolves({ data: 'testData' });
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: webmastersStub,
        },
      });

      const googleClient = await GoogleClient.createFrom(context);

      const result = await googleClient.getOrganicSearchData(baseURL, startDate, endDate);
      const response = await result.json();
      expect(result.status).to.equal(200);
      expect(response).to.equal('testData');
      expect(webmastersStub.calledOnce).to.be.true;
    });

    it('should handle errors when the Google API call fails', async () => {
      sinon.stub(google, 'webmasters').returns({
        searchanalytics: {
          query: sinon.stub().rejects(new Error('Google API call failed')),
        },
      });

      const googleClient = await GoogleClient.createFrom(context);

      const result = await googleClient.getOrganicSearchData(baseURL, startDate, endDate);
      const response = await result.json();
      expect(result.status).to.equal(500);
      expect(response.message).to.equal('Google API call failed');
    });
  });
});
