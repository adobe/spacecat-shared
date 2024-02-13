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
import { createConfiguration } from '../../../../src/models/configuration.js';

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

    it('exports getConfigurationByID function', () => {
      expect(exportedFunctions).to.have.property('getConfigurationByID');
      expect(exportedFunctions.getConfigurationByID).to.be.a('function');
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

    it('calls getConfigurationByID and returns null', async () => {
      const result = await exportedFunctions.getConfigurationByID();
      expect(result).to.be.null;
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    it('calls getConfigurationByID and returns config', async () => {
      const mockConfigurationData = {
        id: 'configuration1',
        configMap: {},
      };

      mockDynamoClient.getItem.onFirstCall().resolves(mockConfigurationData);

      const result = await exportedFunctions.getConfigurationByID();

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal(mockConfigurationData.id);
      expect(result.getConfigMap()).to.deep.equal(mockConfigurationData.configMap);
      expect(mockDynamoClient.getItem.called).to.be.true;
    });

    describe('addConfiguration Tests', () => {
      beforeEach(() => {
        mockDynamoClient = {
          query: sinon.stub().returns(Promise.resolve([])),
          putItem: sinon.stub().returns(Promise.resolve()),
        };
        mockLog = { log: sinon.stub() };
        exportedFunctions = configurationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
      });

      it('adds a new configuration successfully', async () => {
        const configurationData = {
          id: 'jobs',
          configMap: {
            daily: [
              { group: 'audits', type: 'lhs-mobile' },
              { group: 'audits', type: '404' },
              { group: 'imports', type: 'rum-ingest' },
            ],
            weekly: [
              { group: 'reports', type: '404-external-digest' },
              { group: 'audits', type: 'apex' },
            ],
          },
        };
        const result = await exportedFunctions.addConfiguration(configurationData);
        expect(mockDynamoClient.putItem.calledOnce).to.be.true;
        expect(result.getId()).to.equal(configurationData.id);
      });
    });
  });

  describe('updateConfiguration Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        getItem: sinon.stub().returns(Promise.resolve()),
        putItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = { log: sinon.stub() };
      exportedFunctions = configurationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('updates an existing configuration successfully', async () => {
      const configurationData = { id: 'id1', configMap: {} };
      mockDynamoClient.getItem.resolves(Promise.resolve(configurationData));

      const configuration = await exportedFunctions.getConfigurationByID('id1');
      configuration.updateConfigMap({ daily: [] });

      const result = await exportedFunctions.updateConfiguration(configuration);
      expect(mockDynamoClient.putItem.calledOnce).to.be.true;
      expect(result.getId()).to.equal(configurationData.id);
      expect(result.getConfigMap()).to.deep.equal({ daily: [] });
    });

    it('throws an error if configuration does not exist', async () => {
      const configuration = createConfiguration({ id: 'id1', configMap: {} });
      await expect(exportedFunctions.updateConfiguration(configuration)).to.be.rejectedWith('Configuration not found');
    });
  });

  describe('removeConfiguration Tests', () => {
    let mockDynamoClient;
    let mockLog;
    let exportedFunctions;

    beforeEach(() => {
      mockDynamoClient = {
        query: sinon.stub().returns(Promise.resolve([])),
        removeItem: sinon.stub().returns(Promise.resolve()),
      };
      mockLog = {
        log: sinon.stub(),
        error: sinon.stub(),
      };
      exportedFunctions = configurationFunctions(mockDynamoClient, TEST_DA_CONFIG, mockLog);
    });

    it('removes the configuration', async () => {
      await exportedFunctions.removeConfiguration('some-id');

      expect(mockDynamoClient.removeItem.calledOnce).to.be.true;
    });

    it('logs an error and reject if the configuration removal fails', async () => {
      const errorMessage = 'Failed to delete org';
      mockDynamoClient.removeItem.rejects(new Error(errorMessage));

      await expect(exportedFunctions.removeConfiguration('some-id')).to.be.rejectedWith(errorMessage);
      expect(mockLog.error.calledOnce).to.be.true;
    });
  });
});
