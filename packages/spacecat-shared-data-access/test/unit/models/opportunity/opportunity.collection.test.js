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

      const result = await instance.allByScope('brand', 'brand-uuid-123');

      expect(instance.allByIndexKeys).to.have.been.calledOnceWith({
        scopeType: 'brand',
        scopeId: 'brand-uuid-123',
      });
      expect(result).to.deep.equal([mockOpportunity]);
    });

    it('returns an empty array when no opportunities match the scope', async () => {
      instance.allByIndexKeys = stub().resolves([]);

      const result = await instance.allByScope('brand', 'brand-uuid-no-results');

      expect(result).to.be.an('array').with.lengthOf(0);
    });
  });
});
