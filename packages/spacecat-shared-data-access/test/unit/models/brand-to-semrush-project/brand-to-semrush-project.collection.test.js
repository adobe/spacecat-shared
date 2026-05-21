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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import BrandToSemrushProject from '../../../../src/models/brand-to-semrush-project/brand-to-semrush-project.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('BrandToSemrushProjectCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    brandId: 'c3e1a4b6-2a8e-4d61-8b03-7d0a1d6b3201',
    semrushProjectId: 'proj-collection-test',
    semrushLocationId: 2840,
    language: 'en',
    updatedBy: 'system',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(BrandToSemrushProject, mockRecord));
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('initializes the BrandToSemrushProjectCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('findBySlice', () => {
    it('delegates to findByIndexKeys with composite key', async () => {
      const expected = { id: 'row-1' };
      const findStub = sinon.stub(instance, 'findByIndexKeys').resolves(expected);

      const result = await instance.findBySlice(
        mockRecord.brandId,
        mockRecord.semrushLocationId,
        mockRecord.language,
      );

      expect(result).to.equal(expected);
      expect(findStub).to.have.been.calledOnceWithExactly({
        brandId: mockRecord.brandId,
        semrushLocationId: mockRecord.semrushLocationId,
        language: mockRecord.language,
      });
    });

    it('returns null when no matching slice exists', async () => {
      sinon.stub(instance, 'findByIndexKeys').resolves(null);

      const result = await instance.findBySlice(
        mockRecord.brandId,
        mockRecord.semrushLocationId,
        mockRecord.language,
      );

      expect(result).to.equal(null);
    });
  });
});
