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
import sinonChai from 'sinon-chai';
import { importJobFunctions } from '../../../../src/service/import-job/index.js';

chai.use(sinonChai);
chai.use(chaiAsPromised);

const { expect } = chai;

const TEST_DA_CONFIG = {
  tableNameImportJobs: 'test-import-jobs',
  indexNameAllImportJobsByStatus: 'test-import-jobs-by-status',
  pkAllImportJobs: 'test-pk-import-jobs',
};

describe('Import Job Tests', () => {
  describe('Import Job Functions', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        getItem: sinon.stub().resolves([]),
        query: sinon.stub().resolves(null),
        putItem: sinon.stub().resolves(),
      };
      mockLog = {
        log: sinon.stub(),
      };
      exportedFunctions = importJobFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    describe('getImportJobByID', () => {
      it('should return an ImportJobDto when an item is found', async () => {
        const mockImportJob = {
          id: 'test-id',
          status: 'RUNNING',
          options: {},
          baseURL: 'https://www.test.com',
          apiKey: 'test-api-key',
          importQueueId: 'test-import-queue-id',
        };
        mockDynamoClient.getItem.resolves(mockImportJob);
        const result = await exportedFunctions.getImportJobByID('test-id');

        expect(result).to.be.not.null;
        expect(result.state.id).to.equal('test-id');
        expect(mockDynamoClient.getItem).to.have.been.calledOnce;
      });

      it('should return null if item is not found', async () => {
        mockDynamoClient.getItem.resolves(undefined);

        const result = await exportedFunctions.getImportJobByID('test-id');

        expect(result).to.be.null;
      });
    });

    describe('getImportJobsByStatus', () => {
      it('should return ImportJobDto[] if items are found', async () => {
        const mockImportJobs = [{
          id: 'test-id',
          status: 'RUNNING',
          options: {},
          baseURL: 'https://www.test.com',
          apiKey: 'test-api-key',
          importQueueId: 'test-import-queue-id',
        },
        {
          id: 'test-id-1',
          status: 'RUNNING',
          options: {},
          baseURL: 'https://www.test1.com',
          apiKey: 'test-api1-key',
          importQueueId: 'test-import-queue-id-1',
        }];
        mockDynamoClient.query.resolves(mockImportJobs);

        const result = await exportedFunctions.getImportJobsByStatus(mockDynamoClient, TEST_DA_CONFIG, mockLog, 'test-status');

        expect(result).to.be.an('array').and.to.have.lengthOf(2);
      });
    });

    describe('createNewImportJob', () => {
      it('should create a new ImportJob', async () => {
        const mockImportJobData = {
          id: 'test-id',
          status: 'RUNNING',
          options: {},
          baseURL: 'https://www.test.com',
          apiKey: 'test-api-key',
          importQueueId: 'test-import-queue-id',
        };
        const result = await exportedFunctions.createNewImportJob(mockImportJobData);

        expect(result).to.be.not.null;
        expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      });
    });
  });
});
