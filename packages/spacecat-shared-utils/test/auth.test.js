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
import { retrievePageAuthentication } from '../src/auth.js';

use(chaiAsPromised);

describe('auth', () => {
  describe('retrievePageAuthentication', () => {
    let mockSite;
    let mockSecretsClient;
    let mockXray;
    let context;

    beforeEach(() => {
      mockSite = {
        findById: sinon.stub(),
        getBaseURL: sinon.stub().returns('https://example.com'),
      };

      mockSecretsClient = {
        send: sinon.stub(),
      };

      mockXray = {
        captureAWSv3Client: sinon.stub().returns(mockSecretsClient),
      };

      context = {
        dataAccess: {
          Site: mockSite,
        },
        attributes: {
          services: {
            xray: mockXray,
            secretsClient: {},
          },
        },
        func: {
          version: 'test-version',
        },
      };
    });

    it('should retrieve authentication token successfully', async () => {
      const siteId = 'test-site-id';
      const authToken = 'test-token';
      const secretString = JSON.stringify({ PAGE_AUTH_TOKEN: authToken });

      mockSite.findById.resolves(mockSite);
      mockSecretsClient.send.resolves({ SecretString: secretString });

      const result = await retrievePageAuthentication(siteId, context);

      expect(result).to.equal(authToken);
      expect(mockSite.findById.calledWith(siteId)).to.be.true;
      expect(mockSecretsClient.send.calledOnce).to.be.true;
    });

    it('should throw error when site is not found', async () => {
      const siteId = 'non-existent-site';
      mockSite.findById.resolves(null);

      await expect(retrievePageAuthentication(siteId, context))
        .to.be.rejectedWith(`Site with ID ${siteId} not found, cannot resolve customer secrets for authentication`);
    });

    it('should throw error when secret string is not found', async () => {
      const siteId = 'test-site-id';
      mockSite.findById.resolves(mockSite);
      mockSecretsClient.send.resolves({});

      await expect(retrievePageAuthentication(siteId, context))
        .to.be.rejectedWith(/No secret string found for/);
    });

    it('should throw error when PAGE_AUTH_TOKEN is missing', async () => {
      const siteId = 'test-site-id';
      const secretString = JSON.stringify({});
      mockSite.findById.resolves(mockSite);
      mockSecretsClient.send.resolves({ SecretString: secretString });

      await expect(retrievePageAuthentication(siteId, context))
        .to.be.rejectedWith(/Missing 'PAGE_AUTH_TOKEN' in secrets for/);
    });
  });
});
