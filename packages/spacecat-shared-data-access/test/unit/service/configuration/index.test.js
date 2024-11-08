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

import { configurationFunctions } from '../../../../src/service/configurations/index.js';

use(chaiAsPromised);

const TEST_DA_CONFIG = {
  tableNameConfigurations: 'spacecat-services-configurations',
};

describe('Configuration Access Pattern Tests', () => {
  describe('Configuration Functions Export Tests', () => {
    const mockDynamoClient = {};

    const exportedFunctions = configurationFunctions(mockDynamoClient, TEST_DA_CONFIG);

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
    const mockConfig = {
      version: 1,
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
      slackRoles: {
        import: [
          'test-id-1',
          'test-id-2',
        ],
      },
    };

    let mockDynamoClient;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().resolves([]),
        getItem: sinon.stub().resolves(null),
        putItem: sinon.stub().resolves(null),
      };

      exportedFunctions = configurationFunctions(mockDynamoClient, TEST_DA_CONFIG);
    });

    it('calls getConfigurations and returns configurations', async () => {
      const mockConfigurationData = mockConfig;

      mockDynamoClient.query.onFirstCall().resolves([mockConfigurationData]);

      const result = await exportedFunctions.getConfigurations();

      expect(result).to.be.an('array').with.lengthOf(1);

      const config = result[0];
      expect(config.getVersion()).to.equal(mockConfigurationData.version);
      expect(config.getQueues()).to.deep.equal(mockConfigurationData.queues);
      expect(config.getJobs()).to.deep.equal(mockConfigurationData.jobs);
      expect(config.getSlackRoles()).to.deep.equal(mockConfigurationData.slackRoles);
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getConfiguration and returns null', async () => {
      const result = await exportedFunctions.getConfiguration();
      expect(result).to.be.null;
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getConfiguration and returns configuration', async () => {
      const mockConfigurationData = mockConfig;

      mockDynamoClient.query.onFirstCall().resolves([mockConfigurationData]);

      const result = await exportedFunctions.getConfiguration();

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(mockConfigurationData.version);
      expect(result.getQueues()).to.deep.equal(mockConfigurationData.queues);
      expect(result.getJobs()).to.deep.equal(mockConfigurationData.jobs);
      expect(result.getSlackRoles()).to.deep.equal(mockConfigurationData.slackRoles);
      expect(mockDynamoClient.query.called).to.be.true;
    });

    it('calls getConfigurationByVersion and returns configuration', async () => {
      const mockConfigurationData = {
        version: 1,
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
        slackRoles: {
          import: [
            'test-id-1',
            'test-id-2',
          ],
        },
      };

      mockDynamoClient.getItem.onFirstCall().resolves(mockConfigurationData);

      const result = await exportedFunctions.getConfigurationByVersion(1);

      expect(result).to.be.an('object');
      expect(result.getVersion()).to.equal(mockConfigurationData.version);
      expect(result.getQueues()).to.deep.equal(mockConfigurationData.queues);
      expect(result.getJobs()).to.deep.equal(mockConfigurationData.jobs);
      expect(result.getSlackRoles()).to.deep.equal(mockConfigurationData.slackRoles);
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getConfigurationByVersion and returns null', async () => {
      const result = await exportedFunctions.getConfigurationByVersion('v4');
      expect(result).to.be.null;
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls updateConfiguration and returns configuration', async () => {
      const configurationData = {
        version: 1,
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
        slackRoles: {
          import: [
            'test-id-1',
            'test-id-2',
          ],
        },
      };

      mockDynamoClient.query.resolves(
        [configurationData],
      );

      const result = await exportedFunctions.updateConfiguration(configurationData);

      expect(result).to.be.an('object');

      expect(result.getVersion()).to.equal(2);
      expect(result.getQueues()).to.deep.equal(configurationData.queues);
      expect(result.getJobs()).to.deep.equal(configurationData.jobs);
      expect(result.getSlackRoles()).to.deep.equal(configurationData.slackRoles);
      expect(mockDynamoClient.putItem.called).to.be.true;
    });

    it('calls updateConfiguration and returns configuration with no base version', async () => {
      const configurationData = {
        version: '0',
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
        slackRoles: {
          import: [
            'test-id-1',
            'test-id-2',
          ],
        },
      };

      const result = await exportedFunctions.updateConfiguration(configurationData);

      expect(result).to.be.an('object');

      expect(result.getVersion()).to.equal(1);
      expect(result.getQueues()).to.deep.equal(configurationData.queues);
      expect(result.getJobs()).to.deep.equal(configurationData.jobs);
      expect(result.getSlackRoles()).to.deep.equal(configurationData.slackRoles);
      expect(mockDynamoClient.putItem.called).to.be.true;
    });
  });
});
