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

import Opportunity from '../../../../../src/v2/models/opportunity/opportunity.model.js';
import OpportunityCollection from '../../../../../src/v2/models/opportunity/opportunity.collection.js';
import OpportunitySchema from '../../../../../src/v2/models/opportunity/opportunity.schema.js';

chaiUse(chaiAsPromised);

const opportunityEntity = new Entity(OpportunitySchema);

const mockElectroService = {
  entities: {
    opportunity: {
      model: {
        name: 'opportunity',
        indexes: [],
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
  let mockEntityRegistry;
  let mockOpportunityModel;

  const mockRecord = {
    opportunityId: 'op12345',
    siteId: 'site67890',
    data: {
      foo: 'bar',
      bing: 'batz',
    },
  };

  beforeEach(() => {
    mockLogger = {
      error: spy(),
      warn: spy(),
    };

    mockEntityRegistry = {
      getCollection: stub(),
    };

    mockOpportunityModel = new Opportunity(
      mockElectroService,
      mockEntityRegistry,
      mockRecord,
      mockLogger,
    );

    opportunityCollectionInstance = new OpportunityCollection(
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the OpportunityCollection instance correctly', () => {
      expect(opportunityCollectionInstance).to.be.an('object');
      expect(opportunityCollectionInstance.electroService).to.equal(mockElectroService);
      expect(opportunityCollectionInstance.entityRegistry).to.equal(mockEntityRegistry);
      expect(opportunityCollectionInstance.log).to.equal(mockLogger);

      expect(mockOpportunityModel).to.be.an('object');
    });
  });
});
