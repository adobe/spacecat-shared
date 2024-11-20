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
import { spy, stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import BaseModel from '../../../../src/v2/models/base.model.js';

chaiUse(chaiAsPromised);

const mockElectroService = {
  entities: {
    basemodel: {
      name: 'basemodel',
      model: {
        name: 'basemodel',
      },
      remove: stub(),
      patch: stub(),
    },
  },
};

describe('BaseModel', () => {
  let baseModelInstance;
  let mockLogger;
  let mockModelFactory;

  const mockRecord = {
    basemodelId: '12345',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(() => {
    mockLogger = {
      error: spy(),
    };

    mockModelFactory = {
      getCollection: stub(),
    };

    baseModelInstance = new BaseModel(mockElectroService, mockModelFactory, mockRecord, mockLogger);
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
    it('removes the record and returns the current instance', async () => {
      mockElectroService.entities.basemodel.remove.returns({ go: () => Promise.resolve() });
      await expect(baseModelInstance.remove()).to.eventually.equal(baseModelInstance);
      expect(mockElectroService.entities.basemodel.remove.calledOnce).to.be.true;
      expect(mockLogger.error.notCalled).to.be.true;
    });

    it('logs an error and throws when remove fails', async () => {
      const error = new Error('Remove failed');
      mockElectroService.entities.basemodel.remove.returns({ go: () => Promise.reject(error) });

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

  describe('_getAssociation', () => { /* eslint-disable no-underscore-dangle */
    it('returns the associated model instance when the method is called for the first time', async () => {
      const mockAssociationResult = { id: 'associated-123' };
      const mockModelCollection = {
        findById: stub().returns(Promise.resolve(mockAssociationResult)),
      };

      mockModelFactory.getCollection.returns(mockModelCollection);

      const result = await baseModelInstance._getAssociation('SomeModel', 'findById', 'associated-123');
      expect(result).to.deep.equal(mockAssociationResult);
      expect(mockModelFactory.getCollection.calledOnceWith('SomeModel')).to.be.true;
      expect(mockModelCollection.findById.calledOnceWith('associated-123')).to.be.true;
    });

    it('returns the cached result on subsequent calls with the same arguments', async () => {
      const mockAssociationResult = { id: 'associated-123' };
      const mockModelCollection = {
        findById: stub().returns(Promise.resolve(mockAssociationResult)),
      };

      mockModelFactory.getCollection.returns(mockModelCollection);

      await baseModelInstance._getAssociation('SomeModel', 'findById', 'associated-123');
      const cachedResult = await baseModelInstance._getAssociation('SomeModel', 'findById', 'associated-123');

      expect(cachedResult).to.deep.equal(mockAssociationResult);
      expect(mockModelFactory.getCollection.calledOnceWith('SomeModel')).to.be.true;
      expect(mockModelCollection.findById.calledOnceWith('associated-123')).to.be.true;
    });
  });
});
