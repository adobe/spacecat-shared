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

import ModelFactory from '../../../../src/v2/models/base/model.factory.js';

chaiUse(chaiAsPromised);

/**
 * Mock services and logger for unit testing
 */
const mockElectroService = {
  entities: {},
};

const mockLogger = {
  error: spy(),
};

// ModelFactory Unit Tests
describe('ModelFactory', () => {
  let modelFactoryInstance;
  let mockCollectionInstance;

  beforeEach(() => {
    mockCollectionInstance = {
      findById: stub(),
      create: stub(),
    };
    modelFactoryInstance = new ModelFactory(mockElectroService, mockLogger);
  });

  describe('constructor', () => {
    it('initializes the ModelFactory instance correctly', () => {
      expect(modelFactoryInstance).to.be.an('object');
      expect(modelFactoryInstance.service).to.equal(mockElectroService);
      expect(modelFactoryInstance.logger).to.equal(mockLogger);
      expect(modelFactoryInstance.models).to.be.a('map');
    });
  });

  describe('getCollection', () => {
    it('returns an existing collection if already initialized', () => {
      modelFactoryInstance.models.set('TestCollection', mockCollectionInstance);
      const result = modelFactoryInstance.getCollection('TestCollection');
      expect(result).to.equal(mockCollectionInstance);
    });

    it('throws an error if the collection name is not valid', () => {
      expect(() => modelFactoryInstance.getCollection('InvalidCollection'))
        .to.throw('Collection InvalidCollection not found');
    });
  });
});
