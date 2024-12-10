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
import { ElectroValidationError } from 'electrodb';
import { spy, stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import BaseCollection from '../../../../../src/v2/models/base/base.collection.js';

chaiUse(chaiAsPromised);

describe('BaseCollection', () => {
  let baseCollectionInstance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;

  const mockRecord = {
    id: 'ef39921f-9a02-41db-b491-02c98987d956',
    data: {
      someKey: 'someValue',
    },
  };
  const mockEntityModel = {
    data: { ...mockRecord },
  };

  beforeEach(() => {
    mockEntityRegistry = {
      getCollection: stub(),
    };

    mockLogger = {
      error: spy(),
      warn: spy(),
    };

    mockElectroService = {
      entities: {
        mockEntityModel: {
          get: stub(),
          put: stub(),
          create: stub(),
          query: stub(),
          model: {
            name: 'mockentitymodel',
            indexes: [],
            table: 'mockentitymodel',
          },
        },
      },
    };

    baseCollectionInstance = new BaseCollection(
      mockElectroService,
      mockEntityRegistry,
      class MockEntityModel {
        constructor(service, factory, data) {
          this.data = data;
        }

        // eslint-disable-next-line class-methods-use-this
        _cacheReference() {}
      },
      mockLogger,
    );
  });

  describe('findById', () => {
    it('returns the entity if found', async () => {
      const mockFindResult = { data: mockRecord };
      mockElectroService.entities.mockEntityModel.get.returns(
        { go: () => Promise.resolve(mockFindResult) },
      );

      const result = await baseCollectionInstance.findById('ef39921f-9a02-41db-b491-02c98987d956');
      expect(result).to.deep.include(mockEntityModel);
      expect(mockElectroService.entities.mockEntityModel.get.calledOnce).to.be.true;
    });

    it('returns null if the entity is not found', async () => {
      mockElectroService.entities.mockEntityModel.get.returns(
        { go: () => Promise.resolve(null) },
      );

      const result = await baseCollectionInstance.findById('ef39921f-9a02-41db-b491-02c98987d956');
      expect(result).to.be.null;
      expect(mockElectroService.entities.mockEntityModel.get.calledOnce).to.be.true;
    });
  });

  describe('findByIndexKeys', () => {
    it('throws error if keys is not provided', async () => {
      await expect(baseCollectionInstance.findByIndexKeys())
        .to.be.rejectedWith('Failed to query [mockEntityModel]: keys are required');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('throws error if index is not found', async () => {
      await expect(baseCollectionInstance.findByIndexKeys({ someKey: 'someValue' }))
        .to.be.rejectedWith('Failed to query [mockEntityModel]: index [primary] not found');
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });

  describe('create', () => {
    it('throws an error if the record is empty', async () => {
      await expect(baseCollectionInstance.create(null)).to.be.rejectedWith('Failed to create [mockEntityModel]');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('creates a new entity successfully', async () => {
      mockElectroService.entities.mockEntityModel.create.returns(
        { go: () => Promise.resolve(mockEntityModel) },
      );

      const result = await baseCollectionInstance.create(mockRecord);
      expect(result).to.deep.include(mockEntityModel);
      expect(mockElectroService.entities.mockEntityModel.create.calledOnce).to.be.true;
    });

    it('logs an error and throws when creation fails', async () => {
      const error = new Error('Create failed');
      mockElectroService.entities.mockEntityModel.create.returns(
        { go: () => Promise.reject(error) },
      );

      await expect(baseCollectionInstance.create(mockRecord.data)).to.be.rejectedWith('Create failed');
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });

  describe('createMany', () => {
    it('throws an error if the records are empty', async () => {
      await expect(baseCollectionInstance.createMany(null))
        .to.be.rejectedWith('Failed to create many [mockEntityModel]: items must be a non-empty array');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('creates multiple entities successfully', async () => {
      const mockRecords = [mockRecord, mockRecord];
      const mockPutResults = {
        type: 'query',
        method: 'batchWrite',
        params: {
          RequestItems: {
            mockEntityModel: [
              { PutRequest: { Item: mockRecord } },
              { PutRequest: { Item: mockRecord } },
            ],
          },
        },
      };
      mockElectroService.entities.mockEntityModel.put.returns(
        {
          go: () => Promise.resolve(mockPutResults),
          params: () => ({ Item: { ...mockRecord } }),
        },
      );

      const result = await baseCollectionInstance.createMany(mockRecords);
      expect(result.createdItems).to.be.an('array').that.has.length(2);
      expect(result.createdItems).to.deep.include(mockEntityModel);
      expect(mockElectroService.entities.mockEntityModel.put.calledThrice).to.be.true;
    });

    it('creates many with a parent entity', async () => {
      const mockRecords = [mockRecord, mockRecord];
      const mockPutResults = {
        type: 'query',
        method: 'batchWrite',
        params: {
          RequestItems: {
            mockEntityModel: [
              { PutRequest: { Item: mockRecord } },
              { PutRequest: { Item: mockRecord } },
            ],
          },
        },
      };
      mockElectroService.entities.mockEntityModel.put.returns(
        {
          go: () => Promise.resolve(mockPutResults),
          params: () => ({ Item: { ...mockRecord } }),
        },
      );

      const result = await baseCollectionInstance.createMany(
        mockRecords,
        { entity: { model: { name: 'mockEntityModel' } } },
      );
      expect(result.createdItems).to.be.an('array').that.has.length(2);
      expect(result.createdItems).to.deep.include(mockEntityModel);
      expect(mockElectroService.entities.mockEntityModel.put.calledThrice).to.be.true;
    });

    it('creates some entities successfully with unprocessed items', async () => {
      const mockRecords = [mockRecord, mockRecord];
      let itemCount = 0;

      mockElectroService.entities.mockEntityModel.put.returns(
        {
          go: () => Promise.resolve({ unprocessed: [mockRecord] }),
          params: () => {
            if (itemCount === 0) {
              itemCount += 1;
              return { Item: { ...mockRecord } };
            } else {
              throw new ElectroValidationError('Validation failed');
            }
          },
        },
      );

      const result = await baseCollectionInstance.createMany(mockRecords);
      expect(result.createdItems).to.be.an('array').that.has.length(1);
      expect(result.createdItems).to.deep.include(mockEntityModel);
      expect(mockElectroService.entities.mockEntityModel.put.calledThrice).to.be.true;
      expect(mockLogger.error.calledOnceWith(`Failed to process all items in batch write for [mockEntityModel]: ${JSON.stringify([mockRecord])}`)).to.be.true;
    });

    it('fails creating some items due to ValidationError', async () => {
      const error = new ElectroValidationError('Validation failed');
      mockElectroService.entities.mockEntityModel.put.returns(
        { params: () => { throw error; } },
      );

      const result = await baseCollectionInstance.createMany([mockRecord]);
      expect(result.createdItems).to.be.an('array').that.has.length(0);
      expect(result.errorItems).to.be.an('array').that.has.length(1);
      expect(result.errorItems[0].item).to.deep.include(mockRecord);
    });

    it('logs an error and throws when creation fails', async () => {
      const error = new Error('Create failed');
      const mockRecords = [mockRecord, mockRecord];
      mockElectroService.entities.mockEntityModel.put.returns(
        {
          go: () => Promise.reject(error),
          params: () => ({ Item: { ...mockRecord } }),
        },
      );

      await expect(baseCollectionInstance.createMany(mockRecords)).to.be.rejectedWith('Create failed');
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });

  describe('_saveMany', () => { /* eslint-disable no-underscore-dangle */
    it('throws an error if the records are empty', async () => {
      await expect(baseCollectionInstance._saveMany(null))
        .to.be.rejectedWith('Failed to save many [mockEntityModel]: items must be a non-empty array');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('saves multiple entities successfully', async () => {
      const mockRecords = [mockRecord, mockRecord];
      mockElectroService.entities.mockEntityModel.put.returns({ go: () => [] });

      const result = await baseCollectionInstance._saveMany(mockRecords);
      expect(result).to.be.undefined;
      expect(mockElectroService.entities.mockEntityModel.put.calledOnce).to.be.true;
    });

    it('saves some entities successfully with unprocessed items', async () => {
      const mockRecords = [mockRecord, mockRecord];
      mockElectroService.entities.mockEntityModel.put.returns(
        {
          go: () => Promise.resolve({ unprocessed: [mockRecord] }),
        },
      );

      const result = await baseCollectionInstance._saveMany(mockRecords);
      expect(result).to.be.undefined;
      expect(mockElectroService.entities.mockEntityModel.put.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnceWith(`Failed to process all items in batch write for [mockEntityModel]: ${JSON.stringify([mockRecord])}`)).to.be.true;
    });

    it('throws error and logs when save fails', async () => {
      const error = new Error('Save failed');
      const mockRecords = [mockRecord, mockRecord];
      mockElectroService.entities.mockEntityModel.put.returns(
        { go: () => Promise.reject(error) },
      );

      await expect(baseCollectionInstance._saveMany(mockRecords)).to.be.rejectedWith('Save failed');
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });
});
