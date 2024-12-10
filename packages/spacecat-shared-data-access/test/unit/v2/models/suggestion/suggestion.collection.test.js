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

import SuggestionCollection from '../../../../../src/v2/models/suggestion/suggestion.collection.js';
import Suggestion from '../../../../../src/v2/models/suggestion/suggestion.model.js';
import SuggestionSchema from '../../../../../src/v2/models/suggestion/suggestion.schema.js';

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
  let instance;
  let mockSuggestionModel;
  let mockLogger;
  let mockEntityRegistry;

  const mockRecord = {
    suggestionId: 's12345',
    opportunityId: 'op67890',
    data: {
      title: 'Test Suggestion',
      description: 'This is a test suggestion.',
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

    mockSuggestionModel = new Suggestion(
      mockElectroService,
      mockEntityRegistry,
      mockRecord,
      mockLogger,
    );

    instance = new SuggestionCollection(
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the SuggestionCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.log).to.equal(mockLogger);

      expect(mockSuggestionModel).to.be.an('object');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('updates the status of multiple suggestions', async () => {
      const mockSuggestions = [mockSuggestionModel];
      const mockStatus = 'NEW';

      await instance.bulkUpdateStatus(mockSuggestions, mockStatus);

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
      await expect(instance.bulkUpdateStatus({}, 'NEW'))
        .to.be.rejectedWith('Suggestions must be an array');
    });

    it('throws an error if status is not provided', async () => {
      await expect(instance.bulkUpdateStatus([mockSuggestionModel], 'foo'))
        .to.be.rejectedWith('Invalid status: foo. Must be one of: NEW, APPROVED, SKIPPED, FIXED, ERROR');
    });
  });
});
