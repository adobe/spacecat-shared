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
import { importUrlFunctions } from '../../../../src/service/import-url/index.js';

chai.use(chaiAsPromised);

const { expect } = chai;

const TEST_DA_CONFIG = {
  tableNameImportUrls: 'test-import-urls',
};

describe('Import Url Tests', () => {
  describe('Import Job Functions', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        getItem: sinon.stub().returns(Promise.resolve([])),
        query: sinon.stub().returns(Promise.resolve(null)),
        putItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = {
        log: sinon.stub(),
      };
      exportedFunctions = importUrlFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    describe('getImportUrlByID', () => {
      it('should return an ImportUrlDto when an item is found', async () => {
        const mockImportUrl = {
          id: 'test-id',
          status: 'RUNNING',
          options: {},
          baseURL: 'https://www.test.com',
          jobId: 'test-job-id',
        };
        mockDynamoClient.getItem.resolves(mockImportUrl);
        const result = await exportedFunctions.getImportUrlById('test-id');
        expect(result.state.id).to.equal('test-id');
      });

      it('should return null when an item is not found', async () => {
        mockDynamoClient.getItem.resolves(null);
        const result = await exportedFunctions.getImportUrlById('test-id');
        expect(result).to.be.null;
      });
    });

    describe('createImportUrl', () => {
      it('should create an ImportUrlDto with the correct status', async () => {
        const mockImportUrl = {
          id: 'test-id',
          status: 'RUNNING',
          options: {},
          baseURL: 'https://www.test.com',
        };
        await exportedFunctions.createNewImportUrl(mockImportUrl);
        expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      });
    });
  });
});
