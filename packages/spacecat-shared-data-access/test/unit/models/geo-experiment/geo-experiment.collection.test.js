/*
 * Copyright 2026 Adobe. All rights reserved.
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
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import GeoExperiment from '../../../../src/models/geo-experiment/geo-experiment.model.js';
import { ValidationError } from '../../../../src/errors/index.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('GeoExperimentCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    geoExperimentId: 'e12345',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(GeoExperiment, mockRecord));
  });

  it('initializes correctly', () => {
    expect(instance).to.be.an('object');
    expect(instance.electroService).to.equal(mockElectroService);
    expect(instance.entityRegistry).to.equal(mockEntityRegistry);
    expect(instance.schema).to.equal(schema);
    expect(instance.log).to.equal(mockLogger);
    expect(model).to.be.an('object');
  });

  describe('findById', () => {
    it('throws ValidationError when id is empty', async () => {
      await expect(instance.findById('')).to.be.rejectedWith(ValidationError);
    });

    it('delegates to findByIndexKeys with valid text id', async () => {
      const mockResult = { getId: () => 'exp-adobe.com-llmo-123' };
      const findByIndexKeysStub = stub(instance, 'findByIndexKeys').resolves(mockResult);

      const result = await instance.findById('exp-adobe.com-llmo-123');

      expect(findByIndexKeysStub).to.have.been.calledOnceWith({ geoExperimentId: 'exp-adobe.com-llmo-123' });
      expect(result).to.equal(mockResult);
    });
  });
});
