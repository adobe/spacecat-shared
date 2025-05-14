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
import { retrievePageAuthentication } from '../src/auth.js';

use(chaiAsPromised);

describe('auth', () => {
  describe('retrievePageAuthentication', () => {
    let mockSite;
    let mockSecretsClient;
    let context;

    beforeEach(() => {
      mockSite = {
        getBaseURL: sinon.stub().returns('https://example.com'),
      };

      mockSecretsClient = {
        send: sinon.stub(),
      };

      sinon.stub(AWSXray, 'captureAWSv3Client').returns(mockSecretsClient);

      context = {
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
});
