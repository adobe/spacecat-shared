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
import { stub, restore } from 'sinon';

import FixEntity from '../../../../src/models/fix-entity/fix-entity.model.js';
import DataAccessError from '../../../../src/errors/data-access.error.js';
import { createElectroMocks } from '../../util.js';

describe('FixEntityCollection', () => {
  let fixEntityCollection;
  let mockEntityRegistry;
  let mockLogger;

  const mockRecord = {
    fixEntityId: 'fix-123',
    opportunityId: 'op-123',
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
      const fixEntityId = 'fix-123';
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
        batchGetByIds: stub().resolves({
          data: mockSuggestions,
          unprocessed: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);
      mockEntityRegistry.getCollection
        .withArgs('SuggestionCollection')
        .returns(mockSuggestionCollection);

      const result = await fixEntityCollection.getSuggestionsByFixEntityId(fixEntityId);

      expect(result).to.deep.equal({
        data: mockSuggestions,
        unprocessed: [],
      });

      expect(mockFixEntitySuggestionCollection.allByFixEntityId)
        .to.have.been.calledOnceWith(fixEntityId);
      expect(mockSuggestionCollection.batchGetByIds)
        .to.have.been.calledOnceWith(['suggestion-1', 'suggestion-2']);
    });

    it('should return empty arrays when no junction records found', async () => {
      const fixEntityId = 'fix-123';
      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection.getSuggestionsByFixEntityId(fixEntityId);

      expect(result).to.deep.equal({
        data: [],
        unprocessed: [],
      });

      expect(mockFixEntitySuggestionCollection.allByFixEntityId)
        .to.have.been.calledOnceWith(fixEntityId);
    });

    it('should throw error when fixEntityId is not provided', async () => {
      await expect(fixEntityCollection.getSuggestionsByFixEntityId())
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to get suggestions: fixEntityId is required');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const fixEntityId = 'fix-123';
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

  describe('setSuggestionsByFixEntityId', () => {
    it('should set suggestions for a fix entity with delta updates', async () => {
      const fixEntityId = 'fix-123';
      const suggestions = ['suggestion-1', 'suggestion-2'];

      const existingJunctionRecords = [
        { getId: () => 'junction-1', getSuggestionId: () => 'suggestion-1' },
        { getId: () => 'junction-2', getSuggestionId: () => 'suggestion-3' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(existingJunctionRecords),
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

    it('should handle suggestions as model instances', async () => {
      const fixEntityId = 'fix-123';
      const suggestionModels = [
        { getId: () => 'suggestion-1' },
        { getId: () => 'suggestion-2' },
      ];

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
        .setSuggestionsByFixEntityId(fixEntityId, suggestionModels);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        { fixEntityId, suggestionId: 'suggestion-1' },
        { fixEntityId, suggestionId: 'suggestion-2' },
      ]);
    });

    it('should throw error when fixEntityId is not provided', async () => {
      await expect(fixEntityCollection.setSuggestionsByFixEntityId())
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to set suggestions: fixEntityId is required');
    });

    it('should throw error when suggestions is not an array', async () => {
      const fixEntityId = 'fix-123';

      await expect(fixEntityCollection.setSuggestionsByFixEntityId(fixEntityId, 'not-an-array')).to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Suggestions must be an array');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const fixEntityId = 'fix-123';
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
      const fixEntityId = 'fix-123';
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
  });
});
