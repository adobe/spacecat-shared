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

import Opportunity from '../../../../src/v2/models/opportunity.model.js';
import OpportunityCollection from '../../../../src/v2/models/opportunity.collection.js';
import OpportunitySchema from '../../../../src/v2/schema/opportunity.schema.js';

chaiUse(chaiAsPromised);

const opportunityEntity = new Entity(OpportunitySchema);

const mockElectroService = {
  entities: {
    opportunity: {
      model: {
        name: 'opportunity',
        schema: opportunityEntity.model.schema,
        original: {
          references: {},
        },
      },
      query: {
        bySiteId: stub(),
        bySiteIdAndStatus: stub(),
      },
      put: stub(),
    },
  },
};

// OpportunityCollection Unit Tests
describe('OpportunityCollection', () => {
  let opportunityCollectionInstance;
  let mockLogger;
  let mockModelFactory;

  const mockRecord = {
    opportunityId: 'op12345',
    siteId: 'site67890',
    data: {
      foo: 'bar',
      bing: 'batz',
    },
  };
  const mockOpportunityModel = new Opportunity(
    mockElectroService,
    mockModelFactory,
    mockRecord,
    mockLogger,
  );

  beforeEach(() => {
    mockLogger = {
      error: spy(),
      warn: spy(),
    };

    mockModelFactory = {
      getCollection: stub(),
    };

    opportunityCollectionInstance = new OpportunityCollection(
      mockElectroService,
      mockModelFactory,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the OpportunityCollection instance correctly', () => {
      expect(opportunityCollectionInstance).to.be.an('object');
      expect(opportunityCollectionInstance.electroService).to.equal(mockElectroService);
      expect(opportunityCollectionInstance.modelFactory).to.equal(mockModelFactory);
      expect(opportunityCollectionInstance.log).to.equal(mockLogger);
    });
  });

  describe('allBySiteId', () => {
    it('returns an array of Opportunity instances when opportunities exist', async () => {
      const mockFindResults = { data: [mockRecord] };
      mockElectroService.entities.opportunity.query.bySiteId.returns(
        { go: () => Promise.resolve(mockFindResults) },
      );

      const results = await opportunityCollectionInstance.allBySiteId('site67890');
      expect(results).to.be.an('array').that.has.length(1);
      expect(results[0]).to.be.instanceOf(Opportunity);
      expect(results[0].record).to.deep.include(mockOpportunityModel.record);
    });

    it('returns an empty array if no opportunities exist for the given site ID', async () => {
      mockElectroService.entities.opportunity.query.bySiteId.returns(
        { go: () => Promise.resolve([]) },
      );

      const results = await opportunityCollectionInstance.allBySiteId('site67890');
      expect(results).to.be.an('array').that.is.empty;
    });

    it('throws an error if siteId is not provided', async () => {
      await expect(opportunityCollectionInstance.allBySiteId(''))
        .to.be.rejectedWith('SiteId is required');
    });
  });

  describe('allBySiteIdAndStatus', () => {
    it('returns an array of Opportunity instances when opportunities exist', async () => {
      const mockFindResults = { data: [mockRecord] };
      mockElectroService.entities.opportunity.query.bySiteIdAndStatus.returns(
        { go: () => Promise.resolve(mockFindResults) },
      );

      const results = await opportunityCollectionInstance.allBySiteIdAndStatus('site67890', 'IN_PROGRESS');
      expect(results).to.be.an('array').that.has.length(1);
      expect(results[0]).to.be.instanceOf(Opportunity);
      expect(results[0].record).to.deep.include(mockOpportunityModel.record);
    });

    it('returns an empty array if no opportunities exist for the given site ID and status', async () => {
      mockElectroService.entities.opportunity.query.bySiteIdAndStatus.returns(
        { go: () => Promise.resolve([]) },
      );

      const results = await opportunityCollectionInstance.allBySiteIdAndStatus('site67890', 'IN_PROGRESS');
      expect(results).to.be.an('array').that.is.empty;
    });

    it('throws an error if siteId is not provided', async () => {
      await expect(opportunityCollectionInstance.allBySiteIdAndStatus('', 'IN_PROGRESS'))
        .to.be.rejectedWith('SiteId is required');
    });

    it('throws an error if status is not provided', async () => {
      await expect(opportunityCollectionInstance.allBySiteIdAndStatus('site67890', ''))
        .to.be.rejectedWith('Status is required');
    });
  });
});
