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
import sinon from 'sinon';
import AWSXray from 'aws-xray-sdk';
import { Site } from '@adobe/spacecat-shared-data-access';
import { ImsPromiseClient } from '@adobe/spacecat-shared-ims-client';
import { getAccessToken, retrievePageAuthentication } from '../src/auth.js';

use(chaiAsPromised);

describe('auth', () => {
  describe('retrievePageAuthentication', () => {
    let mockSite;
    let mockSecretsClient;
    let context;

    beforeEach(() => {
      mockSite = {
        getBaseURL: sinon.stub().returns('https://example.com'),
        getDeliveryType: sinon.stub().returns('aem_edge'),
      };

      mockSecretsClient = {
        send: sinon.stub(),
      };

      sinon.stub(AWSXray, 'captureAWSv3Client').returns(mockSecretsClient);

      context = {
        env: {},
        func: {
          version: 'test-version',
        },
      };
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should retrieve authentication token successfully', async () => {
      const authToken = 'test-token';
      const secretString = JSON.stringify({ PAGE_AUTH_TOKEN: authToken });

      mockSecretsClient.send.resolves({ SecretString: secretString });

      const result = await retrievePageAuthentication(mockSite, context);

      expect(result).to.equal(authToken);
      expect(mockSite.getBaseURL.calledOnce).to.be.true;
      expect(mockSecretsClient.send.calledOnce).to.be.true;
      expect(AWSXray.captureAWSv3Client.calledOnce).to.be.true;
    });

    it('should throw error when secret string is not found', async () => {
      mockSecretsClient.send.resolves({});

      await expect(retrievePageAuthentication(mockSite, context))
        .to.be.rejectedWith(/No secret string found for/);
    });

    it('should throw error when PAGE_AUTH_TOKEN is missing', async () => {
      const secretString = JSON.stringify({});
      mockSecretsClient.send.resolves({ SecretString: secretString });

      await expect(retrievePageAuthentication(mockSite, context))
        .to.be.rejectedWith(/Missing 'PAGE_AUTH_TOKEN' in secrets for/);
    });
  });

  describe('getAccessToken', () => {
    let mockSite;
    let context;
    let mockImsPromiseClient;

    beforeEach(() => {
      mockSite = {
        getBaseURL: sinon.stub().returns('https://example.com'),
        getDeliveryType: sinon.stub().returns(Site.DELIVERY_TYPES.AEM_CS),
      };

      context = {
        env: {},
        log: {
          info: sinon.spy(),
          error: sinon.spy(),
        },
      };

      mockImsPromiseClient = {
        exchangeToken: sinon.stub(),
      };
      sinon.stub(ImsPromiseClient, 'createFrom').returns(mockImsPromiseClient);
    });

    afterEach(() => {
      sinon.restore();
    });

    it('calls getAccessToken for AEM CS sites with a promise token', async () => {
      const promiseToken = 'test-promise-token';
      const authOptions = { promiseToken };
      const expectedTokenResponse = { access_token: 'exchanged-token' };
      mockImsPromiseClient.exchangeToken.resolves(expectedTokenResponse);

      const result = await retrievePageAuthentication(mockSite, context, authOptions);

      expect(ImsPromiseClient.createFrom)
        .to.have.been.calledWith(context, ImsPromiseClient.CLIENT_TYPE.CONSUMER);
      expect(mockImsPromiseClient.exchangeToken).to.have.been.calledWith(promiseToken, false);
      expect(result).to.equal(expectedTokenResponse.access_token);
    });

    it('successfully exchanges a promise token without encryption', async () => {
      const promiseToken = 'test-promise-token';
      const expectedTokenResponse = { access_token: 'exchanged-token' };
      mockImsPromiseClient.exchangeToken.resolves(expectedTokenResponse);

      const result = await getAccessToken(context, promiseToken);

      expect(ImsPromiseClient.createFrom)
        .to.have.been.calledWith(context, ImsPromiseClient.CLIENT_TYPE.CONSUMER);
      expect(mockImsPromiseClient.exchangeToken).to.have.been.calledWith(promiseToken, false);
      expect(result).to.equal(expectedTokenResponse.access_token);
    });

    it('successfully exchanges a promise token with encryption when secrets are present', async () => {
      context.env.AUTOFIX_CRYPT_SECRET = 'secret';
      context.env.AUTOFIX_CRYPT_SALT = 'salt';
      const promiseToken = 'test-promise-token';
      const expectedTokenResponse = { access_token: 'encrypted-exchanged-token' };
      mockImsPromiseClient.exchangeToken.resolves(expectedTokenResponse);

      await getAccessToken(context, promiseToken);

      expect(mockImsPromiseClient.exchangeToken).to.have.been.calledWith(promiseToken, true);
    });

    it('propagates errors from exchangeToken', async () => {
      const promiseToken = 'test-promise-token';
      const testError = new Error('IMS Exchange Failed');
      mockImsPromiseClient.exchangeToken.rejects(testError);

      await expect(getAccessToken(context, promiseToken)).to.be.rejectedWith(testError);
    });
  });
});
