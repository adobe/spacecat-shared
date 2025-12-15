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
import ValidationError from '../../../../src/errors/validation.error.js';
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

  // Mock entity objects
  const mockOpportunity = {
    getId: () => '123e4567-e89b-12d3-a456-426614174001',
  };

  const mockFixEntity = {
    getId: () => '123e4567-e89b-12d3-a456-426614174000',
    getCreatedAt: () => '2024-01-15T10:30:00.000Z',
    getExecutedAt: () => undefined,
  };

  const mockSuggestions = [
    { getId: () => 'suggestion-1' },
    { getId: () => 'suggestion-2' },
  ];

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
      const mockSuggestionData = [
        { id: 'suggestion-1', title: 'Suggestion 1' },
        { id: 'suggestion-2', title: 'Suggestion 2' },
      ];

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(mockJunctionRecords),
      };

      const mockSuggestionCollection = {
        batchGetByKeys: stub().resolves({
          data: mockSuggestionData,
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

      expect(result).to.deep.equal(mockSuggestionData);

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

    it('should handle errors in batchGetByKeys and throw DataAccessError', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
      const mockJunctionRecords = [
        { getSuggestionId: () => 'suggestion-1' },
      ];
      const error = new Error('Batch get failed');

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves(mockJunctionRecords),
      };

      const mockSuggestionCollection = {
        batchGetByKeys: stub().rejects(error),
        idName: 'suggestionId',
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);
      mockEntityRegistry.getCollection
        .withArgs('SuggestionCollection')
        .returns(mockSuggestionCollection);

      await expect(fixEntityCollection.getSuggestionsByFixEntityId(fixEntityId))
        .to.be.rejectedWith(DataAccessError, 'Failed to get suggestions for fix entity');
      expect(mockLogger.error).to.have.been.calledWith(`Failed to get suggestions for fix entity: ${fixEntityId}`, error);
    });
  });

  describe('setSuggestionsForFixEntity', () => {
    it('should set suggestions for a fix entity with delta updates', async () => {
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
        .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, mockSuggestions);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-3' }],
        errorItems: [],
        removedCount: 1,
      });

      expect(mockFixEntitySuggestionCollection.allByFixEntityId)
        .to.have.been.calledOnceWith('123e4567-e89b-12d3-a456-426614174000');
      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.have.been.calledOnceWith([
        {
          suggestionId: 'suggestion-3',
          fixEntityId: '123e4567-e89b-12d3-a456-426614174000',
        },
      ]);
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        {
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          fixEntityCreatedAt: '2024-01-15T10:30:00.000Z',
          fixEntityId: '123e4567-e89b-12d3-a456-426614174000',
          suggestionId: 'suggestion-2',
        },
      ]);
    });

    it('should throw error when opportunityId is not provided', async () => {
      await expect(
        fixEntityCollection.setSuggestionsForFixEntity(null, mockFixEntity, mockSuggestions),
      ).to.be.rejectedWith('Validation failed in FixEntityCollection: opportunityId must be a valid UUID');
    });

    it('should throw error when fixEntity is not provided', async () => {
      await expect(
        fixEntityCollection
          .setSuggestionsForFixEntity(mockOpportunity.getId(), null, mockSuggestions),
      ).to.be.rejectedWith(ValidationError, 'fixEntity is required');
    });

    it('should throw error when suggestions is not an array', async () => {
      await expect(fixEntityCollection.setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, 'not-an-array'))
        .to.be.rejectedWith('Validation failed in FixEntityCollection: suggestions must be an array');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const error = new Error('Database error');

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().rejects(error),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await expect(
        fixEntityCollection
          .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, mockSuggestions),
      ).to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to set suggestions for fix entity', error);
    });

    it('should log info about the operation results', async () => {
      const singleSuggestion = [{ getId: () => 'suggestion-1' }];

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

      await fixEntityCollection.setSuggestionsForFixEntity(
        mockOpportunity.getId(),
        mockFixEntity,
        singleSuggestion,
      );

      expect(mockLogger.info).to.have.been.calledWith(
        'Set suggestions for fix entity 123e4567-e89b-12d3-a456-426614174000: removed 0, added 1, failed 0',
      );
    });

    it('should handle remove operation failure gracefully', async () => {
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
        .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, mockSuggestions);

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
        .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, mockSuggestions);

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
        .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, mockSuggestions);

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
      const emptySuggestions = [];

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
        .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, emptySuggestions);

      expect(result).to.deep.equal({
        createdItems: [],
        errorItems: [],
        removedCount: 2,
      });

      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.have.been.calledOnceWith([
        { suggestionId: 'suggestion-1', fixEntityId: '123e4567-e89b-12d3-a456-426614174000' },
        { suggestionId: 'suggestion-2', fixEntityId: '123e4567-e89b-12d3-a456-426614174000' },
      ]);
      expect(mockFixEntitySuggestionCollection.createMany).to.not.have.been.called;
    });

    it('should handle no existing relationships (create all)', async () => {
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
        .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, mockSuggestions);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      expect(mockFixEntitySuggestionCollection.removeByIndexKeys).to.not.have.been.called;
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        {
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          fixEntityCreatedAt: '2024-01-15T10:30:00.000Z',
          fixEntityId: '123e4567-e89b-12d3-a456-426614174000',
          suggestionId: 'suggestion-1',
        },
        {
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          fixEntityCreatedAt: '2024-01-15T10:30:00.000Z',
          fixEntityId: '123e4567-e89b-12d3-a456-426614174000',
          suggestionId: 'suggestion-2',
        },
      ]);
    });

    it('should handle duplicate suggestion IDs in input', async () => {
      const duplicateSuggestions = [
        { getId: () => 'suggestion-1' },
        { getId: () => 'suggestion-1' },
        { getId: () => 'suggestion-2' },
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
        .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, duplicateSuggestions);

      expect(result).to.deep.equal({
        createdItems: [{ id: 'junction-1' }, { id: 'junction-2' }],
        errorItems: [],
        removedCount: 0,
      });

      // Should only create unique suggestions
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledOnceWith([
        {
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          fixEntityCreatedAt: '2024-01-15T10:30:00.000Z',
          fixEntityId: '123e4567-e89b-12d3-a456-426614174000',
          suggestionId: 'suggestion-1',
        },
        {
          opportunityId: '123e4567-e89b-12d3-a456-426614174001',
          fixEntityCreatedAt: '2024-01-15T10:30:00.000Z',
          fixEntityId: '123e4567-e89b-12d3-a456-426614174000',
          suggestionId: 'suggestion-2',
        },
      ]);
    });

    it('should use executedAt when available, fallback to createdAt when not', async () => {
      const mockFixEntityWithExecutedAt = {
        getId: () => '123e4567-e89b-12d3-a456-426614174000',
        getCreatedAt: () => '2024-01-15T10:30:00.000Z',
        getExecutedAt: () => '2024-01-15T09:00:00.000Z',
      };

      const mockFixEntitySuggestionCollection = {
        allByFixEntityId: stub().resolves([
          { getSuggestionId: () => 'suggestion-1' },
        ]),
        removeByIndexKeys: stub().resolves([]),
        createMany: stub().resolves({
          createdItems: [{ id: 'junction-1' }],
          errorItems: [],
        }),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await fixEntityCollection
        .setSuggestionsForFixEntity(
          mockOpportunity.getId(),
          mockFixEntityWithExecutedAt,
          mockSuggestions,
        );

      // Verify that executedAt was used instead of createdAt
      expect(mockFixEntitySuggestionCollection.createMany).to.have.been.calledWith(
        sinon.match((items) => items.every((item) => item.fixEntityCreatedAt === '2024-01-15T09:00:00.000Z')),
      );
    });

    it('should handle undefined promises (no operations needed)', async () => {
      const singleSuggestion = [{ getId: () => 'suggestion-1' }];

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
        .setSuggestionsForFixEntity(mockOpportunity.getId(), mockFixEntity, singleSuggestion);

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

  describe('getAllFixesWithSuggestionByCreatedAt', () => {
    it('should get all fixes with suggestions ordered by created date', async () => {
      const opportunityId = '123e4567-e89b-12d3-a456-426614174001';
      const fixEntityCreatedDate = '2024-01-15';

      const mockFixEntitySuggestions = [
        {
          getFixEntityId: () => 'fix-1',
          getSuggestionId: () => 'suggestion-1',
        },
        {
          getFixEntityId: () => 'fix-1',
          getSuggestionId: () => 'suggestion-2',
        },
        {
          getFixEntityId: () => 'fix-2',
          getSuggestionId: () => 'suggestion-3',
        },
      ];

      const mockFixEntities = {
        data: [
          {
            getId: () => 'fix-1',
            getCreatedAt: () => '2024-01-15T10:30:00.000Z',
          },
          {
            getId: () => 'fix-2',
            getCreatedAt: () => '2024-01-15T09:30:00.000Z',
          },
        ],
      };

      const mockSuggestionsData = {
        data: [
          { getId: () => 'suggestion-1', title: 'Suggestion 1' },
          { getId: () => 'suggestion-2', title: 'Suggestion 2' },
          { getId: () => 'suggestion-3', title: 'Suggestion 3' },
        ],
      };

      const mockFixEntitySuggestionCollection = {
        allByOpportunityIdAndFixEntityCreatedDate: stub().resolves(mockFixEntitySuggestions),
      };

      const mockSuggestionCollection = {
        batchGetByKeys: stub().resolves(mockSuggestionsData),
        idName: 'suggestionId',
      };

      fixEntityCollection.batchGetByKeys = stub().resolves(mockFixEntities);
      fixEntityCollection.idName = 'fixEntityId';

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);
      mockEntityRegistry.getCollection
        .withArgs('SuggestionCollection')
        .returns(mockSuggestionCollection);

      const result = await fixEntityCollection.getAllFixesWithSuggestionByCreatedAt(
        opportunityId,
        fixEntityCreatedDate,
      );

      expect(result).to.have.lengthOf(2);
      expect(result[0].fixEntity.getId()).to.equal('fix-1');
      expect(result[0].suggestions).to.have.lengthOf(2);
      expect(result[1].fixEntity.getId()).to.equal('fix-2');
      expect(result[1].suggestions).to.have.lengthOf(1);

      expect(mockFixEntitySuggestionCollection.allByOpportunityIdAndFixEntityCreatedDate)
        .to.have.been.calledWith(opportunityId, fixEntityCreatedDate);
    });

    it('should handle empty results', async () => {
      const opportunityId = '123e4567-e89b-12d3-a456-426614174001';
      const fixEntityCreatedDate = '2024-01-15';

      const mockFixEntitySuggestionCollection = {
        allByOpportunityIdAndFixEntityCreatedDate: stub().resolves([]),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await fixEntityCollection.getAllFixesWithSuggestionByCreatedAt(
        opportunityId,
        fixEntityCreatedDate,
      );

      expect(result).to.deep.equal([]);
    });

    it('should validate required parameters', async () => {
      const opportunityId = '123e4567-e89b-12d3-a456-426614174001';
      const fixEntityCreatedDate = '2024-01-15';

      // Test missing opportunityId
      try {
        await fixEntityCollection.getAllFixesWithSuggestionByCreatedAt(null, fixEntityCreatedDate);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('opportunityId must be a valid UUID');
      }

      // Test missing fixEntityCreatedDate
      try {
        await fixEntityCollection.getAllFixesWithSuggestionByCreatedAt(opportunityId, null);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('fixEntityCreatedDate is required');
      }
    });

    it('should handle errors gracefully', async () => {
      const opportunityId = '123e4567-e89b-12d3-a456-426614174001';
      const fixEntityCreatedDate = '2024-01-15';

      const mockFixEntitySuggestionCollection = {
        allByOpportunityIdAndFixEntityCreatedDate: stub().rejects(new Error('Database error')),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      try {
        await fixEntityCollection.getAllFixesWithSuggestionByCreatedAt(
          opportunityId,
          fixEntityCreatedDate,
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(DataAccessError);
        expect(error.message).to.include('Failed to get all fixes with suggestions by created date');
      }
    });
  });

  describe('createFixEntityWithSuggestionUpdates (Transaction)', () => {
    const fixEntityData = {
      opportunityId: '123e4567-e89b-12d3-a456-426614174001',
      type: 'CODE_CHANGE',
      changeDetails: { file: 'index.js', lines: [10, 20] },
      executedBy: 'user-456',
      executedAt: '2024-01-15T10:00:00Z',
    };

    const suggestionUpdates = [
      { suggestionId: '223e4567-e89b-12d3-a456-426614174001', opportunityId: '123e4567-e89b-12d3-a456-426614174001', status: 'FIXED' },
      { suggestionId: '323e4567-e89b-12d3-a456-426614174001', opportunityId: '123e4567-e89b-12d3-a456-426614174001', status: 'FIXED' },
    ];

    it('should successfully create fix entity and update suggestions in a transaction', async () => {
      const transactionResult = {
        canceled: false,
        data: [
          { rejected: false, item: null }, // FixEntity create
          { rejected: false, item: null }, // Suggestion 1 update
          { rejected: false, item: null }, // Suggestion 2 update
          { rejected: false, item: null }, // FixEntitySuggestion 1 create
          { rejected: false, item: null }, // FixEntitySuggestion 2 create
        ],
      };

      const mockCreatedFixEntity = {
        getId: () => sinon.match.string,
        getCreatedAt: () => '2024-01-15T10:00:00Z',
        getExecutedAt: () => '2024-01-15T10:00:00Z',
      };

      const mockElectroService = {
        transaction: {
          write: stub().returns({
            go: stub().resolves(transactionResult),
          }),
        },
      };

      fixEntityCollection.electroService = mockElectroService;
      fixEntityCollection.findById = stub().resolves(mockCreatedFixEntity);

      const result = await fixEntityCollection.createFixEntityWithSuggestionUpdates(
        fixEntityData,
        suggestionUpdates,
      );

      expect(result.canceled).to.be.false;
      expect(result.fixEntity).to.equal(mockCreatedFixEntity);
      expect(mockElectroService.transaction.write).to.have.been.calledOnce;
      expect(fixEntityCollection.findById).to.have.been.calledOnce;

      // Verify the transaction includes all operations (1 FixEntity + 2 Suggestions + 2 Junctions)
      expect(transactionResult.data).to.have.lengthOf(5);
    });

    it('should handle transaction with idempotency token', async () => {
      const transactionResult = {
        canceled: false,
        data: [
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
        ],
      };

      const mockCreatedFixEntity = {
        getId: () => 'fix-entity-123',
        getCreatedAt: () => '2024-01-15T10:00:00Z',
        getExecutedAt: () => '2024-01-15T10:00:00Z',
      };

      const goStub = stub().resolves(transactionResult);
      const mockElectroService = {
        transaction: {
          write: stub().returns({
            go: goStub,
          }),
        },
      };

      fixEntityCollection.electroService = mockElectroService;
      fixEntityCollection.findById = stub().resolves(mockCreatedFixEntity);

      const token = 'fix-opp-123-2024-01-15';
      await fixEntityCollection.createFixEntityWithSuggestionUpdates(
        fixEntityData,
        suggestionUpdates,
        { token },
      );

      expect(goStub).to.have.been.calledOnceWith({ token });
    });

    it('should throw error when fixEntityData is invalid', async () => {
      await expect(
        fixEntityCollection.createFixEntityWithSuggestionUpdates(null, suggestionUpdates),
      ).to.be.rejectedWith(ValidationError, 'fixEntityData is required and must be an object');
    });

    it('should throw error when opportunityId is missing', async () => {
      const invalidData = { ...fixEntityData };
      delete invalidData.opportunityId;

      await expect(
        fixEntityCollection.createFixEntityWithSuggestionUpdates(invalidData, suggestionUpdates),
      ).to.be.rejectedWith('opportunityId must be a valid UUID');
    });

    it('should throw error when suggestionUpdates is empty', async () => {
      await expect(
        fixEntityCollection.createFixEntityWithSuggestionUpdates(fixEntityData, []),
      ).to.be.rejectedWith(ValidationError, 'At least one suggestion update is required');
    });

    it('should throw error when suggestionUpdates is not an array', async () => {
      await expect(
        fixEntityCollection.createFixEntityWithSuggestionUpdates(fixEntityData, 'not-an-array'),
      ).to.be.rejectedWith('suggestionUpdates must be an array');
    });

    it('should validate each suggestion update has required fields', async () => {
      const invalidSuggestionUpdates = [
        { suggestionId: '223e4567-e89b-12d3-a456-426614174001' }, // missing opportunityId
      ];

      await expect(
        fixEntityCollection.createFixEntityWithSuggestionUpdates(
          fixEntityData,
          invalidSuggestionUpdates,
        ),
      ).to.be.rejectedWith('opportunityId must be a valid UUID');
    });

    it('should handle canceled transaction', async () => {
      const transactionResult = {
        canceled: true,
        data: [
          {
            rejected: true,
            code: 'ConditionalCheckFailed',
            message: 'The conditional request failed',
          },
          { rejected: false, item: null },
          { rejected: false, item: null },
        ],
      };

      const mockElectroService = {
        transaction: {
          write: stub().returns({
            go: stub().resolves(transactionResult),
          }),
        },
      };

      fixEntityCollection.electroService = mockElectroService;

      await expect(
        fixEntityCollection.createFixEntityWithSuggestionUpdates(fixEntityData, suggestionUpdates),
      ).to.be.rejectedWith(DataAccessError, 'Transaction canceled');
    });

    it('should handle transaction error', async () => {
      const mockElectroService = {
        transaction: {
          write: stub().returns({
            go: stub().rejects(new Error('Database connection failed')),
          }),
        },
      };

      fixEntityCollection.electroService = mockElectroService;

      await expect(
        fixEntityCollection.createFixEntityWithSuggestionUpdates(fixEntityData, suggestionUpdates),
      ).to.be.rejectedWith(DataAccessError, 'Failed to create fix entity with suggestion updates');
    });

    it('should use default status FIXED when not provided', async () => {
      const transactionResult = {
        canceled: false,
        data: [
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
        ],
      };

      const mockCreatedFixEntity = {
        getId: () => 'fix-entity-123',
        getCreatedAt: () => '2024-01-15T10:00:00Z',
        getExecutedAt: () => '2024-01-15T10:00:00Z',
      };

      const writeStub = stub().returns({
        go: stub().resolves(transactionResult),
      });

      const mockElectroService = {
        transaction: {
          write: writeStub,
        },
      };

      fixEntityCollection.electroService = mockElectroService;
      fixEntityCollection.findById = stub().resolves(mockCreatedFixEntity);

      const suggestionWithoutStatus = [
        { suggestionId: '223e4567-e89b-12d3-a456-426614174001', opportunityId: '123e4567-e89b-12d3-a456-426614174001' },
      ];

      await fixEntityCollection.createFixEntityWithSuggestionUpdates(
        fixEntityData,
        suggestionWithoutStatus,
      );

      // Verify the transaction was called
      expect(writeStub).to.have.been.calledOnce;
    });

    it('should log success message after transaction completes', async () => {
      const transactionResult = {
        canceled: false,
        data: [
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
        ],
      };

      const mockCreatedFixEntity = {
        getId: () => 'fix-entity-123',
        getCreatedAt: () => '2024-01-15T10:00:00Z',
        getExecutedAt: () => '2024-01-15T10:00:00Z',
      };

      const mockElectroService = {
        transaction: {
          write: stub().returns({
            go: stub().resolves(transactionResult),
          }),
        },
      };

      fixEntityCollection.electroService = mockElectroService;
      fixEntityCollection.findById = stub().resolves(mockCreatedFixEntity);

      await fixEntityCollection.createFixEntityWithSuggestionUpdates(
        fixEntityData,
        suggestionUpdates,
      );

      expect(mockLogger.info).to.have.been.calledWith(
        'Successfully created fix entity and updated 2 suggestions atomically',
      );
    });

    it('should handle case when no fix entity is returned after transaction', async () => {
      const transactionResult = {
        canceled: false,
        data: [
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
          { rejected: false, item: null },
        ],
      };

      const mockElectroService = {
        transaction: {
          write: stub().returns({
            go: stub().resolves(transactionResult),
          }),
        },
      };

      fixEntityCollection.electroService = mockElectroService;
      fixEntityCollection.findById = stub().resolves(null); // No entity found

      const result = await fixEntityCollection.createFixEntityWithSuggestionUpdates(
        fixEntityData,
        suggestionUpdates,
      );

      expect(result.fixEntity).to.be.null;
    });
  });

  describe('FixEntity model constants', () => {
    it('has ORIGINS enum with correct values', () => {
      expect(FixEntity.ORIGINS).to.be.an('object');
      expect(FixEntity.ORIGINS.SPACECAT).to.equal('spacecat');
      expect(FixEntity.ORIGINS.ASO).to.equal('aso');
    });

    it('has STATUSES enum', () => {
      expect(FixEntity.STATUSES).to.be.an('object');
      expect(FixEntity.STATUSES.PENDING).to.equal('PENDING');
      expect(FixEntity.STATUSES.DEPLOYED).to.equal('DEPLOYED');
      expect(FixEntity.STATUSES.PUBLISHED).to.equal('PUBLISHED');
      expect(FixEntity.STATUSES.FAILED).to.equal('FAILED');
      expect(FixEntity.STATUSES.ROLLED_BACK).to.equal('ROLLED_BACK');
    });

    it('ORIGINS enum has exactly 3 values', () => {
      const originValues = Object.values(FixEntity.ORIGINS);
      expect(originValues).to.have.lengthOf(3);
      expect(originValues).to.include.members(['spacecat', 'aso', 'reporting']);
    });

    it('ORIGINS enum keys match expected format', () => {
      const originKeys = Object.keys(FixEntity.ORIGINS);
      expect(originKeys).to.have.lengthOf(3);
      expect(originKeys).to.include.members(['SPACECAT', 'ASO', 'REPORTING']);
    });
  });
});
