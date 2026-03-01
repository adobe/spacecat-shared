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

// eslint-disable-next-line max-classes-per-file
import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon, { spy, stub } from 'sinon';
import sinonChai from 'sinon-chai';

import BaseCollection from '../../../../src/models/base/base.collection.js';
import Schema from '../../../../src/models/base/schema.js';
import BaseModel from '../../../../src/models/base/base.model.js';
import { DataAccessError } from '../../../../src/index.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const MockModel = class MockEntityModel extends BaseModel {
  static ENTITY_NAME = 'MockEntityModel';
};
const MockCollection = class MockEntityCollection extends BaseCollection {
  static COLLECTION_NAME = 'MockEntityCollection';
};

const createSchema = (service, indexes, attributes = {
  someKey: { type: 'string' },
  someOtherKey: { type: 'number' },
}) => new Schema(
  MockModel,
  MockCollection,
  {
    serviceName: 'service',
    schemaVersion: 1,
    attributes,
    indexes,
    references: [],
    options: { allowRemove: true, allowUpdates: true },
  },
);

const createInstance = (service, registry, indexes, log, attributes) => {
  const schema = createSchema(service, indexes, attributes);
  return new BaseCollection(
    service,
    registry,
    schema,
    log,
  );
};

describe('BaseCollection', () => {
  let baseCollectionInstance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockIndexes;
  let mockLogger;

  const mockRecord = {
    mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956',
    mockParentEntityModelId: 'some-parent-id',
    data: {
      someKey: 'someValue',
    },
  };

  beforeEach(() => {
    mockIndexes = { primary: {}, all: { index: 'all', indexType: 'all' } };
    mockEntityRegistry = {
      getCollection: stub(),
    };

    mockLogger = {
      error: spy(),
      debug: spy(),
      info: spy(),
      warn: spy(),
    };

    mockElectroService = {
      entities: {
        mockEntityModel: {
          create: stub(),
          delete: stub(),
          get: stub(),
          put: stub(),
          query: {
            all: stub().returns({
              between: stub().returns({
                go: () => ({ data: [] }),
              }),
              go: () => ({ data: [] }),
            }),
            bySomeKey: stub(),
            primary: stub(),
          },
          model: {
            entity: 'MockEntityModel',
            indexes: {},
            table: 'data',
            original: {},
            schema: {
              attributes: {},
            },
          },
        },
      },
    };

    baseCollectionInstance = createInstance(
      mockElectroService,
      mockEntityRegistry,
      mockIndexes,
      mockLogger,
    );
  });

  it('throws when postgrestService is missing', () => {
    expect(() => createInstance(
      null,
      mockEntityRegistry,
      mockIndexes,
      mockLogger,
    )).to.throw(DataAccessError, 'postgrestService is required');
  });

  describe('collection methods', () => {
    it('does not create accessors for the primary index', () => {
      mockIndexes = { primary: {} };

      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      expect(instance).to.not.have.property('allBy');
      expect(instance).to.not.have.property('findBy');
    });

    it('creates accessors for partition key attributes', () => {
      mockIndexes = {
        bySomeKey: { pk: { facets: ['someKey'] } },
      };

      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      expect(instance).to.have.property('allBySomeKey');
      expect(instance).to.have.property('findBySomeKey');
    });

    it('creates accessors for sort key attributes', () => {
      mockIndexes = {
        bySomeKey: { sk: { facets: ['someKey'] } },
      };

      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      expect(instance).to.have.property('allBySomeKey');
      expect(instance).to.have.property('findBySomeKey');
    });

    it('creates accessors for partition and sort key attributes', () => {
      mockIndexes = {
        bySomeKey: { index: 'bySomeKey', pk: { facets: ['someKey'] }, sk: { facets: ['someOtherKey'] } },
      };

      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      expect(instance).to.have.property('allBySomeKey');
      expect(instance).to.have.property('allBySomeKeyAndSomeOtherKey');
      expect(instance).to.have.property('findBySomeKey');
      expect(instance).to.have.property('findBySomeKeyAndSomeOtherKey');
    });

    it('parses accessor arguments correctly', async () => {
      mockElectroService.entities.mockEntityModel.query.bySomeKey.returns(
        { go: () => Promise.resolve({ data: [] }) },
      );
      mockIndexes = {
        bySomeKey: { index: 'bySomeKey', pk: { facets: ['someKey'] }, sk: { facets: ['someOtherKey'] } },
      };

      mockElectroService.entities.mockEntityModel.model.schema = {
        attributes: {
          someKey: { type: 'string' },
          someOtherKey: { type: 'number' },
        },
      };

      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      const someKey = 'someValue';
      const someOtherKey = 1;
      const options = { order: 'desc' };

      await instance.allBySomeKey(someKey);
      await instance.findBySomeKey(someKey);
      await instance.allBySomeKeyAndSomeOtherKey(someKey, someOtherKey);
      await instance.findBySomeKeyAndSomeOtherKey(someKey, someOtherKey);
      await instance.findBySomeKeyAndSomeOtherKey(someKey, someOtherKey, options);

      await expect(instance.allBySomeKey()).to.be.rejectedWith('someKey is required');
      await expect(instance.findBySomeKey()).to.be.rejectedWith('someKey is required');
      await expect(instance.allBySomeKeyAndSomeOtherKey(someKey)).to.be.rejectedWith('someOtherKey is required');
      await expect(instance.allBySomeKeyAndSomeOtherKey(someKey, '1')).to.be.rejectedWith('someOtherKey is required');
      await expect(instance.findBySomeKeyAndSomeOtherKey(someKey)).to.be.rejectedWith('someOtherKey is required');
    });
  });

  describe('findById', () => {
    it('returns the entity if found', async () => {
      const mockFindResult = { data: mockRecord };
      mockElectroService.entities.mockEntityModel.get.returns(
        { go: () => Promise.resolve(mockFindResult) },
      );

      const result = await baseCollectionInstance.findById('ef39921f-9a02-41db-b491-02c98987d956');

      expect(result.record).to.deep.include(mockRecord);
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

  describe('existsById', () => {
    it('returns true if entity exists', async () => {
      const mockFindResult = { data: mockRecord };
      mockElectroService.entities.mockEntityModel.get.returns(
        { go: () => Promise.resolve(mockFindResult) },
      );

      const result = await baseCollectionInstance.existsById('ef39921f-9a02-41db-b491-02c98987d956');

      expect(result).to.be.true;
      expect(mockElectroService.entities.mockEntityModel.get.calledOnce).to.be.true;
    });

    it('returns false if entity does not exist', async () => {
      mockElectroService.entities.mockEntityModel.get.returns(
        { go: () => Promise.resolve(null) },
      );

      const result = await baseCollectionInstance.existsById('ef39921f-9a02-41db-b491-02c98987d956');

      expect(result).to.be.false;
      expect(mockElectroService.entities.mockEntityModel.get.calledOnce).to.be.true;
    });
  });

  describe('findByIndexKeys', () => {
    it('throws error if keys is not provided', async () => {
      await expect(baseCollectionInstance.findByIndexKeys())
        .to.be.rejectedWith(DataAccessError, 'Failed to query [mockEntityModel]: keys are required');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('throws error if index is not found', async () => {
      await expect(baseCollectionInstance.findByIndexKeys({ someKey: 'someValue' }, { index: 'none' }))
        .to.be.rejectedWith(DataAccessError, 'Failed to query [mockEntityModel]: query proxy [none] not found');
      expect(mockLogger.error).to.have.been.calledOnce;
    });
  });

  describe('create', () => {
    it('throws an error if the record is empty', async () => {
      await expect(baseCollectionInstance.create(null)).to.be.rejectedWith('Failed to create [mockEntityModel]');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('creates a new entity successfully', async () => {
      mockElectroService.entities.mockEntityModel.create.returns(
        { go: () => Promise.resolve({ data: mockRecord }) },
      );

      const result = await baseCollectionInstance.create(mockRecord);
      expect(result.record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.create.calledOnce).to.be.true;
    });

    it('upserts an existing entity successfully', async () => {
      mockElectroService.entities.mockEntityModel.put.returns(
        { go: () => Promise.resolve({ data: mockRecord }) },
      );
      const result = await baseCollectionInstance.create(mockRecord, { upsert: true });
      expect(result.record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.put.calledOnce).to.be.true;
    });

    it('logs an error and throws when creation fails', async () => {
      const error = new Error('Create failed');
      error.fields = [{ field: 'someKey', message: 'Some key is required' }];
      mockElectroService.entities.mockEntityModel.create.returns(
        { go: () => Promise.reject(error) },
      );

      await expect(baseCollectionInstance.create(mockRecord.data)).to.be.rejectedWith(DataAccessError, 'Failed to create');
      expect(mockLogger.error.calledTwice).to.be.true;
    });

    it('calls the on-create handler if provided', async () => {
      mockElectroService.entities.mockEntityModel.create.returns(
        { go: () => Promise.resolve({ data: mockRecord }) },
      );

      const onCreate = stub().resolves();
      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      // eslint-disable-next-line no-underscore-dangle
      instance._onCreate = onCreate;

      await instance.create(mockRecord);

      expect(onCreate).to.have.been.calledOnce;
    });

    it('logs error if onCreate handler fails', async () => {
      const error = new Error('On-create failed');
      mockElectroService.entities.mockEntityModel.create.returns(
        { go: () => Promise.resolve({ data: mockRecord }) },
      );

      const onCreate = stub().rejects(error);
      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      // eslint-disable-next-line no-underscore-dangle
      instance._onCreate = onCreate;

      await instance.create(mockRecord);

      expect(onCreate).to.have.been.calledOnce;
      expect(mockLogger.error).to.have.been.calledOnceWith('On-create handler failed');
    });
  });

  describe('createMany', () => {
    it('throws an error if the items are empty', async () => {
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
      expect(result.createdItems[0].record).to.deep.include(mockRecord);
      expect(result.createdItems[1].record).to.deep.include(mockRecord);
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

      const parent = {
        record: { mockParentEntityModelId: mockRecord.mockParentEntityModelId },
        entityName: 'mockParentEntityModel',
        entity: { model: { name: 'mockParentEntityModel' } },
        schema: { getModelName: () => 'MockParentEntityModel' },
      };

      const result = await baseCollectionInstance.createMany(mockRecords, parent);

      expect(result.createdItems).to.be.an('array').that.has.length(2);
      expect(result.createdItems[0].record).to.deep.include(mockRecord);
      expect(result.createdItems[1].record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.put.calledThrice).to.be.true;
      expect(mockLogger.warn).to.not.have.been.called;
    });

    it('logs warning if parent is invalid', async () => {
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

      const idNotMatchingParent = {
        record: { mockParentEntityModelId: 'invalid-id' },
        entityName: 'mockParentEntityModel',
        entity: { model: { name: 'mockParentEntityModel' } },
      };

      const noEntityParent = {
        record: { mockParentEntityModelId: 'invalid-id' },
        entity: { model: { name: 'mockParentEntityModel' } },
      };

      const r1 = await baseCollectionInstance.createMany(mockRecords, idNotMatchingParent);
      const r2 = await baseCollectionInstance.createMany(mockRecords, noEntityParent);

      expect(r1.createdItems).to.be.an('array').that.has.length(2);
      expect(r1.createdItems[0].record).to.deep.include(mockRecord);
      expect(r1.createdItems[1].record).to.deep.include(mockRecord);

      expect(r2.createdItems).to.be.an('array').that.has.length(2);
      expect(r2.createdItems[0].record).to.deep.include(mockRecord);
      expect(r2.createdItems[1].record).to.deep.include(mockRecord);

      expect(mockElectroService.entities.mockEntityModel.put).to.have.callCount(6);
      expect(mockLogger.warn).to.have.callCount(4);
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
              const error = new Error('Validation failed');
              error.name = 'ElectroValidationError';
              throw error;
            }
          },
        },
      );

      const result = await baseCollectionInstance.createMany(mockRecords);
      expect(result.createdItems).to.be.an('array').that.has.length(1);
      expect(result.createdItems[0].record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.put.calledThrice).to.be.true;
      expect(mockLogger.error.calledOnceWith(`Failed to process all items in batch write for [mockEntityModel]: ${JSON.stringify([mockRecord])}`)).to.be.true;
    });

    it('fails creating some items due to ValidationError', async () => {
      const error = new Error('Validation failed');
      error.name = 'ElectroValidationError';
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

      await expect(baseCollectionInstance.createMany(mockRecords)).to.be.rejectedWith('Failed to create many');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('calls the on-create-many handler if provided', async () => {
      mockElectroService.entities.mockEntityModel.put.returns(
        { go: () => Promise.resolve({ data: mockRecord }) },
      );

      const onCreateMany = stub().resolves();
      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      // eslint-disable-next-line no-underscore-dangle
      instance._onCreateMany = onCreateMany;

      await instance.createMany([mockRecord]);

      expect(onCreateMany).to.have.been.calledOnce;
    });

    it('logs error if onCreateMany handler fails', async () => {
      const error = new Error('On-create-many failed');
      mockElectroService.entities.mockEntityModel.put.returns(
        { go: () => Promise.resolve({ data: mockRecord }) },
      );

      const onCreateMany = stub().rejects(error);
      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      // eslint-disable-next-line no-underscore-dangle
      instance._onCreateMany = onCreateMany;

      await instance.createMany([mockRecord]);

      expect(onCreateMany).to.have.been.calledOnce;
      expect(mockLogger.error).to.have.been.calledOnceWith('On-create-many handler failed');
    });
  });

  describe('_saveMany', () => { /* eslint-disable no-underscore-dangle */
    it('throws an error if the records are empty', async () => {
      await expect(baseCollectionInstance._saveMany(null))
        .to.be.rejectedWith('Failed to save many [mockEntityModel]: items must be a non-empty array');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('saves multiple entities successfully', async () => {
      const mockModelInstances = [
        new MockModel(
          mockElectroService,
          mockEntityRegistry,
          baseCollectionInstance.schema,
          mockRecord,
          mockLogger,
        ),
        new MockModel(
          mockElectroService,
          mockEntityRegistry,
          baseCollectionInstance.schema,
          mockRecord,
          mockLogger,
        ),
      ];
      mockElectroService.entities.mockEntityModel.put.returns({ go: () => [] });

      const result = await baseCollectionInstance._saveMany(mockModelInstances);
      expect(result).to.be.undefined;
      expect(mockElectroService.entities.mockEntityModel.put.calledOnce).to.be.true;
      expect(mockLogger.error).not.called;
    });

    it('updates updatedAt field for all entities before saving', async () => {
      const mockModelInstance = new MockModel(
        mockElectroService,
        mockEntityRegistry,
        baseCollectionInstance.schema,
        mockRecord,
        mockLogger,
      );
      const originalUpdatedAt = mockModelInstance.record.updatedAt;
      mockElectroService.entities.mockEntityModel.put.returns({ go: () => [] });

      // Add small delay to ensure timestamp difference
      await new Promise((resolve) => {
        setTimeout(resolve, 10);
      });

      await baseCollectionInstance._saveMany([mockModelInstance]);

      // Verify updatedAt was updated
      expect(mockModelInstance.record.updatedAt).to.not.equal(originalUpdatedAt);
      expect(mockModelInstance.record.updatedAt).to.be.a('string');
      expect(new Date(mockModelInstance.record.updatedAt).getTime())
        .to.be.closeTo(Date.now(), 1000);
    });

    it('saves multiple entities successfully if `res.unprocessed` is an empty array', async () => {
      const mockModelInstances = [
        new MockModel(
          mockElectroService,
          mockEntityRegistry,
          baseCollectionInstance.schema,
          mockRecord,
          mockLogger,
        ),
        new MockModel(
          mockElectroService,
          mockEntityRegistry,
          baseCollectionInstance.schema,
          mockRecord,
          mockLogger,
        ),
      ];
      mockElectroService.entities.mockEntityModel.put.returns({
        go: async () => ({ unprocessed: [] }),
      });

      const result = await baseCollectionInstance._saveMany(mockModelInstances);
      expect(result).to.be.undefined;
      expect(mockElectroService.entities.mockEntityModel.put.calledOnce).to.be.true;
      expect(mockLogger.error).not.called;
    });

    it('saves some entities successfully with unprocessed items', async () => {
      const mockModelInstances = [
        new MockModel(
          mockElectroService,
          mockEntityRegistry,
          baseCollectionInstance.schema,
          mockRecord,
          mockLogger,
        ),
        new MockModel(
          mockElectroService,
          mockEntityRegistry,
          baseCollectionInstance.schema,
          mockRecord,
          mockLogger,
        ),
      ];
      mockElectroService.entities.mockEntityModel.put.returns(
        {
          go: () => Promise.resolve({ unprocessed: [mockRecord] }),
        },
      );

      const result = await baseCollectionInstance._saveMany(mockModelInstances);
      expect(result).to.be.undefined;
      expect(mockElectroService.entities.mockEntityModel.put.calledOnce).to.be.true;
      expect(mockLogger.error.calledOnceWith(`Failed to process all items in batch write for [mockEntityModel]: ${JSON.stringify([mockRecord])}`)).to.be.true;
    });

    it('throws error and logs when save fails', async () => {
      const error = new Error('Save failed');
      const mockModelInstances = [
        new MockModel(
          mockElectroService,
          mockEntityRegistry,
          baseCollectionInstance.schema,
          mockRecord,
          mockLogger,
        ),
        new MockModel(
          mockElectroService,
          mockEntityRegistry,
          baseCollectionInstance.schema,
          mockRecord,
          mockLogger,
        ),
      ];
      mockElectroService.entities.mockEntityModel.put.returns(
        { go: () => Promise.reject(error) },
      );

      await expect(baseCollectionInstance._saveMany(mockModelInstances)).to.be.rejectedWith(DataAccessError, 'Failed to save many');
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });

  describe('all', () => {
    it('returns all entities successfully', async () => {
      const mockFindResult = { data: [mockRecord] };
      mockElectroService.entities.mockEntityModel.query.all.returns(
        { go: () => Promise.resolve(mockFindResult) },
      );

      const result = await baseCollectionInstance.all();
      expect(result).to.be.an('array').that.has.length(1);
      expect(result[0].record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.query.all)
        .to.have.been.calledOnceWithExactly({ pk: 'all_mockentitymodels' });
    });

    it('applies between filter if provided', async () => {
      const mockFindResult = { data: [mockRecord] };
      const mockGo = stub().resolves(mockFindResult);
      const mockBetween = stub().returns({ go: mockGo });
      mockElectroService.entities.mockEntityModel.query.all().between = mockBetween;

      const result = await baseCollectionInstance.all(
        {},
        { between: { attribute: 'test', start: 'a', end: 'b' } },
      );

      expect(result).to.be.an('array').that.has.length(1);
      expect(result[0].record).to.deep.include(mockRecord);
      expect(mockBetween).to.have.been.calledOnceWithExactly({ test: 'a' }, { test: 'b' });
      expect(mockGo).to.have.been.calledOnceWithExactly({ order: 'desc' });
    });

    it('applies where filter (FilterExpression) if provided', async () => {
      const mockFindResult = { data: [mockRecord] };
      const mockGo = stub().resolves(mockFindResult);
      const mockWhere = stub().returns({ go: mockGo });
      mockElectroService.entities.mockEntityModel.query.all().where = mockWhere;

      const whereClause = (attr, op) => op.contains(attr.audits, 'test-audit');
      const result = await baseCollectionInstance.all(
        {},
        { where: whereClause },
      );

      expect(result).to.be.an('array').that.has.length(1);
      expect(result[0].record).to.deep.include(mockRecord);
      expect(mockWhere).to.have.been.calledOnceWithExactly(whereClause);
      expect(mockGo).to.have.been.calledOnceWithExactly({ order: 'desc' });
    });

    it('applies attribute filter if provided', async () => {
      const mockFindResult = { data: [mockRecord] };
      const mockGo = stub().resolves(mockFindResult);
      mockElectroService.entities.mockEntityModel.query.all.returns(
        { go: mockGo },
      );

      const result = await baseCollectionInstance.all({}, { attributes: ['test'] });

      expect(result).to.be.an('array').that.has.length(1);
      expect(result[0].record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.query.all)
        .to.have.been.calledOnceWithExactly({ pk: 'all_mockentitymodels' });
      expect(mockGo).to.have.been.calledOnceWithExactly({ order: 'desc', attributes: ['test'] });
    });

    it('handles pagination with fetchAllPages option', async () => {
      const firstResult = { data: [mockRecord], cursor: 'key1' };
      const secondRecord = { id: '2', foo: 'bar' };
      const secondResult = { data: [secondRecord] };

      const goStub = stub();
      goStub.onFirstCall().resolves(firstResult);
      goStub.onSecondCall().resolves(secondResult);

      mockElectroService.entities.mockEntityModel.query.all.returns({
        go: goStub,
      });

      const result = await baseCollectionInstance.all({}, { fetchAllPages: true });
      expect(result).to.be.an('array').that.has.length(2);
      expect(result[0].record).to.deep.include(mockRecord);
      expect(result[1].record).to.deep.include(secondRecord);

      expect(goStub.callCount).to.equal(2);

      const secondCallArgs = goStub.secondCall.args[0];
      expect(secondCallArgs).to.deep.include({ order: 'desc', cursor: 'key1' });
    });

    it('fetches all pages by default (system-wide fix)', async () => {
      const firstResult = { data: [mockRecord], cursor: 'key1' };
      const secondRecord = { id: '2', foo: 'bar' };
      const secondResult = { data: [secondRecord] };

      const goStub = stub();
      goStub.onFirstCall().resolves(firstResult);
      goStub.onSecondCall().resolves(secondResult);

      mockElectroService.entities.mockEntityModel.query.all.returns({
        go: goStub,
      });

      // No fetchAllPages specified - should default to true
      const result = await baseCollectionInstance.all();
      expect(result).to.be.an('array').that.has.length(2);
      expect(result[0].record).to.deep.include(mockRecord);
      expect(result[1].record).to.deep.include(secondRecord);

      expect(goStub.callCount).to.equal(2);

      const secondCallArgs = goStub.secondCall.args[0];
      expect(secondCallArgs).to.deep.include({ order: 'desc', cursor: 'key1' });
    });

    it('allows opting out of pagination with fetchAllPages: false', async () => {
      const firstResult = { data: [mockRecord], cursor: 'key1' };

      const goStub = stub();
      goStub.onFirstCall().resolves(firstResult);

      mockElectroService.entities.mockEntityModel.query.all.returns({
        go: goStub,
      });

      // Explicitly disable pagination
      const result = await baseCollectionInstance.all({}, { fetchAllPages: false });
      expect(result).to.be.an('array').that.has.length(1);
      expect(result[0].record).to.deep.include(mockRecord);

      // Should only call once (not fetch additional pages)
      expect(goStub.callCount).to.equal(1);
    });
  });

  describe('allByIndexKeys', () => {
    it('throws error if keys is not provided', async () => {
      await expect(baseCollectionInstance.allByIndexKeys())
        .to.be.rejectedWith('Failed to query [mockEntityModel]: keys are required');
      expect(mockLogger.error).to.have.been.calledOnce;
    });

    it('throws and error if options is not an object', async () => {
      await expect(baseCollectionInstance.allByIndexKeys({ someKey: 'someValue' }, null))
        .to.be.rejectedWith('Failed to query [mockEntityModel]: options must be an object');
      expect(mockLogger.error).to.have.been.calledOnce;
    });

    it('throws an error if the query operation fails', async () => {
      const error = new Error('Query failed');
      mockElectroService.entities.mockEntityModel.query.all.returns(
        { go: () => Promise.reject(error) },
      );

      await expect(baseCollectionInstance.allByIndexKeys({ someKey: 'someValue' }))
        .to.be.rejectedWith(DataAccessError, 'Failed to query');
      expect(mockLogger.error).to.have.been.calledOnce;
    });

    it('successfully queries entities by index keys', async () => {
      const mockFindResult = { data: [mockRecord] };

      mockIndexes = {
        bySomeKey: { index: 'bySomeKey', pk: { facets: ['someKey'] }, sk: { facets: ['someOtherKey'] } },
      };

      mockElectroService.entities.mockEntityModel.query.bySomeKey.returns(
        { go: () => Promise.resolve(mockFindResult) },
      );

      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      const result = await instance.allByIndexKeys({ someKey: 'someValue' });

      expect(result).to.be.an('array').that.has.length(1);
      expect(result[0].record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.query.bySomeKey)
        .to.have.been.calledOnceWithExactly({ someKey: 'someValue' });
    });

    it('successfully queries entities by primary index keys', async () => {
      const mockFindResult = { data: [mockRecord] };

      delete mockElectroService.entities.mockEntityModel.query.all;
      delete mockElectroService.entities.mockEntityModel.query.bySomeKey;
      delete mockIndexes.all;

      mockElectroService.entities.mockEntityModel.query.primary.returns(
        { go: () => Promise.resolve(mockFindResult) },
      );

      const instance = createInstance(
        mockElectroService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      const result = await instance.allByIndexKeys({ someKey: 'someValue' });

      expect(result).to.be.an('array').that.has.length(1);
      expect(result[0].record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.query.primary)
        .to.have.been.calledOnceWithExactly({ someKey: 'someValue' });
    });
  });

  describe('findByAll', () => {
    it('throws an error if sortKeys is not an object', async () => {
      await expect(baseCollectionInstance.findByAll(null))
        .to.be.rejectedWith('Failed to find by all [mockEntityModel]: sort keys must be an object');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('finds all entities successfully', async () => {
      const mockFindResult = { data: [mockRecord] };
      mockElectroService.entities.mockEntityModel.query.all.returns(
        { go: () => Promise.resolve(mockFindResult) },
      );

      const result = await baseCollectionInstance.findByAll({ someKey: 'someValue' });
      expect(result.record).to.deep.include(mockRecord);
      expect(mockElectroService.entities.mockEntityModel.query.all)
        .to.have.been.calledOnceWithExactly(
          { pk: 'all_mockentitymodels', someKey: 'someValue' },
        );
    });

    it('returns null if the entity is not found', async () => {
      const result = await baseCollectionInstance.findByAll({ someKey: 'someValue' });
      expect(result).to.be.null;
      expect(mockElectroService.entities.mockEntityModel.query.all)
        .to.have.been.calledOnceWithExactly(
          { pk: 'all_mockentitymodels', someKey: 'someValue' },
        );
    });
  });

  describe('removeByIds', () => {
    it('throws an error if the ids are not an array', async () => {
      await expect(baseCollectionInstance.removeByIds(null))
        .to.be.rejectedWith('Failed to remove [mockEntityModel]: ids must be a non-empty array');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('throws an error if the ids are empty', async () => {
      await expect(baseCollectionInstance.removeByIds([]))
        .to.be.rejectedWith('Failed to remove [mockEntityModel]: ids must be a non-empty array');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('throws error if delete operation fails', async () => {
      const error = new Error('Delete failed');
      mockElectroService.entities.mockEntityModel.delete.returns(
        { go: () => Promise.reject(error) },
      );

      await expect(baseCollectionInstance.removeByIds(['ef39921f-9a02-41db-b491-02c98987d956']))
        .to.be.rejectedWith(DataAccessError, 'Failed to remove');
      expect(mockLogger.error.calledOnce).to.be.true;
    });

    it('removes entities successfully', async () => {
      const mockIds = ['ef39921f-9a02-41db-b491-02c98987d956', 'ef39921f-9a02-41db-b491-02c98987d957'];
      mockElectroService.entities.mockEntityModel.delete.returns({ go: () => Promise.resolve() });
      await baseCollectionInstance.removeByIds(mockIds);
      expect(mockElectroService.entities.mockEntityModel.delete)
        .to.have.been.calledOnceWithExactly([
          { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
          { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
        ]);
    });

    it('removes entities successfully via PostgREST service when entity proxy is unavailable', async () => {
      const inStub = stub().resolves({ error: null });
      const deleteStub = stub().returns({ in: inStub });
      const fromStub = stub().returns({ delete: deleteStub });
      const postgrestService = { from: fromStub };

      const instance = createInstance(
        postgrestService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      const mockIds = ['ef39921f-9a02-41db-b491-02c98987d956', 'ef39921f-9a02-41db-b491-02c98987d957'];
      await instance.removeByIds(mockIds);

      expect(fromStub).to.have.been.calledOnceWithExactly(instance.tableName);
      expect(inStub).to.have.been.calledOnceWithExactly('mock_entity_model_id', mockIds);
    });

    it('throws when PostgREST removeByIds operation returns an error', async () => {
      const inStub = stub().resolves({ error: new Error('delete failed') });
      const deleteStub = stub().returns({ in: inStub });
      const fromStub = stub().returns({ delete: deleteStub });
      const postgrestService = { from: fromStub };

      const instance = createInstance(
        postgrestService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      await expect(instance.removeByIds(['ef39921f-9a02-41db-b491-02c98987d956']))
        .to.be.rejectedWith(DataAccessError, 'Failed to remove by IDs');
    });
  });

  describe('batchGetByKeys', () => {
    it('should successfully batch get entities by keys', async () => {
      const keys = [
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ];
      const mockRecords = [
        { ...mockRecord, mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { ...mockRecord, mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ];

      const mockElectroResult = {
        data: mockRecords,
        unprocessed: [],
      };

      mockElectroService.entities.mockEntityModel.get.returns({
        go: stub().resolves(mockElectroResult),
      });

      const result = await baseCollectionInstance.batchGetByKeys(keys);

      expect(result.data).to.have.length(2);
      expect(result.data[0].record.mockEntityModelId).to.equal('ef39921f-9a02-41db-b491-02c98987d956');
      expect(result.data[1].record.mockEntityModelId).to.equal('ef39921f-9a02-41db-b491-02c98987d957');
      expect(result.unprocessed).to.deep.equal([]);

      expect(mockElectroService.entities.mockEntityModel.get).to.have.been.calledOnceWith(keys);
    });

    it('should handle partial results with unprocessed items', async () => {
      const keys = [
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d958' },
      ];
      const mockRecords = [
        { ...mockRecord, mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { ...mockRecord, mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ];

      const mockElectroResult = {
        data: mockRecords,
        unprocessed: [{ mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d958' }],
      };

      mockElectroService.entities.mockEntityModel.get.returns({
        go: stub().resolves(mockElectroResult),
      });

      const result = await baseCollectionInstance.batchGetByKeys(keys);

      expect(result.data).to.have.length(2);
      expect(result.data[0].record.mockEntityModelId).to.equal('ef39921f-9a02-41db-b491-02c98987d956');
      expect(result.data[1].record.mockEntityModelId).to.equal('ef39921f-9a02-41db-b491-02c98987d957');
      expect(result.unprocessed).to.deep.equal([{ mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d958' }]);

      expect(result.data).to.have.length(2);
      expect(result.unprocessed).to.have.length(1);
    });

    it('should return empty arrays when no entities found', async () => {
      const keys = [{ mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d999' }];

      const mockElectroResult = {
        data: [],
        unprocessed: [{ mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d999' }],
      };

      mockElectroService.entities.mockEntityModel.get.returns({
        go: stub().resolves(mockElectroResult),
      });

      const result = await baseCollectionInstance.batchGetByKeys(keys);

      expect(result).to.deep.equal({
        data: [],
        unprocessed: [{ mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d999' }],
      });
    });

    it('should throw error when keys is not provided', async () => {
      await expect(baseCollectionInstance.batchGetByKeys()).to.be.rejectedWith(DataAccessError);
    });

    it('should throw error when keys is not an array', async () => {
      await expect(baseCollectionInstance.batchGetByKeys('not-an-array')).to.be.rejectedWith(DataAccessError);
    });

    it('should throw error when keys is an empty array', async () => {
      await expect(baseCollectionInstance.batchGetByKeys([])).to.be.rejectedWith(DataAccessError);
    });

    it('should throw error when keys contains null values', async () => {
      await expect(baseCollectionInstance.batchGetByKeys([
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        null,
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ])).to.be.rejectedWith(DataAccessError);
    });

    it('should throw error when keys contains undefined values', async () => {
      await expect(baseCollectionInstance.batchGetByKeys([
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        undefined,
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ])).to.be.rejectedWith(DataAccessError);
    });

    it('should throw error when keys contains empty objects', async () => {
      await expect(baseCollectionInstance.batchGetByKeys([
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        {},
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ])).to.be.rejectedWith(DataAccessError);
    });

    it('should throw error when keys contains non-object values', async () => {
      await expect(baseCollectionInstance.batchGetByKeys([
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        'not-an-object',
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ])).to.be.rejectedWith(DataAccessError);
    });

    it('should handle database errors and throw DataAccessError', async () => {
      const keys = [{ mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' }];
      const error = new Error('Database connection failed');

      mockElectroService.entities.mockEntityModel.get.returns({
        go: stub().rejects(error),
      });

      await expect(baseCollectionInstance.batchGetByKeys(keys)).to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to batch get by keys [mockEntityModel]', error);
    });

    it('should handle null records in results', async () => {
      const keys = [
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ];
      const mockRecords = [
        { ...mockRecord, mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { ...mockRecord, mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ];

      const mockElectroResult = {
        data: mockRecords,
        unprocessed: [],
      };

      mockElectroService.entities.mockEntityModel.get.returns({
        go: stub().resolves(mockElectroResult),
      });

      const result = await baseCollectionInstance.batchGetByKeys(keys);

      expect(result.data).to.have.length(2);
      expect(result.unprocessed).to.deep.equal([]);
    });

    it('should handle large batch sizes', async () => {
      const keys = Array.from({ length: 100 }, (_, i) => ({
        mockEntityModelId: `ef39921f-9a02-41db-b491-02c98987d${i.toString().padStart(3, '0')}`,
      }));
      const mockRecords = keys
        .map((key) => ({ ...mockRecord, mockEntityModelId: key.mockEntityModelId }));

      const mockElectroResult = {
        data: mockRecords,
        unprocessed: [],
      };

      mockElectroService.entities.mockEntityModel.get.returns({
        go: stub().resolves(mockElectroResult),
      });

      const result = await baseCollectionInstance.batchGetByKeys(keys);

      expect(result.data).to.have.length(100);
      expect(result.unprocessed).to.have.length(0);
      expect(mockElectroService.entities.mockEntityModel.get).to.have.been.calledOnce;
    });

    it('should handle mixed valid and invalid keys', async () => {
      const keys = [
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        'not-an-object',
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
        null,
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d958' },
      ];

      await expect(baseCollectionInstance.batchGetByKeys(keys)).to.be.rejectedWith(DataAccessError);
    });

    it('should log error and throw DataAccessError on validation failure', async () => {
      const keys = [
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { invalidKey: 'invalid-format' },
      ];

      await expect(baseCollectionInstance.batchGetByKeys(keys)).to.be.rejectedWith(DataAccessError);
    });

    it('should support attributes option', async () => {
      const keys = [
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
      ];
      const mockRecords = [
        { ...mockRecord, mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
      ];

      const mockElectroResult = {
        data: mockRecords,
        unprocessed: [],
      };

      const goStub = stub().resolves(mockElectroResult);
      mockElectroService.entities.mockEntityModel.get.returns({
        go: goStub,
      });

      const result = await baseCollectionInstance.batchGetByKeys(keys, { attributes: ['mockEntityModelId', 'name'] });

      expect(result.data).to.have.length(1);
      expect(goStub).to.have.been.calledOnceWith({ attributes: ['mockEntityModelId', 'name'] });
    });

    it('should work without options (backward compatibility)', async () => {
      const keys = [
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
      ];
      const mockRecords = [
        { ...mockRecord, mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
      ];

      const mockElectroResult = {
        data: mockRecords,
        unprocessed: [],
      };

      const goStub = stub().resolves(mockElectroResult);
      mockElectroService.entities.mockEntityModel.get.returns({
        go: goStub,
      });

      const result = await baseCollectionInstance.batchGetByKeys(keys);

      expect(result.data).to.have.length(1);
      expect(goStub).to.have.been.calledOnceWith({});
    });
  });

  describe('removeByIndexKeys', () => {
    let mockDeleteQuery;

    beforeEach(() => {
      mockDeleteQuery = {
        go: stub().resolves(),
      };
      mockElectroService.entities.mockEntityModel.delete = stub().returns(mockDeleteQuery);
    });

    it('should remove records using array of single key objects', async () => {
      const keys = [{ someKey: 'test-value' }];

      await baseCollectionInstance.removeByIndexKeys(keys);

      expect(mockElectroService.entities.mockEntityModel.delete).to.have.been.calledOnceWith(keys);
      expect(mockDeleteQuery.go).to.have.been.calledOnce;
      expect(mockLogger.info).to.have.been.calledWith(`Removed ${keys.length} items for [mockEntityModel]`);
    });

    it('should remove records using array of composite key objects', async () => {
      const keys = [{ someKey: 'test-value', someOtherKey: 123 }];

      await baseCollectionInstance.removeByIndexKeys(keys);

      expect(mockElectroService.entities.mockEntityModel.delete).to.have.been.calledOnceWith(keys);
      expect(mockDeleteQuery.go).to.have.been.calledOnce;
    });

    it('should remove records using array of multiple key objects', async () => {
      const keys = [
        { someKey: 'test-value-1' },
        { someKey: 'test-value-2' },
      ];

      await baseCollectionInstance.removeByIndexKeys(keys);

      expect(mockElectroService.entities.mockEntityModel.delete).to.have.been.calledOnceWith(keys);
      expect(mockDeleteQuery.go).to.have.been.calledOnce;
      expect(mockLogger.info).to.have.been.calledWith(`Removed ${keys.length} items for [mockEntityModel]`);
    });

    it('should invalidate cache after successful removal', async () => {
      const keys = [{ someKey: 'test-value' }];

      await baseCollectionInstance.removeByIndexKeys(keys);

      // Cache invalidation happens internally, just verify the method completes successfully
      expect(mockElectroService.entities.mockEntityModel.delete).to.have.been.calledOnceWith(keys);
      expect(mockDeleteQuery.go).to.have.been.calledOnce;
    });

    it('should throw DataAccessError when keys is null', async () => {
      await expect(baseCollectionInstance.removeByIndexKeys(null))
        .to.be.rejectedWith(DataAccessError, 'keys must be a non-empty array');

      expect(mockLogger.error).to.have.been.calledWith(
        'Failed to remove by index keys [mockEntityModel]: keys must be a non-empty array',
      );
    });

    it('should throw DataAccessError when keys is undefined', async () => {
      await expect(baseCollectionInstance.removeByIndexKeys(undefined))
        .to.be.rejectedWith(DataAccessError, 'keys must be a non-empty array');
    });

    it('should throw DataAccessError when keys is not an array', async () => {
      await expect(baseCollectionInstance.removeByIndexKeys({ someKey: 'test-value' }))
        .to.be.rejectedWith(DataAccessError, 'keys must be a non-empty array');
    });

    it('should throw DataAccessError when keys is empty array', async () => {
      await expect(baseCollectionInstance.removeByIndexKeys([]))
        .to.be.rejectedWith(DataAccessError, 'keys must be a non-empty array');
    });

    it('should throw DataAccessError when array contains empty objects', async () => {
      await expect(baseCollectionInstance.removeByIndexKeys([{}]))
        .to.be.rejectedWith(DataAccessError, 'key must be a non-empty object');

      expect(mockLogger.error).to.have.been.calledWith(
        'Failed to remove by index keys [mockEntityModel]: key must be a non-empty object',
      );
    });

    it('should throw DataAccessError when array contains null values', async () => {
      await expect(baseCollectionInstance.removeByIndexKeys([null]))
        .to.be.rejectedWith(DataAccessError, 'key must be a non-empty object');
    });

    it('should handle database errors gracefully', async () => {
      const keys = [{ someKey: 'test-value' }];
      const dbError = new Error('Database connection failed');
      mockDeleteQuery.go.rejects(dbError);

      await expect(baseCollectionInstance.removeByIndexKeys(keys))
        .to.be.rejectedWith(DataAccessError, 'Failed to remove by index keys');

      // The error logging uses the format "Base Collection Error [entityName]"
      expect(mockLogger.error).to.have.been.calledWith(
        'Base Collection Error [mockEntityModel]',
        sinon.match.instanceOf(DataAccessError),
      );
    });

    it('should handle validation-style errors from legacy entity path', async () => {
      const keys = [{ someKey: 'test-value' }];
      const validationError = new Error('Invalid key format');
      validationError.name = 'ElectroValidationError';
      mockDeleteQuery.go.rejects(validationError);

      await expect(baseCollectionInstance.removeByIndexKeys(keys))
        .to.be.rejectedWith(DataAccessError, 'Failed to remove by index keys');
    });

    it('should log successful removal with correct count for array', async () => {
      const keys = [
        { someKey: 'test-value-1' },
        { someKey: 'test-value-2' },
        { someKey: 'test-value-3' },
      ];

      await baseCollectionInstance.removeByIndexKeys(keys);

      expect(mockLogger.info).to.have.been.calledWith(
        `Removed ${keys.length} items for [mockEntityModel]`,
      );
    });

    it('should work with complex composite keys', async () => {
      const keys = [{
        partitionKey: 'partition-value',
        sortKey: 'sort-value',
        gsiKey: 'gsi-value',
      }];

      await baseCollectionInstance.removeByIndexKeys(keys);

      expect(mockElectroService.entities.mockEntityModel.delete).to.have.been.calledOnceWith(keys);
      expect(mockDeleteQuery.go).to.have.been.calledOnce;
    });

    it('should handle mixed key types in array', async () => {
      const keys = [
        { someKey: 'string-value' },
        { someOtherKey: 123 },
        { someKey: 'another-string', someOtherKey: 456 },
      ];

      await baseCollectionInstance.removeByIndexKeys(keys);

      expect(mockElectroService.entities.mockEntityModel.delete).to.have.been.calledOnceWith(keys);
      expect(mockDeleteQuery.go).to.have.been.calledOnce;
    });

    it('should work with boolean values in keys', async () => {
      const keys = [{ isActive: true, isDeleted: false }];

      await baseCollectionInstance.removeByIndexKeys(keys);

      expect(mockElectroService.entities.mockEntityModel.delete).to.have.been.calledOnceWith(keys);
      expect(mockDeleteQuery.go).to.have.been.calledOnce;
    });

    it('should work with date values in keys', async () => {
      const testDate = new Date('2024-01-01T00:00:00Z');
      const keys = [{ createdAt: testDate }];

      await baseCollectionInstance.removeByIndexKeys(keys);

      expect(mockElectroService.entities.mockEntityModel.delete).to.have.been.calledOnceWith(keys);
      expect(mockDeleteQuery.go).to.have.been.calledOnce;
    });

    it('should preserve key order in deletion call', async () => {
      const keys = [{
        firstKey: 'first-value',
        secondKey: 'second-value',
        thirdKey: 'third-value',
      }];

      await baseCollectionInstance.removeByIndexKeys(keys);

      const deleteCall = mockElectroService.entities.mockEntityModel.delete.getCall(0);
      expect(deleteCall.args[0]).to.deep.equal(keys);
    });

    it('should validate each key object in the array', async () => {
      const keys = [
        { someKey: 'valid-key' },
        {}, // This should cause an error
      ];

      await expect(baseCollectionInstance.removeByIndexKeys(keys))
        .to.be.rejectedWith(DataAccessError, 'key must be a non-empty object');
    });

    it('should remove by single-field keys via PostgREST bulk in() query', async () => {
      const inStub = stub().resolves({ error: null });
      const fromStub = stub().returns({
        delete: stub().returns({
          in: inStub,
        }),
      });
      const postgrestService = { from: fromStub };
      const instance = createInstance(
        postgrestService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );
      const keys = [
        { someKey: 'test-value-1' },
        { someKey: 'test-value-2' },
      ];

      await instance.removeByIndexKeys(keys);

      expect(fromStub).to.have.been.calledOnceWithExactly(instance.tableName);
      expect(inStub).to.have.been.calledOnceWithExactly('some_key', ['test-value-1', 'test-value-2']);
      expect(mockLogger.info).to.have.been.calledWith(`Removed ${keys.length} items for [mockEntityModel]`);
    });

    it('should remove by keys via PostgREST service when entity proxy is unavailable', async () => {
      const query = {
        error: null,
        eq: stub().callsFake(() => query),
      };
      const fromStub = stub().returns({
        delete: stub().returns(query),
      });
      const postgrestService = { from: fromStub };
      const instance = createInstance(
        postgrestService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );
      const keys = [{ someKey: 'test-value', someOtherKey: 42 }];

      await instance.removeByIndexKeys(keys);

      expect(fromStub).to.have.been.calledOnceWithExactly(instance.tableName);
      expect(query.eq).to.have.been.calledWith('some_key', 'test-value');
      expect(query.eq).to.have.been.calledWith('some_other_key', 42);
      expect(mockLogger.info).to.have.been.calledWith(`Removed ${keys.length} items for [mockEntityModel]`);
    });

    it('should throw when PostgREST removeByIndexKeys returns an error', async () => {
      const query = {
        error: new Error('delete failed'),
        eq: stub().callsFake(() => query),
      };
      const fromStub = stub().returns({
        delete: stub().returns(query),
      });
      const postgrestService = { from: fromStub };
      const instance = createInstance(
        postgrestService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      await expect(instance.removeByIndexKeys([{ someKey: 'test-value' }]))
        .to.be.rejectedWith(DataAccessError, 'Failed to remove by index keys');
    });

    it('should throw when PostgREST bulk delete returns an error payload', async () => {
      const inStub = stub().resolves({ error: new Error('bulk delete failed') });
      const fromStub = stub().returns({
        delete: stub().returns({
          in: inStub,
        }),
      });
      const postgrestService = { from: fromStub };
      const instance = createInstance(
        postgrestService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      await expect(instance.removeByIndexKeys([{ someKey: 'test-value' }]))
        .to.be.rejectedWith(DataAccessError, 'Failed to remove by index keys');
      expect(inStub).to.have.been.calledOnceWithExactly('some_key', ['test-value']);
    });

    it('should throw when PostgREST per-key delete query returns an error payload', async () => {
      const query = {
        eq: stub().callsFake(() => query),
        then: (resolve) => resolve({ error: new Error('per-key delete failed') }),
      };
      const fromStub = stub().returns({
        delete: stub().returns(query),
      });
      const postgrestService = { from: fromStub };
      const instance = createInstance(
        postgrestService,
        mockEntityRegistry,
        mockIndexes,
        mockLogger,
      );

      await expect(instance.removeByIndexKeys([{ someKey: 'a', someOtherKey: 1 }]))
        .to.be.rejectedWith(DataAccessError, 'Failed to remove by index keys');
      expect(query.eq).to.have.been.calledWith('some_key', 'a');
      expect(query.eq).to.have.been.calledWith('some_other_key', 1);
    });
  });

  describe('postgrest mode', () => {
    const richAttributes = {
      someKey: { type: 'string', required: true },
      someOtherKey: { type: 'number', default: 7 },
      isActive: { type: 'boolean', default: false },
      tags: { type: 'list', default: () => ['default'] },
      metadata: { type: 'map', default: () => ({ source: 'unit' }) },
      mode: { type: ['A', 'B'], default: 'A' },
      computed: { type: 'string', set: (_, record) => `${record.someKey}-computed` },
      watchedValue: {
        type: 'number',
        watch: ['someOtherKey'],
        set: (value) => (value || 0) + 1,
      },
      watchedAll: {
        type: 'string',
        watch: '*',
        set: (_, record) => `${record.someKey}-${record.someOtherKey}`,
      },
      validateFalse: { type: 'string', validate: () => false },
      validateThrows: { type: 'string', validate: () => { throw new Error('validation throws'); } },
    };

    const richIndexes = {
      primary: {
        index: 'primary',
        pk: { facets: ['someKey'] },
        sk: { facets: ['someOtherKey'] },
      },
      bySomeKey: {
        index: 'bySomeKey',
        pk: { facets: ['someKey'] },
        sk: { facets: ['someOtherKey'] },
      },
      all: { index: 'all', indexType: 'all' },
    };

    const createPostgrestQuery = (responses) => {
      const queue = Array.isArray(responses) ? [...responses] : [responses];
      const query = {
        select: stub().returnsThis(),
        order: stub().returnsThis(),
        eq: stub().returnsThis(),
        in: stub().returnsThis(),
        gte: stub().returnsThis(),
        lte: stub().returnsThis(),
        range: stub().returnsThis(),
        contains: stub().returnsThis(),
        then: (onFulfilled, onRejected) => Promise
          .resolve(queue.shift() || { data: [], error: null })
          .then(onFulfilled, onRejected),
      };
      return query;
    };

    it('queries PostgREST with filters and returns cursor payload', async () => {
      const query = createPostgrestQuery({
        data: [
          { some_key: 'a', some_other_key: 1, computed: 'a-computed' },
          { some_key: 'a', some_other_key: 2, computed: 'a-computed' },
        ],
        error: null,
      });
      const fromStub = stub().returns({
        select: stub().returns(query),
      });

      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const result = await instance.allByIndexKeys(
        { someKey: 'a', someOtherKey: 1 },
        {
          attributes: ['someKey'],
          between: { attribute: 'someOtherKey', start: 1, end: 2 },
          where: (attr, op) => op.eq(attr.someKey, 'a'),
          order: 'asc',
          limit: 2,
          returnCursor: true,
          fetchAllPages: false,
        },
      );

      expect(result.data).to.have.length(2);
      expect(result.data[0].record.someKey).to.equal('a');
      expect(result.cursor).to.be.a('string');
      expect(query.order.callCount).to.equal(2);
      expect(query.order.getCall(0)).to.have.been.calledWithExactly('some_key', { ascending: true });
      expect(query.order.getCall(1)).to.have.been.calledWithExactly('some_other_key', { ascending: true });
      expect(query.range).to.have.been.calledOnceWithExactly(0, 1);
    });

    it('applies model getters on DB records and warns on getter failures', async () => {
      const query = createPostgrestQuery({
        data: [{ some_key: 'abc', throwing_get: 'x' }],
        error: null,
      });
      const fromStub = stub().returns({
        select: stub().returns(query),
      });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        {
          someKey: {
            type: 'string',
            get: (value) => value.toUpperCase(),
          },
          throwingGet: {
            type: 'string',
            get: () => {
              throw new Error('getter failed');
            },
          },
        },
      );

      const result = await instance.allByIndexKeys({ someKey: 'abc' }, { fetchAllPages: false });
      expect(result).to.have.length(1);
      expect(result[0].record.someKey).to.equal('ABC');
      expect(result[0].record.throwingGet).to.equal('x');
      expect(mockLogger.warn).to.have.been.calledWithMatch(
        'Failed to apply getter for throwingGet on [mockEntityModel]',
      );
    });

    it('skips getter invocation when mapped value is undefined', async () => {
      const maybeGet = stub().returns('SHOULD_NOT_BE_USED');
      const query = createPostgrestQuery({
        data: [{ some_key: 'abc' }],
        error: null,
      });
      const fromStub = stub().returns({
        select: stub().returns(query),
      });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        {
          someKey: { type: 'string' },
          optionalValue: {
            type: 'string',
            get: maybeGet,
          },
        },
      );

      const result = await instance.allByIndexKeys({ someKey: 'abc' }, { fetchAllPages: false });
      expect(result).to.have.length(1);
      expect(result[0].record.optionalValue).to.be.undefined;
      expect(maybeGet.called).to.equal(false);
    });

    it('queries all PostgREST rows without key filters when sort keys are omitted', async () => {
      const query = createPostgrestQuery({
        data: [{ some_key: 'a', some_other_key: 1 }],
        error: null,
      });
      const fromStub = stub().returns({
        select: stub().returns(query),
      });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const result = await instance.all(undefined, { fetchAllPages: false });
      expect(result).to.have.length(1);
      expect(query.eq.callCount).to.equal(0);
    });

    it('uses ilike instead of eq for attributes with caseInsensitive flag', async () => {
      const query = createPostgrestQuery({
        data: [{ some_key: 'ABC', some_other_key: 1 }],
        error: null,
      });
      query.ilike = stub().returnsThis();
      const fromStub = stub().returns({
        select: stub().returns(query),
      });

      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        {
          someKey: { type: 'string', caseInsensitive: true },
          someOtherKey: { type: 'number' },
        },
      );

      await instance.allByIndexKeys(
        { someKey: 'abc', someOtherKey: 1 },
        { fetchAllPages: false },
      );

      expect(query.ilike).to.have.been.calledOnceWith('some_key', 'abc');
      expect(query.eq).to.have.been.calledOnceWith('some_other_key', 1);
    });

    it('does not append duplicate id ordering when id is already part of index order', async () => {
      const query = createPostgrestQuery({
        data: [{ mock_entity_model_id: 'id-1' }],
        error: null,
      });
      const fromStub = stub().returns({
        select: stub().returns(query),
      });

      const indexesWithIdSort = {
        primary: {
          index: 'primary',
          pk: { facets: ['mockEntityModelId'] },
          sk: { facets: [] },
        },
      };

      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        indexesWithIdSort,
        mockLogger,
        {
          mockEntityModelId: { type: 'string', required: true },
        },
      );

      await instance.allByIndexKeys(
        { mockEntityModelId: 'id-1' },
        { fetchAllPages: false, order: 'desc' },
      );

      expect(query.order.callCount).to.equal(1);
      expect(query.order.getCall(0)).to.have.been.calledWithExactly('id', { ascending: false });
    });

    it('fetches all pages in PostgREST mode', async () => {
      const query = createPostgrestQuery([
        {
          data: [
            { some_key: 'a', some_other_key: 1 },
            { some_key: 'a', some_other_key: 2 },
          ],
          error: null,
        },
        {
          data: [
            { some_key: 'a', some_other_key: 3 },
            { some_key: 'a', some_other_key: 4 },
          ],
          error: null,
        },
        { data: [], error: null },
      ]);
      const fromStub = stub().returns({
        select: stub().returns(query),
      });

      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const result = await instance.allByIndexKeys(
        { someKey: 'a' },
        { fetchAllPages: true, limit: 2, returnCursor: true },
      );

      expect(result.data).to.have.length(4);
      expect(result.cursor).to.equal(null);
      expect(query.range).to.have.callCount(3);
    });

    it('uses PostgREST path for findById, existsById and batchGetByKeys', async () => {
      const query = createPostgrestQuery([
        { data: [{ some_key: 'id-1', some_other_key: 1 }], error: null },
        { data: [{ some_key: 'id-1', some_other_key: 1 }], error: null },
        { data: [{ some_key: 'id-1', some_other_key: 1 }], error: null },
        { data: [], error: null },
      ]);
      const fromStub = stub().returns({
        select: stub().returns(query),
      });

      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const found = await instance.findById('ef39921f-9a02-41db-b491-02c98987d956');
      expect(found).to.not.be.null;

      const exists = await instance.existsById('ef39921f-9a02-41db-b491-02c98987d956');
      expect(exists).to.equal(true);

      const batch = await instance.batchGetByKeys([
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d957' },
      ]);
      expect(batch.data).to.have.length(1);
      expect(batch.unprocessed).to.deep.equal([]);
      expect(query.in).to.have.been.calledOnceWithExactly(
        'mock_entity_model_id',
        [
          'ef39921f-9a02-41db-b491-02c98987d956',
          'ef39921f-9a02-41db-b491-02c98987d957',
        ],
      );
    });

    it('throws on non-invalid bulk errors in PostgREST batchGetByKeys', async () => {
      const bulkQuery = {
        select: stub().returnsThis(),
        in: stub().returnsThis(),
        then: (onFulfilled, onRejected) => Promise.resolve({
          data: null,
          error: { code: 'XX000', message: 'db exploded' },
        }).then(onFulfilled, onRejected),
      };
      const fromStub = stub().returns({ select: stub().returns(bulkQuery) });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      await expect(instance.batchGetByKeys([
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
      ])).to.be.rejectedWith(DataAccessError, 'Failed to batch get by keys');
    });

    it('falls back to per-key batch lookup on invalid bulk input', async () => {
      const bulkQuery = {
        select: stub().returnsThis(),
        in: stub().returnsThis(),
        then: (onFulfilled, onRejected) => Promise.resolve({
          data: null,
          error: { code: '22P02', message: 'invalid input syntax' },
        }).then(onFulfilled, onRejected),
      };

      const pageQuery = createPostgrestQuery([
        { data: [{ some_key: 'id-1', some_other_key: 1 }], error: null },
        { data: [], error: null },
      ]);

      const fromStub = stub()
        .onCall(0)
        .returns({ select: stub().returns(bulkQuery) })
        .onCall(1)
        .returns({ select: stub().returns(pageQuery) })
        .onCall(2)
        .returns({ select: stub().returns(pageQuery) });

      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const batch = await instance.batchGetByKeys([
        { mockEntityModelId: 'ef39921f-9a02-41db-b491-02c98987d956' },
        { mockEntityModelId: 'not-a-uuid' },
      ]);

      expect(batch.data).to.have.length(1);
      expect(batch.unprocessed).to.deep.equal([]);
      expect(bulkQuery.in).to.have.been.calledOnce;
    });

    it('ignores invalid-input per-key lookup errors in batch fallback', async () => {
      const fromStub = stub().returns({
        select: stub().returns(createPostgrestQuery({ data: null, error: { code: '22P02' } })),
      });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );
      const findByIndexKeysStub = sinon.stub(instance, 'findByIndexKeys');
      findByIndexKeysStub
        .onFirstCall()
        .rejects(new DataAccessError('invalid input', instance, { code: '22P02' }))
        .onSecondCall()
        .resolves({ record: { someKey: 'ok' } });

      const result = await instance.batchGetByKeys([
        { someKey: 'bad', someOtherKey: 1 },
        { someKey: 'ok', someOtherKey: 2 },
      ]);

      expect(result.data).to.have.length(1);
      expect(result.data[0].record.someKey).to.equal('ok');
      expect(result.unprocessed).to.deep.equal([]);
    });

    it('propagates non-invalid per-key lookup errors in batch fallback', async () => {
      const fromStub = stub().returns({
        select: stub().returns(createPostgrestQuery({ data: null, error: { code: '22P02' } })),
      });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );
      sinon.stub(instance, 'findByIndexKeys').rejects(new Error('unexpected lookup failure'));

      await expect(instance.batchGetByKeys([{ someKey: 'x', someOtherKey: 1 }]))
        .to.be.rejectedWith(DataAccessError, 'Failed to batch get by keys');
    });

    it('creates with insert and upsert in PostgREST mode', async () => {
      const maybeSingle = stub()
        .onFirstCall()
        .resolves({ data: { some_key: 'a', some_other_key: 7 }, error: null })
        .onSecondCall()
        .resolves({ data: { some_key: 'b', some_other_key: 9 }, error: null });
      const select = stub().returns({ maybeSingle });
      const insert = stub().returns({ select });
      const upsert = stub().returns({ select });
      const fromStub = stub().returns({
        insert,
        upsert,
      });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const created = await instance.create({ someKey: 'a' });
      expect(created.record.someOtherKey).to.equal(7);
      expect(insert).to.have.been.calledOnce;

      const upserted = await instance.create(
        { someKey: 'b', someOtherKey: 9 },
        { upsert: true },
      );
      expect(upserted.record.someKey).to.equal('b');
      expect(upsert).to.have.been.calledOnce;
    });

    it('validates create payload errors for PostgREST mode', async () => {
      const fromStub = stub().returns({
        insert: stub().returns({
          select: stub().returns({
            maybeSingle: stub().resolves({ data: {}, error: null }),
          }),
        }),
      });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const invalidCases = [
        {},
        { someKey: 1 },
        { someKey: 'x', someOtherKey: 'bad' },
        { someKey: 'x', isActive: 'bad' },
        { someKey: 'x', tags: 'bad' },
        { someKey: 'x', metadata: 'bad' },
        { someKey: 'x', mode: 'C' },
        { someKey: 'x', validateFalse: 'v' },
        { someKey: 'x', validateThrows: 'v' },
      ];

      await Promise.all(invalidCases.map(async (item) => {
        await expect(instance.create(item)).to.be.rejectedWith(DataAccessError);
      }));
    });

    it('creates many in PostgREST mode with validation split', async () => {
      const select = stub().resolves({ error: null });
      const insert = stub().returns({ select });
      const fromStub = stub().returns({ insert });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const result = await instance.createMany([
        { someKey: 'valid-1' },
        { someKey: 123 },
      ]);

      expect(result.createdItems).to.have.length(1);
      expect(result.errorItems).to.have.length(1);
      expect(select).to.have.been.calledOnce;
    });

    it('associates parent on PostgREST createMany rows and warns on invalid parent links', async () => {
      const select = stub().resolves({
        data: [
          { mock_entity_model_id: 'parent-1', some_key: 'valid', some_other_key: 1 },
          { mock_entity_model_id: 'parent-2', some_key: 'invalid', some_other_key: 2 },
        ],
        error: null,
      });
      const insert = stub().returns({ select });
      const fromStub = stub().returns({ insert });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );
      const parent = {
        entityName: 'mockEntityModel',
        record: { mockEntityModelId: 'parent-1' },
        schema: { getModelName: () => 'MockEntityModel' },
      };

      const result = await instance.createMany([
        { someKey: 'valid', someOtherKey: 1 },
        { someKey: 'invalid', someOtherKey: 2 },
      ], parent);

      expect(result.createdItems).to.have.length(2);
      expect(result.createdItems[0]._accessorCache.getMockEntityModel).to.equal(parent);
      expect(result.createdItems[1]._accessorCache.getMockEntityModel).to.be.undefined;
      expect(mockLogger.warn).to.have.been.calledWith(
        'Failed to associate parent with child [mockEntityModel]: parent is invalid',
      );
    });

    it('updates by keys and saveMany in PostgREST mode', async () => {
      const maybeSingle = stub().resolves({ data: { some_key: 'a' }, error: null });
      const updateQuery = {
        eq: stub().returnsThis(),
        select: stub().returns({ maybeSingle }),
      };
      const update = stub().returns(updateQuery);
      const upsert = stub().resolves({ error: null });
      const fromStub = stub().returns({
        update,
        upsert,
      });
      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      await instance.updateByKeys({ someKey: 'a' }, { someOtherKey: 3 });
      expect(update).to.have.been.calledOnce;
      expect(updateQuery.eq).to.have.been.calledWith('some_key', 'a');

      const withComposite = {
        record: { someKey: 'a', someOtherKey: 3 },
        generateCompositeKeys: () => ({ someKey: 'a', someOtherKey: 3 }),
      };
      const withoutComposite = {
        record: { someKey: 'b', someOtherKey: 4 },
        getId: () => 'b',
      };
      await instance._saveMany([withComposite, withoutComposite]);
      expect(update.callCount).to.equal(1);
      expect(upsert.calledOnce).to.be.true;
    });

    it('updates in-memory updatedAt for saveMany in PostgREST mode', async () => {
      const before = '2026-01-01T00:00:00.000Z';
      const upsert = stub().resolves({ error: null });
      const attributesWithUpdatedAt = {
        ...richAttributes,
        updatedAt: {
          type: 'string',
          watch: '*',
          set: () => new Date().toISOString(),
        },
      };
      const instance = createInstance(
        { from: stub().returns({ upsert }) },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        attributesWithUpdatedAt,
      );
      const model = {
        record: { someKey: 'a', someOtherKey: 1, updatedAt: before },
        getId: () => 'a',
      };

      await instance._saveMany([model]);

      expect(model.record.updatedAt).to.not.equal(before);
      expect(upsert.calledOnce).to.be.true;
    });

    it('throws DataAccessError when PostgREST upsert fails in saveMany', async () => {
      const upsert = stub().resolves({ error: new Error('bulk upsert failed') });
      const instance = createInstance(
        { from: stub().returns({ upsert }) },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );
      const model = {
        record: { someKey: 'a', someOtherKey: 1 },
        getId: () => 'a',
      };

      await expect(instance._saveMany([model]))
        .to.be.rejectedWith(DataAccessError, 'Failed to save many');
    });

    it('covers PostgREST query edge paths and errors', async () => {
      const goodQuery = createPostgrestQuery({
        data: [{ some_key: 'a', some_other_key: 1 }],
        error: null,
      });
      const errorQuery = createPostgrestQuery({ data: null, error: new Error('query failed') });

      const fromStub = stub()
        .onFirstCall().returns({ select: stub().returns(goodQuery) })
        .onSecondCall()
        .returns({ select: stub().returns(errorQuery) })
        .onThirdCall()
        .returns({ select: stub().returns(goodQuery) });

      const instance = createInstance(
        { from: fromStub },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      await expect(
        instance.allByIndexKeys({ someKey: 'a' }, { index: 'missing-index', fetchAllPages: false }),
      ).to.be.rejectedWith(DataAccessError, 'query proxy [missing-index] not found');

      await expect(
        instance.allByIndexKeys({ someKey: 'a' }, { fetchAllPages: false }),
      ).to.eventually.have.length(1);

      await expect(
        instance.allByIndexKeys({ someKey: 'a' }, { fetchAllPages: false }),
      ).to.be.rejectedWith(DataAccessError, 'Failed to query');
    });

    it('handles create and createMany PostgREST failure paths', async () => {
      const instance = createInstance(
        {
          from: stub().returns({
            insert: stub().returns({
              select: stub().returns({
                maybeSingle: stub().resolves({ data: null, error: new Error('create failed') }),
              }),
            }),
          }),
        },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      await expect(instance.create({ someKey: 'a' }))
        .to.be.rejectedWith(DataAccessError, 'Failed to create');

      const throwingAttributes = {
        ...richAttributes,
        throwingSet: {
          type: 'string',
          set: () => { throw new Error('setter failed'); },
        },
      };

      const instanceWithThrowingSetter = createInstance(
        {
          from: stub().returns({
            insert: stub().returns({
              select: stub().resolves({ error: null }),
            }),
          }),
        },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        throwingAttributes,
      );

      await expect(instanceWithThrowingSetter.createMany([{ someKey: 'a', throwingSet: 'x' }]))
        .to.be.rejectedWith(DataAccessError, 'Failed to create many');

      const instanceWithInsertError = createInstance(
        {
          from: stub().returns({
            insert: stub().returns({
              select: stub().resolves({ error: new Error('insert failed') }),
            }),
          }),
        },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      await expect(instanceWithInsertError.createMany([{ someKey: 'a' }]))
        .to.be.rejectedWith(DataAccessError, 'Failed to create many');
    });

    it('covers createMany parent association branches', async () => {
      const select = stub().resolves({ error: null });
      const insert = stub().returns({ select });
      const instance = createInstance(
        { from: stub().returns({ insert }) },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const validParent = {
        entityName: 'mockEntityModel',
        record: { mockEntityModelId: 'valid-parent-id' },
        schema: { getModelName: () => 'MockEntityModel' },
      };
      const invalidParent = {
        entityName: 'mockEntityModel',
        record: { mockEntityModelId: 'different-parent-id' },
        schema: { getModelName: () => 'MockEntityModel' },
      };

      const payload = [{ someKey: 'a', mockEntityModelId: 'valid-parent-id' }];
      const valid = await instance.createMany(payload, validParent);
      const invalid = await instance.createMany(payload, invalidParent);

      expect(valid.createdItems[0]._accessorCache.getMockEntityModel).to.equal(validParent);
      expect(invalid.createdItems[0]._accessorCache.getMockEntityModel).to.not.equal(invalidParent);
    });

    it('covers updateByKeys entity path and error branches', async () => {
      const patch = {
        set: stub().returnsThis(),
        go: stub().resolves(),
      };
      const instanceWithEntity = createInstance(
        {
          entities: {
            mockEntityModel: {
              patch: stub().returns(patch),
            },
          },
        },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      await instanceWithEntity.updateByKeys({ someKey: 'a' }, { someOtherKey: 1 });
      expect(patch.set).to.have.been.calledOnceWithExactly({ someOtherKey: 1 });
      expect(patch.go).to.have.been.calledOnce;

      await expect(instanceWithEntity.updateByKeys(null, { someOtherKey: 1 }))
        .to.be.rejectedWith(DataAccessError, 'keys and updates are required');

      const instanceWithError = createInstance(
        {
          from: stub().returns({
            update: stub().returns({
              eq: stub().returnsThis(),
              select: stub().returns({
                maybeSingle: stub().resolves({ error: new Error('update failed') }),
              }),
            }),
          }),
        },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      await expect(instanceWithError.updateByKeys({ someKey: 'a' }, { someOtherKey: 2 }))
        .to.be.rejectedWith(DataAccessError, 'Failed to update entity');
    });

    it('covers applyUpdateWatchers empty-update branch', () => {
      const instance = createInstance(
        { from: stub() },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      const result = instance.applyUpdateWatchers({ someKey: 'a' }, {});
      expect(result).to.deep.equal({ record: { someKey: 'a' }, updates: {} });
    });

    it('bumps watched updatedAt when watcher output is not newer', () => {
      const instance = createInstance(
        { from: stub() },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        {
          someKey: { type: 'string' },
          updatedAt: {
            type: 'string',
            watch: '*',
            set: () => '2026-01-01T00:00:00.000Z',
          },
        },
      );

      const result = instance.applyUpdateWatchers(
        { someKey: 'a', updatedAt: '2026-01-01T00:00:00.000Z' },
        { someKey: 'b' },
      );
      expect(result.record.updatedAt).to.equal('2026-01-01T00:00:01.000Z');
      expect(result.updates.updatedAt).to.equal('2026-01-01T00:00:01.000Z');
    });

    it('covers required-field validation branch with non-empty payload', async () => {
      const instance = createInstance(
        {
          from: stub().returns({
            insert: stub().returns({
              select: stub().returns({
                maybeSingle: stub().resolves({ data: {}, error: null }),
              }),
            }),
          }),
        },
        mockEntityRegistry,
        richIndexes,
        mockLogger,
        richAttributes,
      );

      await expect(instance.create({ someOtherKey: 1 }))
        .to.be.rejectedWith(DataAccessError, 'Failed to create');
    });
  });
});
