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

import { configurationFunctions } from '../../../../src/service/configurations/index.js';

chai.use(chaiAsPromised);

const { expect } = chai;

const TEST_DA_CONFIG = {
  tableNameConfigurations: 'spacecat-services-configurations',
};

describe('Configuration Access Pattern Tests', () => {
  describe('Configuration Functions Export Tests', () => {
    const mockDynamoClient = {};
    const mockLog = {};

    const exportedFunctions = configurationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);

    it('exports getConfiguration function', () => {
      expect(exportedFunctions).to.have.property('getConfiguration');
      expect(exportedFunctions.getConfiguration).to.be.a('function');
    });

    it('exports getConfigurationByVersion function', () => {
      expect(exportedFunctions).to.have.property('getConfigurationByVersion');
      expect(exportedFunctions.getConfigurationByVersion).to.be.a('function');
    });
  });

  describe('Configuration Functions Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        getItem: sinon.stub().returns(Promise.resolve(null)),
      };
      mockLog = { log: sinon.stub() };

      exportedFunctions = configurationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('calls getConfiguration and returns null', async () => {
      const result = await exportedFunctions.getConfiguration();
      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getConfiguration and returns configuration', async () => {
      const mockConfigurationData = {
        version: 'v1',
        jobs: [
          {
            group: 'audits',
            type: 'lhs-mobile',
            interval: 'daily',
          }, {
            group: 'reports',
            type: '404-external-digest',
            interval: 'weekly',
          },
        ],
        queues: {
          audits: 'sqs://.../spacecat-services-audit-jobs',
          imports: 'sqs://.../spacecat-services-import-jobs',
          reports: 'sqs://.../spacecat-services-report-jobs',
        },
      };

      mockDynamoClient.query.onFirstCall().resolves([mockConfigurationData]);

      const result = await exportedFunctions.getConfiguration();

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(mockConfigurationData.version);
      expect(result.getQueues()).to.deep.equal(mockConfigurationData.queues);
      expect(result.getJobs()).to.deep.equal(mockConfigurationData.jobs);
      expect(mockDynamoClient.query.called).to.be.true;
    });
    it('calls getConfigurationByVersion and returns configuration', async () => {
      const mockConfigurationData = {
        version: 'v1',
        jobs: [
          {
            group: 'audits',
            type: 'lhs-mobile',
            interval: 'daily',
          }, {
            group: 'reports',
            type: '404-external-digest',
            interval: 'weekly',
          },
        ],
        queues: {
          audits: 'sqs://.../spacecat-services-audit-jobs',
          imports: 'sqs://.../spacecat-services-import-jobs',
          reports: 'sqs://.../spacecat-services-report-jobs',
        },
      };

      mockDynamoClient.getItem.onFirstCall().resolves(mockConfigurationData);

      const result = await exportedFunctions.getConfigurationByVersion('v1');

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(mockConfigurationData.version);
      expect(result.getQueues()).to.deep.equal(mockConfigurationData.queues);
      expect(result.getJobs()).to.deep.equal(mockConfigurationData.jobs);
      expect(mockDynamoClient.getItem.called).to.be.true;
    });
  });
});
