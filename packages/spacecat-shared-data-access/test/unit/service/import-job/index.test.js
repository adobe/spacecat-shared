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
import { importJobFunctions } from '../../../../src/service/import-job/index.js';
import { createImportJob } from '../../../../src/models/importer/import-job.js';

use(sinonChai);
use(chaiAsPromised);

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
        getItem: sinon.stub().resolves(),
        query: sinon.stub().resolves(null),
        putItem: sinon.stub().resolves(),
      };
      mockLog = {
        log: console,
      };
      exportedFunctions = importJobFunctions(
        mockDynamoClient,
        TEST_DA_CONFIG,
        mockLog,
      );
    });

    const mockImportJob = {
      id: 'test-id',
      status: 'RUNNING',
      options: {},
      baseURL: 'https://www.test.com',
      hashedApiKey: '4c806362b613f7496abf284146efd31da90e4b16169fe001841ca17290f427c4',
      importQueueId: 'test-import-queue-id',
      initiatedBy: {
        apiKeyName: 'test-user',
        imsUserId: 'test-ims-user-id',
        imsOrgId: 'test-ims-org-id',
        userAgent: 'test-user-agent',
      },
      hasCustomImportJs: false,
      hasCustomHeaders: false,
    };

    describe('getImportJobByID', () => {
      it('should return null if item is not found', async () => {
        mockDynamoClient.getItem.resolves(null);
        const result = await exportedFunctions.getImportJobByID('test-id');
        expect(result).to.equal(null);
      });
    });

    describe('getImportJobsByDateRange', () => {
      it(
        'Verify that getImportJobsByDateRange perform no additional changes to the result size',
        async () => {
          const mockImportJobs = [
            { ...mockImportJob, id: 'test-1' },
            { ...mockImportJob, id: 'test-2' },
          ];
          mockDynamoClient.query.resolves(mockImportJobs);

          const result = await exportedFunctions.getImportJobsByDateRange(
            mockDynamoClient,
            TEST_DA_CONFIG,
            mockLog,
            '2024-05-27T14:26:00.000Z',
            '2024-06-02T14:26:00.000Z',
          );

          // expect that 2 results were in the db, and that the results were not modified
          expect(result).to.be.an('array').and.to.have.lengthOf(2);

          // verify that the mocked properties are present in the result
          function hasPropertiesOf(mockJob, importJob) {
            return Object.keys(mockJob).every((key) => mockJob[key] === importJob.state[key]);
          }

          expect(hasPropertiesOf(mockImportJobs[0], result[0])).to.be.true;
          expect(hasPropertiesOf(mockImportJobs[1], result[1])).to.be.true;
        },
      );
    });

    describe('getImportJobsByStatus', () => {
      it('Verify that getImportJobsByStatus perform no additional changes to the result size', async () => {
        const mockImportJobs = [
          { ...mockImportJob, id: 'test-1' },
          { ...mockImportJob, id: 'test-2' },
        ];

        mockDynamoClient.query.resolves(mockImportJobs);

        const result = await exportedFunctions.getImportJobsByStatus(
          mockDynamoClient,
          TEST_DA_CONFIG,
          mockLog,
          'dummy-status',
        );

        // verify that 2 results were in the db, and that the results were not modified
        expect(result).to.be.an('array').and.to.have.lengthOf(2);
      });
    });

    describe('createNewImportJob', () => {
      it('should create a new ImportJob', async () => {
        const result = await exportedFunctions.createNewImportJob(mockImportJob);
        expect(result.state.initiatedBy.apiKeyName).to.equal('test-user');
        expect(result.state.baseURL).to.equal('https://www.test.com');
      });
    });

    describe('updateImportJob', () => {
      it('should update an existing ImportJob', async () => {
        mockDynamoClient.getItem.resolves(mockImportJob);
        const importJob = await exportedFunctions.getImportJobByID('test-id');
        importJob.updateStatus('COMPLETE');
        const result = await exportedFunctions.updateImportJob(importJob);
        expect(result.getStatus()).to.equal('COMPLETE');
      });

      it('should throw an error if the ImportJob does not exist', async () => {
        const importJob = createImportJob(mockImportJob);
        const result = exportedFunctions.updateImportJob(importJob);
        expect(result).to.be.rejectedWith('Import Job with id:test-id does not exist');
      });
    });
  });
});
