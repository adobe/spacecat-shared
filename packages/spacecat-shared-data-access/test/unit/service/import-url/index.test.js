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
import { importUrlFunctions } from '../../../../src/service/import-url/index.js';
import { createImportUrl } from '../../../../src/models/importer/import-url.js';

use(sinonChai);
use(chaiAsPromised);

const TEST_DA_CONFIG = {
  tableNameImportUrls: 'test-import-urls',
};

describe('Import Url Tests', () => {
  describe('Import Url Functions', () => {
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
        log: sinon.stub(),
      };
      exportedFunctions = importUrlFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    describe('getImportUrlByID', () => {
      it('should return an ImportUrlDto when an item is found', async () => {
        const mockImportUrl = {
          id: 'test-id',
          status: 'RUNNING',
          url: 'https://www.test.com',
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
          url: 'https://www.test.com',
        };
        await exportedFunctions.createNewImportUrl(mockImportUrl);
        expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      });
    });

    describe('updateImportUrl', () => {
      it('should update an existing importUrl with the correct status', async () => {
        const mockImportUrl = {
          id: 'test-id',
          status: 'RUNNING',
          url: 'https://www.test.com',
        };
        mockDynamoClient.getItem.resolves(mockImportUrl);

        const importUrl = await exportedFunctions.getImportUrlById('test-id');
        importUrl.setStatus('COMPLETE');
        const result = await exportedFunctions.updateImportUrl(importUrl);

        expect(result).to.be.not.null;
        expect(mockDynamoClient.putItem).to.have.been.calledOnce;
        expect(result.getStatus()).to.equal('COMPLETE');
      });

      it('should throw an error when the importUrl does not exist', async () => {
        const mockImportUrl = {
          id: 'test-id',
          status: 'RUNNING',
          url: 'https://www.test.com',
        };

        const importUrl = createImportUrl(mockImportUrl);
        const result = exportedFunctions.updateImportUrl(importUrl);
        await expect(result).to.be.rejectedWith('Import Url with ID:test-id does not exist');
      });
    });

    describe('getImportUrlsByJobIdAndStatus', () => {
      it('should return an array of ImportUrlDto when items are found', async () => {
        const mockImportUrl = {
          id: 'test-id',
          status: 'RUNNING',
          url: 'https://www.test.com',
          jobId: 'test-job-id',
        };
        mockDynamoClient.query.resolves([mockImportUrl]);
        const result = await exportedFunctions.getImportUrlsByJobIdAndStatus('test-job-id', 'RUNNING');
        expect(result.length).to.equal(1);
        expect(result[0].getUrl()).to.equal('https://www.test.com');
      });
    });
  });
});
