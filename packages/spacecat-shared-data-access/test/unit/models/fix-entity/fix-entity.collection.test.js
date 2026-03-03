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

  describe('rollbackFixWithSuggestionUpdates', () => {
    const fixEntityId = '123e4567-e89b-12d3-a456-426614174000';
    const opportunityId = '123e4567-e89b-12d3-a456-426614174001';
    const suggestionId1 = '123e4567-e89b-12d3-a456-426614174010';
    const suggestionId2 = '123e4567-e89b-12d3-a456-426614174011';

    let mockTransactionWrite;
    let mockTransactionGo;
    let mockGetSuggestionsByFixEntityId;
    let mockFindById;
    let mockFixEntityPatch;
    let mockSuggestionPatch;
    let rollbackMockFixEntity;
    let rollbackMockSuggestions;

    beforeEach(() => {
      mockTransactionWrite = stub();
      mockTransactionGo = stub();
      mockGetSuggestionsByFixEntityId = stub();
      mockFindById = stub();

      // Create mock fix entity with record property for rollback tests
      rollbackMockFixEntity = {
        getId: () => fixEntityId,
        record: {
          fixEntityId,
          status: 'ROLLED_BACK',
          opportunityId,
        },
      };

      // Create mock suggestion objects with record property for rollback tests
      rollbackMockSuggestions = [
        {
          getId: () => suggestionId1,
          getRank: () => 10,
          record: {
            suggestionId: suggestionId1,
            status: 'SKIPPED',
            rank: 10,
            opportunityId,
          },
        },
        {
          getId: () => suggestionId2,
          getRank: () => 11,
          record: {
            suggestionId: suggestionId2,
            status: 'SKIPPED',
            rank: 11,
            opportunityId,
          },
        },
      ];

      // Mock findById to return mock fix entity
      fixEntityCollection.findById = mockFindById;
      mockFindById.resolves(rollbackMockFixEntity);

      // Mock getSuggestionsByFixEntityId to return mock suggestions
      fixEntityCollection.getSuggestionsByFixEntityId = mockGetSuggestionsByFixEntityId;
      mockGetSuggestionsByFixEntityId.resolves(rollbackMockSuggestions);

      // Mock entity patches
      mockFixEntityPatch = stub();
      mockSuggestionPatch = stub();

      const mockCommit = stub().returns({});

      const mockFixEntitySet = stub().returns({ commit: mockCommit });
      mockFixEntityPatch.returns({ set: mockFixEntitySet });

      const mockSuggestionComposite = stub().returns({ commit: mockCommit });
      const mockSuggestionSet = stub().returns({ composite: mockSuggestionComposite });
      mockSuggestionPatch.returns({ set: mockSuggestionSet });

      // Set up electroService on the collection instance
      fixEntityCollection.electroService = {
        transaction: {
          write: mockTransactionWrite,
        },
        entities: {
          fixEntity: {
            patch: mockFixEntityPatch,
          },
          suggestion: {
            patch: mockSuggestionPatch,
          },
        },
      };

      // Call the transaction callback to execute the mutation logic
      mockTransactionWrite.callsFake((callback) => {
        const fixEntity = { patch: mockFixEntityPatch };
        const suggestion = { patch: mockSuggestionPatch };
        callback({ fixEntity, suggestion });
        return { go: mockTransactionGo };
      });
    });

    it('should throw validation error when fixEntityId is invalid', async () => {
      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          'invalid-uuid',
          opportunityId,
          'SKIPPED',
        ),
      ).to.be.rejectedWith(ValidationError, 'fixEntityId must be a valid UUID');
    });

    it('should throw validation error when opportunityId is invalid', async () => {
      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          'invalid-uuid',
          'SKIPPED',
        ),
      ).to.be.rejectedWith(ValidationError, 'opportunityId must be a valid UUID');
    });

    it('should throw validation error when newSuggestionStatus is not a string', async () => {
      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          opportunityId,
          123,
        ),
      ).to.be.rejectedWith(ValidationError, 'newSuggestionStatus is required');
    });

    it('should throw ValidationError when fix entity has no suggestions', async () => {
      mockGetSuggestionsByFixEntityId.resolves([]);

      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          opportunityId,
          'SKIPPED',
        ),
      ).to.be.rejectedWith(ValidationError, 'No suggestions found for the fix entity');
    });

    it('should successfully rollback fix with suggestions', async () => {
      // Mock transaction success (no data returned, as DynamoDB transactions don't return data)
      mockTransactionGo.resolves({
        canceled: false,
        data: [],
      });

      const result = await fixEntityCollection.rollbackFixWithSuggestionUpdates(
        fixEntityId,
        opportunityId,
        'SKIPPED',
      );

      expect(result.canceled).to.be.false;
      expect(result.fix).to.equal(rollbackMockFixEntity); // Return model instance
      expect(result.suggestions).to.deep.equal(rollbackMockSuggestions); // Return model instances
      // getSuggestionsByFixEntityId is called twice: once before transaction, once after
      expect(mockGetSuggestionsByFixEntityId).to.have.been.calledTwice;
      expect(mockGetSuggestionsByFixEntityId).to.have.always.been.calledWith(fixEntityId);
      expect(mockFindById).to.have.been.calledOnceWith(fixEntityId);
      expect(mockTransactionWrite).to.have.been.calledOnce;
      expect(mockTransactionGo).to.have.been.calledOnce;
    });

    it('should pass token option to transaction when provided', async () => {
      mockTransactionGo.resolves({
        canceled: false,
        data: [],
      });

      const token = 'test-token-123';
      await fixEntityCollection.rollbackFixWithSuggestionUpdates(
        fixEntityId,
        opportunityId,
        'SKIPPED',
        { token },
      );

      expect(mockTransactionGo).to.have.been.calledWith({ token });
      expect(mockFindById).to.have.been.calledOnceWith(fixEntityId);
    });

    it('should handle transaction cancelation with failed operations', async () => {
      // Mock transaction canceled with failed operations
      // According to ElectroDB docs, TransactionItem only has: rejected, code, message, item
      mockTransactionGo.resolves({
        canceled: true,
        data: [
          {
            rejected: true,
            code: 'ConditionalCheckFailed',
            message: 'The conditional request failed',
            item: null,
          },
          {
            rejected: false,
            item: null,
          },
        ],
      });

      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          opportunityId,
          'SKIPPED',
        ),
      ).to.be.rejectedWith(
        DataAccessError,
        'Transaction canceled: fixEntity: ConditionalCheckFailed - The conditional request failed',
      );

      expect(mockLogger.error).to.have.been.calledWith(
        'Rollback transaction was canceled',
        sinon.match.object,
      );
    });

    it('should handle transaction cancelation without detailed failure info', async () => {
      // Mock transaction canceled without detailed failure info
      mockTransactionGo.resolves({
        canceled: true,
        data: [],
      });

      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          opportunityId,
          'SKIPPED',
        ),
      ).to.be.rejectedWith(
        DataAccessError,
        'Transaction canceled: condition check failed',
      );
    });

    it('should include suggestion item type in error message for failed suggestion updates', async () => {
      // Mock transaction canceled with suggestion failure
      // According to ElectroDB docs, TransactionItem only has: rejected, code, message, item
      mockTransactionGo.resolves({
        canceled: true,
        data: [
          {
            rejected: false,
            item: null,
          },
          {
            rejected: true,
            code: 'ConditionalCheckFailed',
            message: 'Suggestion update failed',
            item: null,
          },
        ],
      });

      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          opportunityId,
          'SKIPPED',
        ),
      ).to.be.rejectedWith(
        DataAccessError,
        'suggestion: ConditionalCheckFailed',
      );
    });

    it('should handle general errors during transaction', async () => {
      const testError = new Error('Database connection failed');
      mockTransactionGo.rejects(testError);

      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          opportunityId,
          'SKIPPED',
        ),
      ).to.be.rejectedWith(DataAccessError, 'Failed to rollback fix entity with suggestion updates');

      expect(mockLogger.error).to.have.been.calledWith(
        sinon.match('Failed to rollback fix entity with suggestion updates'),
        testError,
      );
    });

    it('should handle errors when fetching suggestions', async () => {
      const fetchError = new Error('Failed to fetch suggestions');
      mockGetSuggestionsByFixEntityId.rejects(fetchError);

      await expect(
        fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          opportunityId,
          'SKIPPED',
        ),
      ).to.be.rejectedWith(DataAccessError, 'Failed to rollback fix entity with suggestion updates');

      expect(mockLogger.error).to.have.been.calledWith(
        sinon.match('Failed to rollback fix entity with suggestion updates'),
        fetchError,
      );
    });

    it('should create transaction with correct mutation structure', async () => {
      mockTransactionGo.resolves({
        canceled: false,
        data: [],
      });

      await fixEntityCollection.rollbackFixWithSuggestionUpdates(
        fixEntityId,
        opportunityId,
        'SKIPPED',
      );

      // Verify the transaction write was called with a function
      expect(mockTransactionWrite).to.have.been.calledOnce;
      const transactionFn = mockTransactionWrite.firstCall.args[0];
      expect(transactionFn).to.be.a('function');
      expect(mockFindById).to.have.been.calledOnceWith(fixEntityId);
    });

    it('should fetch suggestions using getSuggestionsByFixEntityId', async () => {
      mockTransactionGo.resolves({
        canceled: false,
        data: [],
      });

      await fixEntityCollection.rollbackFixWithSuggestionUpdates(
        fixEntityId,
        opportunityId,
        'SKIPPED',
      );

      // getSuggestionsByFixEntityId is called twice: once before transaction, once after
      expect(mockGetSuggestionsByFixEntityId).to.have.been.calledTwice;
      expect(mockGetSuggestionsByFixEntityId).to.have.always.been.calledWith(fixEntityId);
    });

    it('should handle single suggestion', async () => {
      const singleSuggestion = [rollbackMockSuggestions[0]];
      // First call (before transaction) returns both, second call (after transaction) returns one
      mockGetSuggestionsByFixEntityId
        .onFirstCall()
        .resolves(rollbackMockSuggestions)
        .onSecondCall()
        .resolves(singleSuggestion);

      mockTransactionGo.resolves({
        canceled: false,
        data: [],
      });

      const result = await fixEntityCollection.rollbackFixWithSuggestionUpdates(
        fixEntityId,
        opportunityId,
        'SKIPPED',
      );

      expect(result.canceled).to.be.false;
      expect(result.suggestions).to.have.lengthOf(1);
      expect(result.suggestions[0]).to.equal(singleSuggestion[0]); // Return model instance
    });

    it('should log success when transaction completes', async () => {
      mockTransactionGo.resolves({
        canceled: false,
        data: [],
      });

      await fixEntityCollection.rollbackFixWithSuggestionUpdates(
        fixEntityId,
        opportunityId,
        'SKIPPED',
      );

      expect(mockLogger.info).to.have.been.calledWith(
        sinon.match(/Successfully rolled back fix/),
      );
    });

    it('should use custom newSuggestionStatus parameter', async () => {
      // Create mock suggestions with custom status for post-transaction fetch
      const customStatusSuggestions = [
        {
          getId: () => suggestionId1,
          getStatus: () => 'NEW', // Custom status
          getRank: () => 10,
          record: {
            suggestionId: suggestionId1,
            status: 'NEW', // Custom status
            rank: 10,
            opportunityId,
          },
        },
      ];

      // First call returns original suggestions, second call returns updated ones
      mockGetSuggestionsByFixEntityId
        .onFirstCall()
        .resolves(rollbackMockSuggestions)
        .onSecondCall()
        .resolves(customStatusSuggestions);

      mockTransactionGo.resolves({
        canceled: false,
        data: [],
      });

      const result = await fixEntityCollection.rollbackFixWithSuggestionUpdates(
        fixEntityId,
        opportunityId,
        'NEW', // Custom status
      );

      expect(result.canceled).to.be.false;
      expect(result.suggestions[0].getStatus()).to.equal('NEW'); // Use model method
    });

    it('should throw DataAccessError when fix entity is not found after transaction', async () => {
      // Mock transaction succeeds
      mockTransactionGo.resolves({
        canceled: false,
        data: [],
      });

      // Mock findById to return null after transaction (entity not found)
      mockFindById.resolves(null);

      // Mock getSuggestionsByFixEntityId to return suggestions
      mockGetSuggestionsByFixEntityId.resolves(rollbackMockSuggestions);

      try {
        await fixEntityCollection.rollbackFixWithSuggestionUpdates(
          fixEntityId,
          opportunityId,
          'SKIPPED',
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(DataAccessError);
        expect(error.message).to.include(`Fix entity ${fixEntityId} not found after transaction`);
      }

      // Verify findById was called after transaction
      expect(mockFindById).to.have.been.calledOnceWith(fixEntityId);
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
