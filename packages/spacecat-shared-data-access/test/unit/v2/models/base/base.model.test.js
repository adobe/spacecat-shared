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
import { Entity } from 'electrodb';
import { spy, stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import BaseModel from '../../../../../src/v2/models/base/base.model.js';
import OpportunitySchema from '../../../../../src/v2/models/opportunity/opportunity.schema.js';
import Reference from '../../../../../src/v2/models/base/reference.js';

chaiUse(chaiAsPromised);

const opportunityEntity = new Entity(OpportunitySchema.toElectroDBSchema());

describe('BaseModel', () => {
  let mockElectroService;
  let baseModelInstance;
  let mockLogger;
  let mockEntityRegistry;

  const mockRecord = {
    opportunityId: '12345',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockLogger = {
      error: spy(),
      info: spy(),
    };

    mockEntityRegistry = {
      getCollection: stub().returns({
        findByIndexKeys: stub().resolves({}),
        allByIndexKeys: stub().resolves([]),
      }),
    };

    mockElectroService = {
      entities: {
        opportunity: {
          entity: opportunityEntity,
          remove: stub().returns({ go: stub().resolves() }),
        },
      },
    };

    baseModelInstance = new BaseModel(
      mockElectroService,
      mockEntityRegistry,
      OpportunitySchema,
      mockRecord,
      mockLogger,
    );
  });

  describe('base', () => {
    it('creates a new instance of BaseModel', () => {
      expect(baseModelInstance).to.be.an.instanceOf(BaseModel);
    });

    it('returns when initializeAttributes has no attributes', () => {
      const originalAttributes = { ...OpportunitySchema.attributes };
      OpportunitySchema.attributes = {};

      const instance = new BaseModel(
        mockElectroService,
        mockEntityRegistry,
        OpportunitySchema,
        {},
        mockLogger,
      );

      expect(instance).to.be.an.instanceOf(BaseModel);

      OpportunitySchema.attributes = originalAttributes;
    });
  });

  describe('getId', () => {
    it('returns the ID of the entity', () => {
      const id = baseModelInstance.getId();
      expect(id).to.equal('12345');
    });
  });

  describe('getCreatedAt', () => {
    it('returns the creation timestamp in ISO format', () => {
      const createdAt = baseModelInstance.getCreatedAt();
      expect(createdAt).to.equal(mockRecord.createdAt);
    });
  });

  describe('getUpdatedAt', () => {
    it('returns the updated timestamp in ISO format', () => {
      const updatedAt = baseModelInstance.getUpdatedAt();
      expect(updatedAt).to.equal(mockRecord.updatedAt);
    });
  });

  describe('remove', () => {
    let dependent;
    let dependents;
    let schema;
    let originalReferences = [];

    beforeEach(() => {
      dependent = { remove: stub().resolves() };
      dependents = [dependent, dependent, dependent];
      originalReferences = [...OpportunitySchema.references];
      schema = OpportunitySchema;

      mockEntityRegistry.getCollection.returns({
        findByIndexKeys: stub().resolves(dependent),
        allByIndexKeys: stub().resolves(dependents),
      });
      mockElectroService.entities.opportunity.remove.returns({ go: () => Promise.resolve() });
    });

    afterEach(() => {
      OpportunitySchema.references = originalReferences;
    });

    it('removes the record and returns the current instance', async () => {
      await expect(baseModelInstance.remove()).to.eventually.equal(baseModelInstance);

      expect(mockElectroService.entities.opportunity.remove.calledOnce).to.be.true;
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it('removes record with dependents', async () => {
      const reference = Reference.fromJSON({
        type: Reference.TYPES.HAS_ONE,
        target: 'SomeModel',
        options: { removeDependent: true },
      });

      schema.references.push(reference);

      await expect(baseModelInstance.remove()).to.eventually.equal(baseModelInstance);

      // self remove
      expect(mockElectroService.entities.opportunity.remove.calledOnce).to.be.true;
      // dependents remove: 3 = has_many, 1 = has_one
      expect(dependent.remove.callCount).to.equal(4);
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it('does not remove dependents if there aren\'t any', async () => {
      schema.references = [];

      await expect(baseModelInstance.remove()).to.eventually.equal(baseModelInstance);

      expect(dependent.remove.notCalled).to.be.true;
    });

    it('does not remove dependents if none are found', async () => {
      schema.references[0].options.removeDependent = true;
      schema.references[1].options.removeDependent = true;
      mockEntityRegistry.getCollection.returns({
        findByIndexKeys: stub().resolves(null),
        allByIndexKeys: stub().resolves([]),
      });

      await expect(baseModelInstance.remove()).to.eventually.equal(baseModelInstance);

      expect(dependent.remove.notCalled).to.be.true;
    });

    it('logs an error and throws when remove fails', async () => {
      const error = new Error('Remove failed');
      mockElectroService.entities.opportunity.remove.returns({ go: () => Promise.reject(error) });

      await expect(baseModelInstance.remove()).to.be.rejectedWith('Remove failed');
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });

  describe('save', () => {
    it('saves the record and returns the current instance', async () => {
      baseModelInstance.patcher.save = stub().returns(Promise.resolve());
      await expect(baseModelInstance.save()).to.eventually.equal(baseModelInstance);
      expect(baseModelInstance.patcher.save.calledOnce).to.be.true;
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it('logs an error and throws when save fails', async () => {
      const error = new Error('Save failed');
      baseModelInstance.patcher.save = stub().returns(Promise.reject(error));

      await expect(baseModelInstance.save()).to.be.rejectedWith('Save failed');
      expect(mockLogger.error.calledOnce).to.be.true;
    });
  });

  describe('_fetchReference', () => { /* eslint-disable no-underscore-dangle */
    it('returns a cached reference if it exists', async () => {
      baseModelInstance._cacheReference('Foo', 'bar');
      const result = await baseModelInstance._fetchReference('has_many', 'Foo');
      expect(result).to.equal('bar');
    });

    it('returns null if belongs_to id is not set', async () => {
      const result = await baseModelInstance._fetchReference('belongs_to', 'Foo');
      expect(result).to.be.null;
    });

    it('returns undefined if the reference does not exist', async () => {
      mockEntityRegistry.getCollection.returns({ allByIndexKeys: stub() });
      const result = await baseModelInstance._fetchReference('has_many', 'Foo');
      expect(result).to.be.undefined;
    });

    it('fetches a belongs_to reference by ID', async () => {
      mockEntityRegistry.getCollection.returns({
        findById: stub().returns('bar'),
        allByIndexKeys: stub().returns(['bar']),
      });
      baseModelInstance.record.fooId = '12345';
      const result = await baseModelInstance._fetchReference('belongs_to', 'Foo');
      expect(result).to.equal('bar');

      expect(await baseModelInstance.getSuggestions()).to.not.throw;
    });

    it('fetches a has_one reference by ID', async () => {
      mockEntityRegistry.getCollection.returns({ findByIndexKeys: stub().returns('bar') });
      baseModelInstance.record.fooId = '12345';
      const result = await baseModelInstance._fetchReference('has_one', 'Foo');
      expect(result).to.equal('bar');
    });

    it('fetches a has_many reference by foreign key', async () => {
      mockEntityRegistry.getCollection.returns({ allByIndexKeys: stub().returns(['bar']) });
      const result = await baseModelInstance._fetchReference('has_many', 'Foo');
      expect(result).to.deep.equal(['bar']);
    });
  });
});
