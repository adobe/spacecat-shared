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
import sinon from 'sinon';

import SiteEnrollment from '../../../../src/models/site-enrollment/site-enrollment.model.js';
import BaseCollection from '../../../../src/models/base/base.collection.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SiteEnrollmentCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    siteId: 'cfa88998-a0a0-4136-b21d-0ff2aa127443',
    entitlementId: '71f85d21-14d2-4e6d-ae9a-b8860082fb6d',
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
    } = createElectroMocks(SiteEnrollment, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the SiteEnrollmentCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('create', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('returns existing enrollment when siteId/entitlementId already exists', async () => {
      const existing = {
        getEntitlementId: () => mockRecord.entitlementId,
      };
      const findByIndexKeysStub = sinon.stub(instance, 'findByIndexKeys').resolves(existing);
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      const result = await instance.create(mockRecord);

      expect(result).to.equal(existing);
      expect(findByIndexKeysStub).to.have.been.calledOnceWithExactly({
        siteId: mockRecord.siteId,
        entitlementId: mockRecord.entitlementId,
      });
      expect(superCreateStub).to.not.have.been.called;
    });

    it('falls back to BaseCollection.create when no matching enrollment exists', async () => {
      sinon.stub(instance, 'findByIndexKeys').resolves(null);
      const superCreateStub = sinon.stub(BaseCollection.prototype, 'create').resolves(model);

      const result = await instance.create(mockRecord, { upsert: true });

      expect(result).to.equal(model);
      expect(superCreateStub).to.have.been.calledOnceWithExactly(mockRecord, { upsert: true });
    });
  });
});
