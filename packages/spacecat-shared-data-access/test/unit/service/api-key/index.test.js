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
import sinonChai from 'sinon-chai';
import { apiKeyFunctions } from '../../../../src/service/api-key/index.js';

use(sinonChai);
use(chaiAsPromised);

const TEST_DA_CONFIG = {
  tableNameApiKeys: 'test-api-keys',
};

describe('Api Key Tests', () => {
  describe('Api Key Functions', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        getItem: sinon.stub().resolves(),
        query: sinon.stub().resolves(null),
        putItem: sinon.stub().resolves(),
      };
      mockLog = {
        log: console,
      };
      exportedFunctions = apiKeyFunctions(
        mockDynamoClient,
        TEST_DA_CONFIG,
        mockLog,
      );
    });

    const apiKey = {
      id: 'test-id',
      hashedApiKey: 'test-key',
      name: 'test-name',
      imsUserId: 'test-ims-user-id',
      imsOrgId: 'test-ims-org-id',
      expiresAt: '2024-05-29T14:26:00.000Z',
      revokedAt: '2024-05-29T14:26:00.000Z',
      scopes: [{
        name: 'imports.write',
        domains: ['https://www.test.com'],
      }],
    };

    describe('getApiKeyByKey', () => {
      it('should return an ApiKeyDto when an item is found', async () => {
        const mockApiKey = {
          hashedApiKey: 'test-key',
          name: 'test-name',
          imsUserId: 'test-ims-user-id',
          imsOrgId: 'test-ims-org-id',
          expiresAt: '2024-05-29T14:26:00.000Z',
          revokedAt: '2024-05-29T14:26:00.000Z',
          scopes: [{
            name: 'imports.write',
            domains: ['https://www.test.com'],
          }],
        };
        mockDynamoClient.query.resolves([mockApiKey]);

        const apiKeyRetrieved = await exportedFunctions.getApiKeyByHashedApiKey('test-key');

        expect(apiKeyRetrieved).to.be.not.null;
        expect(mockDynamoClient.query).to.have.been.calledOnce;
      });
    });

    describe('createNewApiKey', () => {
      it('should create a new ApiKey', async () => {
        mockDynamoClient.putItem.resolves(apiKey);

        const result = await exportedFunctions.createNewApiKey(apiKey);

        expect(result).to.be.not.null;
        expect(mockDynamoClient.putItem).to.have.been.calledOnce;
      });
    });

    describe('updateApiKey', () => {
      it('should update an existing ApiKey', async () => {
        mockDynamoClient.getItem.resolves(apiKey);

        const apiKeyToUpdate = await exportedFunctions.getApiKeyById('test-id');
        apiKeyToUpdate.updateDeletedAt('2024-05-29T14:26:00.000Z');
        const result = await exportedFunctions.updateApiKey(apiKeyToUpdate);
        expect(result).to.be.not.null;
        expect(result.getDeletedAt()).to.equal('2024-05-29T14:26:00.000Z');
      });

      it('should throw an error when updating a non-existing ApiKey', async () => {
        const newApiKey = await exportedFunctions.createNewApiKey(apiKey);
        mockDynamoClient.getItem.resolves(null);
        const result = exportedFunctions.updateApiKey(newApiKey);
        expect(result).to.be.rejectedWith('API Key with id test-id not found');
      });
    });

    describe('getApiKeysByImsUserIdAndImsOrgId', () => {
      it('should return an array of ApiKeys', async () => {
        const mockApiKeys = [apiKey];
        mockDynamoClient.query.resolves(mockApiKeys);

        const result = await exportedFunctions.getApiKeysByImsUserIdAndImsOrgId('test-ims-user-id', 'test-ims-org-id');
        expect(result).to.be.an('array').and.to.have.lengthOf(1);
      });
    });
  });
});
