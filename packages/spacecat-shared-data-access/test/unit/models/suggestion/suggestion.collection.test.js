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
import sinon, { stub, restore } from 'sinon';

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
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const mockJunctionRecords = [
        { getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174003' },
        { getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174004' },
      ];
      const mockFixEntities = [
        { id: '123e4567-e89b-12d3-a456-426614174003', title: 'Fix 1' },
        { id: '123e4567-e89b-12d3-a456-426614174004', title: 'Fix 2' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves(mockJunctionRecords),
        removeByIndexKeys: stub().resolves(),
      };

      const mockFixEntityCollection = {
        batchGetByKeys: stub().resolves({
          data: mockFixEntities,
          unprocessed: [],
        }),
        idName: 'fixEntityId',
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);
      mockEntityRegistry.getCollection
        .withArgs('FixEntityCollection')
        .returns(mockFixEntityCollection);

      const result = await instance.getFixEntitiesBySuggestionId(suggestionId);

      expect(result).to.deep.equal(mockFixEntities);

      expect(mockFixEntitySuggestionCollection.allBySuggestionId)
        .to.have.been.calledOnceWith(suggestionId);
      expect(mockFixEntityCollection.batchGetByKeys).to.have.been.calledOnceWith([
        { fixEntityId: '123e4567-e89b-12d3-a456-426614174003' },
        { fixEntityId: '123e4567-e89b-12d3-a456-426614174004' },
      ]);
    });

    it('should return empty arrays when no junction records found', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.getFixEntitiesBySuggestionId(suggestionId);

      expect(result).to.deep.equal([]);

      expect(mockFixEntitySuggestionCollection.allBySuggestionId)
        .to.have.been.calledOnceWith(suggestionId);
    });

    it('should throw error when suggestionId is not provided', async () => {
      await expect(instance.getFixEntitiesBySuggestionId())
        .to.be.rejectedWith('Validation failed in SuggestionCollection: suggestionId must be a valid UUID');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const error = new Error('Database error');

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().rejects(error),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await expect(instance.getFixEntitiesBySuggestionId(suggestionId))
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to get fix entities for suggestion', error);
    });
  });

  describe('setFixEntitiesBySuggestionId', () => {
    it('should set fix entities for a suggestion with delta updates', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntities = ['123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174004'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174003' },
        { getId: () => 'junction-2', getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174005' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves(existingJunctionRecords),
        removeByIds: stub().resolves(),
        removeByIndexKeys: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-3' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-3' }],
        errorItems: [],
        removedCount: 1,
      });

      expect(mockFixEntitySuggestionCollection.allBySuggestionId)
        .to.have.been.calledOnceWith(suggestionId);
      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.have.been.calledOnceWith([{
        suggestionId,
        fixEntityId: '123e4567-e89b-12d3-a456-426614174005',
      }]);
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { suggestionId, fixEntityId: '123e4567-e89b-12d3-a456-426614174004' },
      ]);
    });

    it('should throw error when suggestionId is not provided', async () => {
      await expect(instance.setFixEntitiesBySuggestionId())
        .to.be.rejectedWith('Validation failed in SuggestionCollection: suggestionId must be a valid UUID');
    });

    it('should throw error when fixEntities is not an array', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';

      await expect(instance.setFixEntitiesBySuggestionId(suggestionId, 'not-an-array'))
        .to.be.rejectedWith('Validation failed in SuggestionCollection: fixEntityIds must be an array');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntities = ['123e4567-e89b-12d3-a456-426614174003'];
      const error = new Error('Database error');

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().rejects(error),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await expect(instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities))
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to set fix entities for suggestion', error);
    });

    it('should log info about the operation results', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntities = ['123e4567-e89b-12d3-a456-426614174003'];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(mockLogger.info).to.have.been.calledWith(
        `Set fix entities for suggestion ${suggestionId}: removed 0, added 1, failed 0`,
      );
    });

    it('should handle remove operation failure gracefully', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntities = ['123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174004'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174005' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves(existingJunctionRecords),
        removeByIndexKeys: stub().rejects(new Error('Remove failed')),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-2' }, { id: 'junction-3' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-2' }, { id: 'junction-3' }],
        errorItems: [],
        removedCount: 0, // Failed operation results in 0 removed
      });

      expect(mockLogger.error).to.have.been.calledWith(
        'Remove operation failed:',
        sinon.match.instanceOf(Error),
      );
    });

    it('should handle create operation failure gracefully', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntities = ['123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174004'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174005' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves(existingJunctionRecords),
        removeByIndexKeys: stub().resolves([{ id: 'removed-1' }]),
        createMany: stub().rejects(new Error('Create failed')),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(result).to.deep.equal({
        createdItems: [], // Failed operation results in empty array
        errorItems: [], // Failed operation results in empty array
        removedCount: 1,
      });

      expect(mockLogger.error).to.have.been.calledWith(
        'Create operation failed:',
        sinon.match.instanceOf(Error),
      );
    });

    it('should handle empty fix entity array (remove all)', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntities = [];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174003' },
        { getId: () => 'junction-2', getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174004' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves(existingJunctionRecords),
        removeByIndexKeys: stub().resolves([
          { id: 'junction-1' },
          { id: 'junction-2' },
        ]),
        createMany: stub().resolves({
          createdItems: [],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(result).to.deep.equal({
        createdItems: [],
        errorItems: [],
        removedCount: 2,
      });

      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.have.been.calledOnceWith([
        { suggestionId, fixEntityId: '123e4567-e89b-12d3-a456-426614174003' },
        { suggestionId, fixEntityId: '123e4567-e89b-12d3-a456-426614174004' },
      ]);
      expect(mockFixEntitySuggestionCollection.createMany).to.not.have.been.called;
    });

    it('should handle no existing relationships (create all)', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntities = ['123e4567-e89b-12d3-a456-426614174003', '123e4567-e89b-12d3-a456-426614174004'];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.not.have.been.called;
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { suggestionId, fixEntityId: '123e4567-e89b-12d3-a456-426614174003' },
        { suggestionId, fixEntityId: '123e4567-e89b-12d3-a456-426614174004' },
      ]);
    });

    it('should handle duplicate fix entity IDs in input', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntities = ['123e4567-e89b-12d3-a456-426614003', '123e4567-e89b-12d3-a456-426614003', '123e4567-e89b-12d3-a456-426614004'];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.setFixEntitiesBySuggestionId(suggestionId, fixEntities);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      // Should only create unique fix entities
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { suggestionId, fixEntityId: '123e4567-e89b-12d3-a456-426614003' },
        { suggestionId, fixEntityId: '123e4567-e89b-12d3-a456-426614004' },
      ]);
    });
  });
});
