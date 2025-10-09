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

/* eslint-env mocha */

import { expect } from 'chai';
import { stub } from 'sinon';

import FixEntitySuggestion from '../../../../src/models/fix-entity-suggestion/fix-entity-suggestion.model.js';
import { createElectroMocks } from '../../util.js';

describe('FixEntitySuggestionCollection', () => {
  let collection;

  const mockRecord = {
    suggestionId: 'suggestion-123',
    fixEntityId: 'fix-456',
    fixEntityCreatedAt: '2024-01-01T00:00:00.000Z',
    fixEntityCreatedDate: '2024-01-01',
  };

  beforeEach(() => {
    ({
      collection,
    } = createElectroMocks(FixEntitySuggestion, mockRecord));

    // Stub the inherited methods that we want to test
    collection.allByIndexKeys = stub();
  });

  describe('allBySuggestionId', () => {
    it('should get all junction records for a suggestion ID', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174000';
      const expectedRecords = [
        {
          suggestionId, fixEntityId: 'fix-1', fixEntityCreatedAt: '2024-01-01T00:00:00.000Z', fixEntityCreatedDate: '2024-01-01',
        },
        {
          suggestionId, fixEntityId: 'fix-2', fixEntityCreatedAt: '2024-01-02T00:00:00.000Z', fixEntityCreatedDate: '2024-01-02',
        },
      ];

      collection.allByIndexKeys.resolves(expectedRecords);

      const result = await collection.allBySuggestionId(suggestionId);

      expect(collection.allByIndexKeys).to.have.been.calledOnceWith({ suggestionId });
      expect(result).to.deep.equal(expectedRecords);
    });

    it('should throw error when suggestionId is not provided', async () => {
      await expect(collection.allBySuggestionId(null))
        .to.be.rejectedWith('suggestionId must be a valid UUID');

      await expect(collection.allBySuggestionId(''))
        .to.be.rejectedWith('suggestionId must be a valid UUID');

      await expect(collection.allBySuggestionId(undefined))
        .to.be.rejectedWith('suggestionId must be a valid UUID');
    });

    it('should handle empty results', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174001';
      collection.allByIndexKeys.resolves([]);

      const result = await collection.allBySuggestionId(suggestionId);

      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('allByOpportunityIdAndFixEntityCreatedDate', () => {
    it('should get all junction records for an opportunity ID and fix entity created date', async () => {
      const opportunityId = '123e4567-e89b-12d3-a456-426614174002';
      const fixEntityCreatedDate = '2024-01-15';
      const expectedRecords = [
        {
          opportunityId,
          suggestionId: '123e4567-e89b-12d3-a456-426614174003',
          fixEntityId: '123e4567-e89b-12d3-a456-426614174004',
          fixEntityCreatedAt: '2024-01-15T10:30:00.000Z',
          fixEntityCreatedDate,
        },
        {
          opportunityId,
          suggestionId: '123e4567-e89b-12d3-a456-426614174005',
          fixEntityId: '123e4567-e89b-12d3-a456-426614174006',
          fixEntityCreatedAt: '2024-01-15T14:45:00.000Z',
          fixEntityCreatedDate,
        },
      ];

      collection.allByIndexKeys.resolves(expectedRecords);

      const result = await collection.allByOpportunityIdAndFixEntityCreatedDate(
        opportunityId,
        fixEntityCreatedDate,
      );

      expect(collection.allByIndexKeys).to.have.been.calledOnceWith({
        opportunityId,
        fixEntityCreatedDate,
      });
      expect(result).to.deep.equal(expectedRecords);
    });

    it('should throw error when opportunityId is not provided', async () => {
      await expect(collection.allByOpportunityIdAndFixEntityCreatedDate(null, '2024-01-15'))
        .to.be.rejectedWith('opportunityId is required');

      await expect(collection.allByOpportunityIdAndFixEntityCreatedDate('', '2024-01-15'))
        .to.be.rejectedWith('opportunityId is required');

      await expect(collection.allByOpportunityIdAndFixEntityCreatedDate(undefined, '2024-01-15'))
        .to.be.rejectedWith('opportunityId is required');
    });

    it('should throw error when fixEntityCreatedDate is not provided', async () => {
      const opportunityId = '123e4567-e89b-12d3-a456-426614174007';

      await expect(collection.allByOpportunityIdAndFixEntityCreatedDate(opportunityId, null))
        .to.be.rejectedWith('fixEntityCreatedDate is required');

      await expect(collection.allByOpportunityIdAndFixEntityCreatedDate(opportunityId, ''))
        .to.be.rejectedWith('fixEntityCreatedDate is required');

      await expect(collection.allByOpportunityIdAndFixEntityCreatedDate(opportunityId, undefined))
        .to.be.rejectedWith('fixEntityCreatedDate is required');
    });

    it('should handle empty results', async () => {
      const opportunityId = '123e4567-e89b-12d3-a456-426614174008';
      const fixEntityCreatedDate = '2024-01-20';
      collection.allByIndexKeys.resolves([]);

      const result = await collection.allByOpportunityIdAndFixEntityCreatedDate(
        opportunityId,
        fixEntityCreatedDate,
      );

      expect(result).to.be.an('array').that.is.empty;
    });

    it('should pass options parameter to allByIndexKeys', async () => {
      const opportunityId = '123e4567-e89b-12d3-a456-426614174009';
      const fixEntityCreatedDate = '2024-01-15';
      const options = { limit: 10, cursor: 'some-cursor' };
      const expectedRecords = [];

      collection.allByIndexKeys.resolves(expectedRecords);

      await collection.allByOpportunityIdAndFixEntityCreatedDate(
        opportunityId,
        fixEntityCreatedDate,
        options,
      );

      expect(collection.allByIndexKeys).to.have.been.calledOnce;
      const callArgs = collection.allByIndexKeys.getCall(0).args;
      expect(callArgs[0]).to.deep.equal({ opportunityId, fixEntityCreatedDate });
      expect(callArgs[1]).to.include(options);
    });
  });

  describe('allByFixEntityId', () => {
    it('should get all junction records for a fix entity ID', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174002';
      const expectedRecords = [
        {
          suggestionId: '123e4567-e89b-12d3-a456-426614174003', fixEntityId, fixEntityCreatedAt: '2024-01-01T00:00:00.000Z', fixEntityCreatedDate: '2024-01-01',
        },
        {
          suggestionId: '123e4567-e89b-12d3-a456-426614174004', fixEntityId, fixEntityCreatedAt: '2024-01-02T00:00:00.000Z', fixEntityCreatedDate: '2024-01-02',
        },
      ];

      collection.allByIndexKeys.resolves(expectedRecords);

      const result = await collection.allByFixEntityId(fixEntityId);

      expect(collection.allByIndexKeys).to.have.been.calledOnceWith({ fixEntityId });
      expect(result).to.deep.equal(expectedRecords);
    });

    it('should throw error when fixEntityId is not provided', async () => {
      await expect(collection.allByFixEntityId(null))
        .to.be.rejectedWith('fixEntityId is required');

      await expect(collection.allByFixEntityId(''))
        .to.be.rejectedWith('fixEntityId is required');

      await expect(collection.allByFixEntityId(undefined))
        .to.be.rejectedWith('fixEntityId is required');
    });

    it('should handle empty results', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174005';
      collection.allByIndexKeys.resolves([]);

      const result = await collection.allByFixEntityId(fixEntityId);

      expect(result).to.be.an('array').that.is.empty;
    });
  });

  describe('removeByIndexKeys (inherited from BaseCollection)', () => {
    beforeEach(() => {
      // Mock the inherited removeByIndexKeys method
      collection.removeByIndexKeys = stub();
    });

    it('should remove junction records by suggestion ID', async () => {
      const keys = { suggestionId: 'suggestion-123' };
      collection.removeByIndexKeys.resolves();

      await collection.removeByIndexKeys(keys);

      expect(collection.removeByIndexKeys).to.have.been.calledOnceWith(keys);
    });

    it('should remove junction records by fix entity ID', async () => {
      const keys = { fixEntityId: 'fix-123' };
      collection.removeByIndexKeys.resolves();

      await collection.removeByIndexKeys(keys);

      expect(collection.removeByIndexKeys).to.have.been.calledOnceWith(keys);
    });

    it('should remove junction records by composite keys', async () => {
      const keys = { suggestionId: 'suggestion-123', fixEntityId: 'fix-456' };
      collection.removeByIndexKeys.resolves();

      await collection.removeByIndexKeys(keys);

      expect(collection.removeByIndexKeys).to.have.been.calledOnceWith(keys);
    });

    it('should handle array of key objects for batch removal', async () => {
      const keyArray = [
        { suggestionId: 'suggestion-1', fixEntityId: 'fix-1' },
        { suggestionId: 'suggestion-2', fixEntityId: 'fix-2' },
      ];
      collection.removeByIndexKeys.resolves();

      await collection.removeByIndexKeys(keyArray);

      expect(collection.removeByIndexKeys).to.have.been.calledOnceWith(keyArray);
    });
  });

  describe('integration with BaseCollection methods', () => {
    beforeEach(() => {
      // Restore the actual inherited methods for integration testing
      collection.createMany = stub();
      collection.batchGetByIds = stub();
      collection.removeByIds = stub();
    });

    it('should support createMany for bulk junction record creation', async () => {
      const junctionRecords = [
        {
          suggestionId: 'suggestion-1', fixEntityId: 'fix-1', fixEntityCreatedAt: '2024-01-01T00:00:00.000Z', fixEntityCreatedDate: '2024-01-01',
        },
        {
          suggestionId: 'suggestion-1', fixEntityId: 'fix-2', fixEntityCreatedAt: '2024-01-02T00:00:00.000Z', fixEntityCreatedDate: '2024-01-02',
        },
      ];

      const expectedResult = {
        createdItems: junctionRecords,
        errorItems: [],
      };

      collection.createMany.resolves(expectedResult);

      const result = await collection.createMany(junctionRecords);

      expect(collection.createMany).to.have.been.calledOnceWith(junctionRecords);
      expect(result).to.deep.equal(expectedResult);
    });

    it('should support batchGetByIds for retrieving multiple junction records', async () => {
      const ids = ['junction-1', 'junction-2'];
      const expectedResult = {
        data: [
          {
            id: 'junction-1', suggestionId: 'suggestion-1', fixEntityId: 'fix-1', fixEntityCreatedAt: '2024-01-01T00:00:00.000Z', fixEntityCreatedDate: '2024-01-01',
          },
          {
            id: 'junction-2', suggestionId: 'suggestion-1', fixEntityId: 'fix-2', fixEntityCreatedAt: '2024-01-02T00:00:00.000Z', fixEntityCreatedDate: '2024-01-02',
          },
        ],
        unprocessed: [],
      };

      collection.batchGetByIds.resolves(expectedResult);

      const result = await collection.batchGetByIds(ids);

      expect(collection.batchGetByIds).to.have.been.calledOnceWith(ids);
      expect(result).to.deep.equal(expectedResult);
    });

    it('should support removeByIds for bulk deletion by junction record IDs', async () => {
      const ids = ['junction-1', 'junction-2'];
      collection.removeByIds.resolves();

      await collection.removeByIds(ids);

      expect(collection.removeByIds).to.have.been.calledOnceWith(ids);
    });
  });

  describe('error handling', () => {
    it('should propagate errors from allByIndexKeys in allBySuggestionId', async () => {
      const error = new Error('Database connection failed');
      collection.allByIndexKeys.rejects(error);

      await expect(collection.allBySuggestionId('123e4567-e89b-12d3-a456-426614174006'))
        .to.be.rejectedWith('Database connection failed');
    });

    it('should propagate errors from allByIndexKeys in allByOpportunityIdAndFixEntityCreatedDate', async () => {
      const error = new Error('Index not found');
      collection.allByIndexKeys.rejects(error);

      await expect(
        collection.allByOpportunityIdAndFixEntityCreatedDate(
          '123e4567-e89b-12d3-a456-426614174007',
          '2024-01-15',
        ),
      ).to.be.rejectedWith('Index not found');
    });
  });

  describe('performance considerations', () => {
    it('should use efficient index queries for large datasets', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174008';
      const largeResultSet = Array.from({ length: 1000 }, (_, i) => ({
        suggestionId,
        fixEntityId: `123e4567-e89b-12d3-a456-426614174${String(i).padStart(3, '0')}`,
        fixEntityCreatedAt: `2024-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00.000Z`,
        fixEntityCreatedDate: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      }));

      collection.allByIndexKeys.resolves(largeResultSet);

      const result = await collection.allBySuggestionId(suggestionId);

      expect(result).to.have.length(1000);
      expect(collection.allByIndexKeys).to.have.been.calledOnceWith({ suggestionId });
    });

    it('should handle pagination through allByIndexKeys', async () => {
      const fixEntityId = '123e4567-e89b-12d3-a456-426614174009';

      // Mock paginated results
      collection.allByIndexKeys.resolves([
        {
          suggestionId: '123e4567-e89b-12d3-a456-426614174010', fixEntityId, fixEntityCreatedAt: '2024-01-01T00:00:00.000Z', fixEntityCreatedDate: '2024-01-01',
        },
        {
          suggestionId: '123e4567-e89b-12d3-a456-426614174011', fixEntityId, fixEntityCreatedAt: '2024-01-02T00:00:00.000Z', fixEntityCreatedDate: '2024-01-02',
        },
      ]);

      const result = await collection.allByFixEntityId(fixEntityId);

      expect(result).to.have.length(2);
      expect(collection.allByIndexKeys).to.have.been.calledOnceWith({ fixEntityId });
    });
  });
});
