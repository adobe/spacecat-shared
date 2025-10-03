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

import { expect } from 'chai';
import sinon, { stub, restore } from 'sinon';

import FixEntity from '../../../../src/models/fix-entity/fix-entity.model.js';
import DataAccessError from '../../../../src/errors/data-access.error.js';
import { createElectroMocks } from '../../util.js';

describe('FixEntityCollection', () => {
  let fixEntityCollection;
  let mockEntityRegistry;
  let mockLogger;

  const mockRecord = {
    fixEntityId: '123e4567-e89b-12d3-a456-426614174000',
    opportunityId: '123e4567-e89b-12d3-a456-426614174001',
    type: 'SEO',
    status: 'PENDING',
    changeDetails: { field: 'title', oldValue: 'Old', newValue: 'New' },
    executedAt: '2024-01-01T00:00:00.000Z',
    executedBy: 'user123',
    publishedAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };

  beforeEach(() => {
    ({
      mockEntityRegistry,
      mockLogger,
      collection: fixEntityCollection,
    } = createElectroMocks(FixEntity, mockRecord));
  });

  afterEach(() => {
    restore();
  });

  describe('getSuggestionsByFixEntityId', () => {
    it('should get suggestions for a fix entity', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const mockJunctionRecords = [
        { getSuggestionId: () => 'suggestion-1' },
        { getSuggestionId: () => 'suggestion-2' },
      ];
      const mockSuggestions = [
        { id: 'suggestion-1', title: 'Suggestion 1' },
        { id: 'suggestion-2', title: 'Suggestion 2' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(mockJunctionRecords),
      };

      const mockSuggestionCollection = {
        batchGetByKeys: stub().resolves({
          data: mockSuggestions,
          unprocessed: [],
        }),
        idName: 'suggestionId',
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);
      mockEntityRegistry.getCollection
        .withArgs('SuggestionCollection')
        .returns(mockSuggestionCollection);

      const result = await fixEntityCollection.getSuggestionsByFixEntityId(fixEntityId);

      expect(result).to.deep.equal(mockSuggestions);

      expect(mockFixEntitySuggestionCollection.allByFixEntityId)
        .to.have.been.calledOnceWith(fixEntityId);
      expect(mockSuggestionCollection.batchGetByKeys)
        .to.have.been.calledOnceWith([
          { suggestionId: 'suggestion-1' },
          { suggestionId: 'suggestion-2' },
        ]);
    });

    it('should return empty arrays when no junction records found', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection.getSuggestionsByFixEntityId(fixEntityId);

      expect(result).to.deep.equal([]);

      expect(mockFixEntitySuggestionCollection.allByFixEntityId)
        .to.have.been.calledOnceWith(fixEntityId);
    });

    it('should throw error when fixEntityId is not provided', async () => {
      await expect(fixEntityCollection.getSuggestionsByFixEntityId())
        .to.be.rejectedWith('Validation failed in FixEntityCollection: fixEntityId must be a valid UUID');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const error = new Error('Database error');

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().rejects(error),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await expect(fixEntityCollection.getSuggestionsByFixEntityId(fixEntityId))
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith(`Failed to get suggestions for fix entity: ${fixEntityId}`, error);
    });
  });

  describe('getSuggestionsByFixEntitySuggestions', () => {
    it('should get suggestions from fix entity suggestions', async () => {
      const fixEntitySuggestions = [
        { getSuggestionId: () => 'suggestion-1' },
        { getSuggestionId: () => 'suggestion-2' },
      ];
      const mockSuggestions = [
        { id: 'suggestion-1', title: 'Suggestion 1' },
        { id: 'suggestion-2', title: 'Suggestion 2' },
      ];

      const mockSuggestionCollection = {
        batchGetByKeys: stub().resolves({
          data: mockSuggestions,
          unprocessed: [],
        }),
        idName: 'suggestionId',
      };

      mockEntityRegistry.getCollection
        .withArgs('SuggestionCollection')
        .returns(mockSuggestionCollection);

      const result = await fixEntityCollection
        .getSuggestionsByFixEntitySuggestions(fixEntitySuggestions);

      expect(result).to.deep.equal(mockSuggestions);
      expect(mockSuggestionCollection.batchGetByKeys)
        .to.have.been.calledOnceWith([
          { suggestionId: 'suggestion-1' },
          { suggestionId: 'suggestion-2' },
        ]);
    });

    it('should return empty array when no fix entity suggestions provided', async () => {
      const result = await fixEntityCollection.getSuggestionsByFixEntitySuggestions([]);
      expect(result).to.deep.equal([]);
    });

    it('should throw error when fixEntitySuggestions is not an array', async () => {
      await expect(fixEntityCollection.getSuggestionsByFixEntitySuggestions('not-an-array'))
        .to.be.rejectedWith('Validation failed in FixEntityCollection: fixEntitySuggestions must be an array');
    });

    it('should handle error in batchGetByKeys', async () => {
      const fixEntitySuggestions = [
        { getSuggestionId: () => 'suggestion-1' },
      ];

      const mockSuggestionCollection = {
        batchGetByKeys: stub().rejects(new Error('Batch get failed')),
        idName: 'suggestionId',
      };

      mockEntityRegistry.getCollection
        .withArgs('SuggestionCollection')
        .returns(mockSuggestionCollection);

      await expect(fixEntityCollection.getSuggestionsByFixEntitySuggestions(fixEntitySuggestions))
        .to.be.rejectedWith(DataAccessError, 'Failed to get suggestions for fix entity suggestions');

      expect(mockLogger.error).to.have.been.calledWith('Failed to get suggestions for fix entity suggestions', sinon.match.instanceOf(Error));
    });
  });

  describe('setSuggestionsByFixEntityId', () => {
    it('should set suggestions for a fix entity with delta updates', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1', 'suggestion-2'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getSuggestionId: () => 'suggestion-1' },
        { getId: () => 'junction-2', getSuggestionId: () => 'suggestion-3' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(existingJunctionRecords),
        removeByIds: stub().resolves(),
        removeByIndexKeys: stub().resolves([
          { id: 'junction-2' },
        ]),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-3' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection
        .setSuggestionsByFixEntityId(fixEntityId, suggestions);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-3' }],
        errorItems: [],
        removedCount: 1,
      });

      expect(mockFixEntitySuggestionCollection.allByFixEntityId)
        .to.have.been.calledOnceWith(fixEntityId);
      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.have.been.calledOnceWith([
        {
          suggestionId: 'suggestion-3',
          fixEntityId,
        },
      ]);
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { fixEntityId, suggestionId: 'suggestion-2' },
      ]);
    });

    it('should throw error when fixEntityId is not provided', async () => {
      await expect(fixEntityCollection.setSuggestionsByFixEntityId())
        .to.be.rejectedWith('Validation failed in FixEntityCollection: fixEntityId must be a valid UUID');
    });

    it('should throw error when suggestions is not an array', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';

      await expect(fixEntityCollection.setSuggestionsByFixEntityId(fixEntityId, 'not-an-array'))
        .to.be.rejectedWith('Validation failed in FixEntityCollection: suggestionIds must be an array');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1'];
      const error = new Error('Database error');

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().rejects(error),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await expect(fixEntityCollection.setSuggestionsByFixEntityId(fixEntityId, suggestions))
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to set suggestions for fix entity', error);
    });

    it('should log info about the operation results', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1'];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await fixEntityCollection.setSuggestionsByFixEntityId(fixEntityId, suggestions);

      expect(mockLogger.info).to.have.been.calledWith(
        `Set suggestions for fix entity ${fixEntityId}: removed 0, added 1, failed 0`,
      );
    });

    it('should handle remove operation failure gracefully', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1', 'suggestion-2'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getSuggestionId: () => 'suggestion-3' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(existingJunctionRecords),
        removeByIndexKeys: stub().rejects(new Error('Remove failed')),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-2' }, { id: 'junction-3' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection
        .setSuggestionsByFixEntityId(fixEntityId, suggestions);

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
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1', 'suggestion-2'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getSuggestionId: () => 'suggestion-3' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(existingJunctionRecords),
        removeByIndexKeys: stub().resolves([{ id: 'removed-1' }]),
        createMany: stub().rejects(new Error('Create failed')),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection
        .setSuggestionsByFixEntityId(fixEntityId, suggestions);

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

    it('should handle both operations failing gracefully', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1', 'suggestion-2'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getSuggestionId: () => 'suggestion-3' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(existingJunctionRecords),
        removeByIndexKeys: stub().rejects(new Error('Remove failed')),
        createMany: stub().rejects(new Error('Create failed')),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection
        .setSuggestionsByFixEntityId(fixEntityId, suggestions);

      expect(result).to.deep.equal({
        createdItems: [],
        errorItems: [],
        removedCount: 0,
      });

      expect(mockLogger.error).to.have.been.calledTwice;
      expect(mockLogger.error).to.have.been.calledWith(
        'Remove operation failed:',
        sinon.match.instanceOf(Error),
      );
      expect(mockLogger.error).to.have.been.calledWith(
        'Create operation failed:',
        sinon.match.instanceOf(Error),
      );
    });

    it('should handle empty suggestion array (remove all)', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = [];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getSuggestionId: () => 'suggestion-1' },
        { getId: () => 'junction-2', getSuggestionId: () => 'suggestion-2' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(existingJunctionRecords),
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

      const result = await fixEntityCollection
        .setSuggestionsByFixEntityId(fixEntityId, suggestions);

      expect(result).to.deep.equal({
        createdItems: [],
        errorItems: [],
        removedCount: 2,
      });

      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.have.been.calledOnceWith([
        { suggestionId: 'suggestion-1', fixEntityId },
        { suggestionId: 'suggestion-2', fixEntityId },
      ]);
      expect(mockFixEntitySuggestionCollection.createMany).to.not.have.been.called;
    });

    it('should handle no existing relationships (create all)', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1', 'suggestion-2'];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection
        .setSuggestionsByFixEntityId(fixEntityId, suggestions);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.not.have.been.called;
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { fixEntityId, suggestionId: 'suggestion-1' },
        { fixEntityId, suggestionId: 'suggestion-2' },
      ]);
    });

    it('should handle duplicate suggestion IDs in input', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1', 'suggestion-1', 'suggestion-2', 'suggestion-2'];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection
        .setSuggestionsByFixEntityId(fixEntityId, suggestions);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      // Should only create unique suggestions
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { fixEntityId, suggestionId: 'suggestion-1' },
        { fixEntityId, suggestionId: 'suggestion-2' },
      ]);
    });

    it('should handle undefined promises (no operations needed)', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const suggestions = ['suggestion-1'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getSuggestionId: () => 'suggestion-1' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(existingJunctionRecords),
        removeByIndexKeys: stub().resolves(),
        createMany: stub().resolves({
          createdItems: [],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection
        .setSuggestionsByFixEntityId(fixEntityId, suggestions);

      expect(result).to.deep.equal({
        createdItems: [],
        errorItems: [],
        removedCount: 0,
      });

      // No operations should be called since suggestions are identical
      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.not.have.been.called;
      expect(mockFixEntitySuggestionCollection.createMany).to.not.have.been.called;
    });
  });
});
