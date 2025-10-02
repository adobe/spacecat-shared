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
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { stub, restore } from 'sinon';

import Suggestion from '../../../../src/models/suggestion/suggestion.model.js';
import DataAccessError from '../../../../src/errors/data-access.error.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SuggestionCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    suggestionId: 's12345',
    opportunityId: 'op67890',
    data: {
      title: 'Test Suggestion',
      description: 'This is a test suggestion.',
    },
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Suggestion, mockRecord));
  });

  afterEach(() => {
    restore();
  });

  describe('constructor', () => {
    it('initializes the SuggestionCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('updates the status of multiple suggestions', async () => {
      const mockSuggestions = [model];
      const mockStatus = 'NEW';

      await instance.bulkUpdateStatus(mockSuggestions, mockStatus);

      expect(mockElectroService.entities.suggestion.put.calledOnce).to.be.true;
      const putCallArgs = mockElectroService.entities.suggestion.put.firstCall.args[0];
      expect(putCallArgs).to.be.an('array').with.length(1);
      expect(putCallArgs[0]).to.have.property('suggestionId', 's12345');
      expect(putCallArgs[0]).to.have.property('opportunityId', 'op67890');
      expect(putCallArgs[0]).to.have.property('status', 'NEW');
      expect(putCallArgs[0]).to.have.property('updatedAt').that.is.a('string');
      expect(putCallArgs[0].data).to.deep.equal({
        title: 'Test Suggestion',
        description: 'This is a test suggestion.',
      });

      // Note: updatedAt is updated in the database but not in the local model instances
      // The _saveMany method updates the database records but doesn't modify the model instances
    });

    it('throws an error if suggestions is not an array', async () => {
      await expect(instance.bulkUpdateStatus({}, 'NEW'))
        .to.be.rejectedWith('Suggestions must be an array');
    });

    it('throws an error if status is not provided', async () => {
      await expect(instance.bulkUpdateStatus([model], 'foo'))
        .to.be.rejectedWith('Invalid status: foo. Must be one of: NEW, APPROVED, IN_PROGRESS, SKIPPED, FIXED, ERROR');
    });
  });

  describe('getFixEntitiesBySuggestionId', () => {
    it('should get fix entities for a suggestion', async () => {
      const suggestionId = 'suggestion-123';
      const mockJunctionRecords = [
        { getFixEntityId: () => 'fix-1' },
        { getFixEntityId: () => 'fix-2' },
      ];
      const mockFixEntities = [
        { id: 'fix-1', title: 'Fix 1' },
        { id: 'fix-2', title: 'Fix 2' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves(mockJunctionRecords),
      };

      const mockFixEntityCollection = {
        batchGetByIds: stub().resolves({
          data: mockFixEntities,
          unprocessed: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestion')
        .returns(mockFixEntitySuggestionCollection);
      mockEntityRegistry.getCollection
        .withArgs('FixEntity')
        .returns(mockFixEntityCollection);

      const result = await instance.getFixEntitiesBySuggestionId(suggestionId);

      expect(result).to.deep.equal({
        data: mockFixEntities,
        unprocessed: [],
      });

      expect(mockFixEntitySuggestionCollection.allBySuggestionId)
        .to.have.been.calledOnceWith(suggestionId);
      expect(mockFixEntityCollection.batchGetByIds).to.have.been.calledOnceWith(['fix-1', 'fix-2']);
    });

    it('should return empty arrays when no junction records found', async () => {
      const suggestionId = 'suggestion-123';
      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestion')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.getFixEntitiesBySuggestionId(suggestionId);

      expect(result).to.deep.equal({
        data: [],
        unprocessed: [],
      });

      expect(mockFixEntitySuggestionCollection.allBySuggestionId)
        .to.have.been.calledOnceWith(suggestionId);
    });

    it('should throw error when suggestionId is not provided', async () => {
      await expect(instance.getFixEntitiesBySuggestionId()).to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to get fix entities: suggestionId is required');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const suggestionId = 'suggestion-123';
      const error = new Error('Database error');

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().rejects(error),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestion')
        .returns(mockFixEntitySuggestionCollection);

      await expect(instance.getFixEntitiesBySuggestionId(suggestionId))
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to get fix entities for suggestion', error);
    });
  });

  describe('setFixEntitiesBySuggestionId', () => {
    it('should set fix entities for a suggestion with delta updates', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntities = ['fix-1', 'fix-2'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getFixEntityId: () => 'fix-1' },
        { getId: () => 'junction-2', getFixEntityId: () => 'fix-3' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves(existingJunctionRecords),
        removeByIds: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-3' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestion')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-3' }],
        errorItems: [],
        removedCount: 1,
      });

      expect(mockFixEntitySuggestionCollection.allBySuggestionId)
        .to.have.been.calledOnceWith(suggestionId);
      expect(mockFixEntitySuggestionCollection.removeByIds).to.have.been.calledOnceWith(['junction-2']);
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { suggestionId, fixEntityId: 'fix-2' },
      ]);
    });

    it('should handle fix entities as model instances', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntityModels = [
        { getId: () => 'fix-1' },
        { getId: () => 'fix-2' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestion')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntityModels);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { suggestionId, fixEntityId: 'fix-1' },
        { suggestionId, fixEntityId: 'fix-2' },
      ]);
    });

    it('should throw error when suggestionId is not provided', async () => {
      await expect(instance.setFixEntitiesBySuggestionId()).to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to set fix entities: suggestionId is required');
    });

    it('should throw error when fixEntities is not an array', async () => {
      const suggestionId = 'suggestion-123';

      await expect(instance.setFixEntitiesBySuggestionId(suggestionId, 'not-an-array')).to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Fix entities must be an array');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntities = ['fix-1'];
      const error = new Error('Database error');

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().rejects(error),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestion')
        .returns(mockFixEntitySuggestionCollection);

      await expect(instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities))
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to set fix entities for suggestion', error);
    });

    it('should log info about the operation results', async () => {
      const suggestionId = 'suggestion-123';
      const fixEntities = ['fix-1'];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestion')
        .returns(mockFixEntitySuggestionCollection);

      await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(mockLogger.info).to.have.been.calledWith(
        `Set fix entities for suggestion ${suggestionId}: removed 0, added 1, failed 0`,
      );
    });

    it('should handle mixed input types (strings and models)', async () => {
      const suggestionId = 'suggestion-123';
      const mixedInput = [
        'fix-1', // string
        { getId: () => 'fix-2' }, // model
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestion')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, mixedInput);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { suggestionId, fixEntityId: 'fix-1' },
        { suggestionId, fixEntityId: 'fix-2' },
      ]);
    });
  });
});
