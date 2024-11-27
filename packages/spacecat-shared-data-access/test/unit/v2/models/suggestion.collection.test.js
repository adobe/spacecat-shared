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

import SuggestionCollection from '../../../../src/v2/models/suggestion/suggestion.collection.js';
import Suggestion from '../../../../src/v2/models/suggestion/suggestion.model.js';
import SuggestionSchema from '../../../../src/v2/schema/suggestion.schema.js';

chaiUse(chaiAsPromised);

const { attributes } = new Entity(SuggestionSchema).model.schema;

const mockElectroService = {
  entities: {
    suggestion: {
      model: {
        name: 'suggestion',
        schema: { attributes },
        original: {
          references: {},
        },
        indexes: {
          primary: {
            pk: {
              field: 'pk',
              composite: ['suggestionId'],
            },
          },
        },
      },
      query: {
        byOpportunityId: stub(),
        byOpportunityIdAndStatus: stub(),
      },
      put: stub().returns({
        go: stub().resolves({}),
      }),
      patch: stub().returns({
        set: stub(),
      }),
    },
  },
};

// SuggestionCollection Unit Tests
describe('SuggestionCollection', () => {
  let suggestionCollectionInstance;
  let mockLogger;
  let mockModelFactory;

  const mockRecord = {
    suggestionId: 's12345',
    opportunityId: 'op67890',
    data: {
      title: 'Test Suggestion',
      description: 'This is a test suggestion.',
    },
  };
  const mockSuggestionModel = new Suggestion(
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

    suggestionCollectionInstance = new SuggestionCollection(
      mockElectroService,
      mockModelFactory,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the SuggestionCollection instance correctly', () => {
      expect(suggestionCollectionInstance).to.be.an('object');
      expect(suggestionCollectionInstance.electroService).to.equal(mockElectroService);
      expect(suggestionCollectionInstance.modelFactory).to.equal(mockModelFactory);
      expect(suggestionCollectionInstance.log).to.equal(mockLogger);
    });
  });

  describe('allByOpportunityId', () => {
    it('returns the suggestions by opportunity', async () => {
      const mockFindResults = { data: [mockRecord] };
      mockElectroService.entities.suggestion.query.byOpportunityId.returns(
        { go: () => Promise.resolve(mockFindResults) },
      );

      const results = await suggestionCollectionInstance.allByOpportunityId('op67890');
      expect(results).to.be.an('array').that.has.length(1);
      expect(results[0]).to.be.instanceOf(Suggestion);
      expect(results[0].record).to.deep.include(mockSuggestionModel.record);
    });

    it('returns an empty array if no suggestions exist for the given opportunity ID', async () => {
      mockElectroService.entities.suggestion.query.byOpportunityId.returns(
        { go: () => Promise.resolve([]) },
      );

      const results = await suggestionCollectionInstance.allByOpportunityId('op67890');
      expect(results).to.be.an('array').that.is.empty;
    });

    it('throws an error if opportunityId is not provided', async () => {
      await expect(suggestionCollectionInstance.allByOpportunityId(''))
        .to.be.rejectedWith('OpportunityId is required');
    });
  });

  describe('allByOpportunityIdAndStatus', () => {
    it('returns the suggestions by opportunity and status', async () => {
      const mockFindResults = { data: [mockRecord] };
      mockElectroService.entities.suggestion.query.byOpportunityIdAndStatus.returns(
        { go: () => Promise.resolve(mockFindResults) },
      );

      const results = await suggestionCollectionInstance.allByOpportunityIdAndStatus('op67890', 'NEW');
      expect(results).to.be.an('array').that.has.length(1);
      expect(results[0]).to.be.instanceOf(Suggestion);
      expect(results[0].record).to.deep.include(mockSuggestionModel.record);
    });

    it('returns an empty array if no suggestions exist for the given opportunity ID and status', async () => {
      mockElectroService.entities.suggestion.query.byOpportunityIdAndStatus.returns(
        { go: () => Promise.resolve([]) },
      );

      const results = await suggestionCollectionInstance.allByOpportunityIdAndStatus('op67890', 'NEW');
      expect(results).to.be.an('array').that.is.empty;
    });

    it('throws an error if opportunityId is not provided', async () => {
      await expect(suggestionCollectionInstance.allByOpportunityIdAndStatus('', 'NEW'))
        .to.be.rejectedWith('OpportunityId is required');
    });

    it('throws an error if status is not provided', async () => {
      await expect(suggestionCollectionInstance.allByOpportunityIdAndStatus('op67890', ''))
        .to.be.rejectedWith('Status is required');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('updates the status of multiple suggestions', async () => {
      const mockSuggestions = [mockSuggestionModel];
      const mockStatus = 'NEW';

      await suggestionCollectionInstance.bulkUpdateStatus(mockSuggestions, mockStatus);

      expect(mockElectroService.entities.suggestion.put.calledOnce).to.be.true;
      expect(mockElectroService.entities.suggestion.put.firstCall.args[0]).to.deep.equal([{
        suggestionId: 's12345',
        opportunityId: 'op67890',
        data: {
          title: 'Test Suggestion',
          description: 'This is a test suggestion.',
        },
        status: 'NEW',
      }]);
    });

    it('throws an error if suggestions is not an array', async () => {
      await expect(suggestionCollectionInstance.bulkUpdateStatus({}, 'NEW'))
        .to.be.rejectedWith('Suggestions must be an array');
    });

    it('throws an error if status is not provided', async () => {
      await expect(suggestionCollectionInstance.bulkUpdateStatus([mockSuggestionModel], 'foo'))
        .to.be.rejectedWith('Invalid status: foo. Must be one of: NEW, APPROVED, SKIPPED, FIXED, ERROR');
    });
  });
});
