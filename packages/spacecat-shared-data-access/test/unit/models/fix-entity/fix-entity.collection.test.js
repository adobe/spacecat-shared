/*
 * Copyright 2025 Adobe. All rights reserved.
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
import sinonChai from 'sinon-chai';

import FixEntity from '../../../../src/models/fix-entity/fix-entity.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('FixEntityCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    fixEntityId: 's12345',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(FixEntity, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the FixEntityCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('FixEntity model constants', () => {
    it('has ORIGINS enum with correct values', () => {
      expect(FixEntity.ORIGINS).to.be.an('object');
      expect(FixEntity.ORIGINS.SPACECAT).to.equal('spacecat');
      expect(FixEntity.ORIGINS.ASO).to.equal('aso');
    });

    it('has STATUSES enum', () => {
      expect(FixEntity.STATUSES).to.be.an('object');
      expect(FixEntity.STATUSES.PENDING).to.equal('PENDING');
      expect(FixEntity.STATUSES.DEPLOYED).to.equal('DEPLOYED');
      expect(FixEntity.STATUSES.PUBLISHED).to.equal('PUBLISHED');
      expect(FixEntity.STATUSES.FAILED).to.equal('FAILED');
      expect(FixEntity.STATUSES.ROLLED_BACK).to.equal('ROLLED_BACK');
    });

    it('ORIGINS enum has exactly 2 values', () => {
      const originValues = Object.values(FixEntity.ORIGINS);
      expect(originValues).to.have.lengthOf(2);
      expect(originValues).to.include.members(['spacecat', 'aso']);
    });

    it('ORIGINS enum keys match expected format', () => {
      const originKeys = Object.keys(FixEntity.ORIGINS);
      expect(originKeys).to.have.lengthOf(2);
      expect(originKeys).to.include.members(['SPACECAT', 'ASO']);
    });
  });
});
