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

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { stub } from 'sinon';
import sinonChai from 'sinon-chai';

import Opportunity from '../../../../src/models/opportunity/opportunity.model.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('OpportunityCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    opportunityId: 'op12345',
    siteId: 'site67890',
    auditId: 'audit001',
    title: 'Test Opportunity',
    description: 'This is a test opportunity.',
    runbook: 'http://runbook.url',
    guidance: 'Follow these steps.',
    type: 'SEO',
    status: 'NEW',
    origin: 'ESS_OPS',
    tags: ['tag1', 'tag2'],
    data: {
      additionalInfo: 'info',
    },
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
    } = createElectroMocks(Opportunity, mockRecord));
  });

  describe('constructor', () => {
    it('initializes the OpportunityCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('create', () => {
    it('throws ValidationError when scopeType is set but scopeId is absent', async () => {
      await expect(
        instance.create({ type: 'content', scopeType: 'brand' }),
      ).to.be.rejectedWith('scopeType and scopeId must both be set or both be absent');
    });

    it('throws ValidationError when scopeId is set but scopeType is absent', async () => {
      await expect(
        instance.create({ type: 'content', scopeId: '11111111-1111-1111-1111-111111111111' }),
      ).to.be.rejectedWith('scopeType and scopeId must both be set or both be absent');
    });

    it('passes co-presence check when both scopeType and scopeId are set', async () => {
      // Co-presence check passes — mock create succeeds without complaining.
      await expect(
        instance.create({ scopeType: 'brand', scopeId: '11111111-1111-1111-1111-111111111111' }),
      ).to.be.fulfilled;
    });

    it('passes co-presence check when neither scopeType nor scopeId is set', async () => {
      // Neither present — co-presence check passes and mock create succeeds.
      await expect(
        instance.create({ type: 'content' }),
      ).to.be.fulfilled;
    });

    it('handles null item gracefully by delegating to super.create', async () => {
      // null item: co-presence check skips (both undefined → equal), super.create handles it.
      await expect(instance.create(null)).to.be.rejectedWith(/Failed to create/);
    });
  });

  describe('updateByKeys', () => {
    const KEYS = { opportunityId: 'op12345', siteId: 'site67890' };
    let superUpdateByKeysStub;

    beforeEach(() => {
      // Stub the inherited updateByKeys so the ElectroDB patch chain is not invoked.
      // The co-presence guard runs before super.updateByKeys, so stubbing the super
      // lets us isolate the validation logic without needing a full ElectroDB mock.
      superUpdateByKeysStub = stub(Object.getPrototypeOf(Object.getPrototypeOf(instance)), 'updateByKeys').resolves();
    });

    afterEach(() => {
      superUpdateByKeysStub.restore();
    });

    it('throws ValidationError when updating scopeType without scopeId', async () => {
      await expect(
        instance.updateByKeys(KEYS, { scopeType: 'brand' }),
      ).to.be.rejectedWith('scopeType and scopeId must both be set or both be absent');
    });

    it('throws ValidationError when updating scopeId without scopeType', async () => {
      await expect(
        instance.updateByKeys(KEYS, { scopeId: '11111111-1111-1111-1111-111111111111' }),
      ).to.be.rejectedWith('scopeType and scopeId must both be set or both be absent');
    });

    it('throws ValidationError when clearing only one scope field', async () => {
      await expect(
        instance.updateByKeys(KEYS, { scopeType: null }),
      ).to.be.rejectedWith('scopeType and scopeId must both be set or both be absent');
    });

    it('passes co-presence check when setting both scopeType and scopeId', async () => {
      await expect(
        instance.updateByKeys(KEYS, { scopeType: 'brand', scopeId: '11111111-1111-1111-1111-111111111111' }),
      ).to.be.fulfilled;
    });

    it('passes co-presence check when clearing both scopeType and scopeId', async () => {
      await expect(
        instance.updateByKeys(KEYS, { scopeType: null, scopeId: null }),
      ).to.be.fulfilled;
    });

    it('passes co-presence check when update does not touch scope fields', async () => {
      await expect(
        instance.updateByKeys(KEYS, { title: 'Updated title' }),
      ).to.be.fulfilled;
    });
  });

  describe('schema validate guards', () => {
    it('rejects scopeType values not in SCOPE_TYPES', () => {
      const { scopeType } = schema.getAttributes();
      expect(scopeType.validate('page')).to.be.false;
      expect(scopeType.validate('brand')).to.be.true;
      expect(scopeType.validate(null)).to.be.true;
    });

    it('rejects scopeId values that are not valid UUIDs', () => {
      const { scopeId } = schema.getAttributes();
      expect(scopeId.validate('not-a-uuid')).to.be.false;
      expect(scopeId.validate('11111111-1111-1111-1111-111111111111')).to.be.true;
      expect(scopeId.validate(null)).to.be.true;
    });
  });

  describe('allByScope', () => {
    it('throws an error if scopeType is not provided', async () => {
      await expect(instance.allByScope()).to.be.rejectedWith('allByScope: scopeType is required');
    });

    it('throws an error if scopeId is not provided', async () => {
      await expect(instance.allByScope('brand')).to.be.rejectedWith('allByScope: scopeId is required');
    });

    it('delegates to allByIndexKeys with the correct arguments', async () => {
      const mockOpportunity = { getOpportunityId: () => 'op-111' };
      instance.allByIndexKeys = stub().resolves([mockOpportunity]);

      const BRAND_UUID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
      const result = await instance.allByScope('brand', BRAND_UUID);

      expect(instance.allByIndexKeys).to.have.been.calledOnceWith({
        scopeType: 'brand',
        scopeId: BRAND_UUID,
      });
      expect(result).to.deep.equal([mockOpportunity]);
    });

    it('returns an empty array when no opportunities match the scope', async () => {
      instance.allByIndexKeys = stub().resolves([]);

      const result = await instance.allByScope('brand', 'cccccccc-cccc-4ccc-cccc-cccccccccccc');

      expect(result).to.be.an('array').with.lengthOf(0);
    });
  });
});
