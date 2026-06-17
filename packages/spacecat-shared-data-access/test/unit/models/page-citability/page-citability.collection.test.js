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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import PageCitability from '../../../../src/models/page-citability/page-citability.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('PageCitabilityCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    url: 'https://example.com/mock',
    siteId: 'ddj34-3434-3434-3434-343434343434',
    citabilityScore: 0.5,
    contentRatio: 0.5,
    wordDifference: 100,
    botWords: 100,
    normalWords: 100,
    updatedBy: 'test@example.com',
    updatedAt: '2022-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(PageCitability, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the PageCitabilityCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('create', () => {
    it('delegates to super.create upserting on the unique url column', async () => {
      // Stub BaseCollection.prototype.create (the super) to capture the delegation args.
      const prototype = Object.getPrototypeOf(Object.getPrototypeOf(instance));
      const superCreateStub = prototype.create;
      const created = { record: mockRecord };
      const createSpy = sinon.stub().resolves(created);
      prototype.create = createSpy;

      try {
        const result = await instance.create(mockRecord);

        expect(result).to.equal(created);
        expect(createSpy).to.have.been.calledOnceWithExactly(
          mockRecord,
          { upsert: true, onConflict: 'url' },
        );
      } finally {
        prototype.create = superCreateStub;
      }
    });
  });

  describe('static constants', () => {
    it('exposes updatedBy source constants', () => {
      expect(PageCitability.DEFAULT_UPDATED_BY).to.equal('spacecat');
      expect(PageCitability.UPDATED_BY_PRERENDER).to.equal('prerender');
      expect(PageCitability.UPDATED_BY_PAGE_CITABILITY).to.equal('page-citability');
    });
  });
});
