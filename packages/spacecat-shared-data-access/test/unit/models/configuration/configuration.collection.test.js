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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon, { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Configuration from '../../../../src/models/configuration/configuration.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('ConfigurationCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    configurationId: '2e6d24e8-3a1f-4c2c-9f80-696a177ff699',
    queues: {
      someQueue: {},
    },
    jobs: [],
    version: 1,
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Configuration, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the ConfigurationCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('create', () => {
    it('creates a new configuration as first version', async () => {
      instance.findLatest = stub().resolves(null);

      const result = await instance.create(mockRecord);

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal(mockRecord.configurationId);
    });

    it('creates a new configuration as a new version', async () => {
      const latestConfiguration = {
        getId: () => 's12345',
        getVersion: () => 1,
      };

      instance.findLatest = stub().resolves(latestConfiguration);
      mockRecord.version = 2;

      const result = await instance.create(mockRecord);

      expect(result).to.be.an('object');
      expect(result.getId()).to.equal(mockRecord.configurationId);
      expect(result.getVersion()).to.equal(2);
    });
  });

  describe('findByVersion', () => {
    it('finds configuration by version', async () => {
      const mockResult = { configurationId: 's12345' };

      instance.findByAll = stub().resolves(mockResult);

      const result = await instance.findByVersion(3);

      expect(result).to.deep.equal(mockResult);
      expect(instance.findByAll).to.have.been.calledWithExactly({ versionString: '0000000003' });
    });
  });

  describe('findLatest', () => {
    it('returns the latest configuration', async () => {
      const mockResult = { configurationId: 's12345' };

      instance.findByAll = stub().resolves(mockResult);

      const result = await instance.findLatest();

      expect(result).to.deep.equal(mockResult);
      expect(instance.findByAll).to.have.been.calledWithExactly({}, { order: 'desc' });
    });
  });

  describe('version cleanup', () => {
    describe('create with version limit enforcement', () => {
      it('does not trigger cleanup when version count is within limit', async () => {
        const latestConfiguration = {
          getId: () => 's12345',
          getVersion: () => 450,
        };

        instance.findLatest = stub().resolves(latestConfiguration);
        instance.all = stub().resolves(new Array(451).fill(null).map((_, i) => ({
          getId: () => `config-${i}`,
          getVersion: () => 451 - i,
        })));
        instance.removeByIds = stub().resolves();

        const result = await instance.create(mockRecord);

        expect(result).to.be.an('object');
        expect(result.getId()).to.equal(mockRecord.configurationId);

        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });

        expect(instance.all).to.have.been.called;
        expect(instance.removeByIds).to.not.have.been.called;
      });

      it('triggers cleanup when version count is exactly 500', async () => {
        const latestConfiguration = {
          getId: () => 's12345',
          getVersion: () => 499,
        };

        instance.findLatest = stub().resolves(latestConfiguration);
        instance.all = stub().resolves(new Array(500).fill(null).map((_, i) => ({
          getId: () => `config-${500 - i}`,
          getVersion: () => 500 - i,
        })));
        instance.removeByIds = stub().resolves();

        await instance.create(mockRecord);

        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });

        expect(instance.all).to.have.been.called;
        expect(instance.removeByIds).to.not.have.been.called;
      });

      it('triggers cleanup and deletes 1 version when count is 501', async () => {
        const latestConfiguration = {
          getId: () => 's12345',
          getVersion: () => 500,
        };

        const mockConfigs = new Array(501).fill(null).map((_, i) => ({
          getId: () => `config-${501 - i}`,
          getVersion: () => 501 - i,
        }));

        instance.findLatest = stub().resolves(latestConfiguration);
        instance.all = stub().resolves(mockConfigs);
        instance.removeByIds = stub().resolves();

        await instance.create(mockRecord);

        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });

        expect(instance.all).to.have.been.called;
        expect(instance.removeByIds).to.have.been.calledOnce;
        expect(instance.removeByIds).to.have.been.calledWith(['config-1']);
      });

      it('triggers cleanup and deletes multiple versions in batches', async () => {
        const latestConfiguration = {
          getId: () => 's12345',
          getVersion: () => 549,
        };

        const mockConfigs = new Array(550).fill(null).map((_, i) => ({
          getId: () => `config-${550 - i}`,
          getVersion: () => 550 - i,
        }));

        instance.findLatest = stub().resolves(latestConfiguration);
        instance.all = stub().resolves(mockConfigs);
        instance.removeByIds = stub().resolves();

        await instance.create(mockRecord);

        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });

        expect(instance.all).to.have.been.called;
        expect(instance.removeByIds).to.have.been.calledTwice;

        const firstBatchCall = instance.removeByIds.getCall(0);
        expect(firstBatchCall.args[0]).to.have.lengthOf(25);

        const secondBatchCall = instance.removeByIds.getCall(1);
        expect(secondBatchCall.args[0]).to.have.lengthOf(25);
      });

      it('handles large cleanup (delete 100 versions in 4 batches)', async () => {
        const latestConfiguration = {
          getId: () => 's12345',
          getVersion: () => 599,
        };

        const mockConfigs = new Array(600).fill(null).map((_, i) => ({
          getId: () => `config-${600 - i}`,
          getVersion: () => 600 - i,
        }));

        instance.findLatest = stub().resolves(latestConfiguration);
        instance.all = stub().resolves(mockConfigs);
        instance.removeByIds = stub().resolves();

        await instance.create(mockRecord);

        await new Promise((resolve) => {
          setTimeout(resolve, 150);
        });

        expect(instance.all).to.have.been.called;
        expect(instance.removeByIds).to.have.callCount(4);
      });

      it('does not fail create operation if cleanup fails', async () => {
        const latestConfiguration = {
          getId: () => 's12345',
          getVersion: () => 500,
        };

        const mockConfigs = new Array(501).fill(null).map((_, i) => ({
          getId: () => `config-${501 - i}`,
          getVersion: () => 501 - i,
        }));

        instance.findLatest = stub().resolves(latestConfiguration);
        instance.all = stub().resolves(mockConfigs);
        instance.removeByIds = stub().rejects(new Error('DynamoDB error'));

        const result = await instance.create(mockRecord);

        expect(result).to.be.an('object');
        expect(result.getId()).to.equal(mockRecord.configurationId);

        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });

        expect(mockLogger.error).to.have.been.called;
      });

      it('handles all failure gracefully', async () => {
        const latestConfiguration = {
          getId: () => 's12345',
          getVersion: () => 500,
        };

        instance.findLatest = stub().resolves(latestConfiguration);
        instance.all = stub().rejects(new Error('Query failed'));

        const result = await instance.create(mockRecord);

        expect(result).to.be.an('object');
        expect(result.getId()).to.equal(mockRecord.configurationId);

        await new Promise((resolve) => {
          setTimeout(resolve, 100);
        });

        expect(mockLogger.error).to.have.been.called;
      });

      it('handles errors in cleanup error handler (outer catch)', async () => {
        const latestConfiguration = {
          getId: () => 's12345',
          getVersion: () => 500,
        };

        instance.findLatest = stub().resolves(latestConfiguration);
        instance.all = stub().rejects(new Error('Query failed'));

        let errorCallCount = 0;
        mockLogger.error = stub().callsFake(() => {
          errorCallCount += 1;
          if (errorCallCount === 1) {
            throw new Error('Logger error');
          }
        });

        const result = await instance.create(mockRecord);

        expect(result).to.be.an('object');
        expect(result.getId()).to.equal(mockRecord.configurationId);

        await new Promise((resolve) => {
          setTimeout(resolve, 150);
        });

        expect(mockLogger.error).to.have.been.calledTwice;
        expect(mockLogger.error.secondCall).to.have.been.calledWith(
          'Failed to enforce configuration version limit',
          sinon.match.instanceOf(Error),
        );
      });
    });
  });
});
