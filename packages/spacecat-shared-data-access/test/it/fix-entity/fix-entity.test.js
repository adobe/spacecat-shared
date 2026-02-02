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
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import fixEntityFixtures from '../../fixtures/fix-entity.fixture.js';

use(chaiAsPromised);

function checkSuggestion(suggestion) {
  expect(suggestion).to.be.an('object');
  expect(suggestion.getId()).to.be.a('string');
  expect(suggestion.getOpportunityId()).to.be.a('string');
  expect(suggestion.getStatus()).to.be.a('string');
  expect(suggestion.getType()).to.be.a('string');
}

function checkFixEntity(fixEntity) {
  expect(fixEntity).to.be.an('object');
  expect(fixEntity.getId()).to.be.a('string');
  expect(fixEntity.getOpportunityId()).to.be.a('string');
  expect(fixEntity.getStatus()).to.be.a('string');
  expect(fixEntity.getType()).to.be.a('string');
  expect(fixEntity.getChangeDetails()).to.be.an('object');
  expect(fixEntity.getOrigin()).to.be.a('string');
}

describe('FixEntity IT', async () => {
  let FixEntity;
  let Suggestion;
  let sampleData;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    FixEntity = dataAccess.FixEntity;
    Suggestion = dataAccess.Suggestion;
  });

  it('finds one fix entity by id', async () => {
    const sampleFixEntity = sampleData.fixEntities[0];
    const fixEntity = await FixEntity.findById(sampleFixEntity.getId());

    expect(fixEntity).to.be.an('object');
    expect(fixEntity.getOpportunityId()).to.equal(fixEntityFixtures[0].opportunityId);
  });

  it('gets all fix entities for an opportunity', async () => {
    const { opportunityId } = fixEntityFixtures[0];

    const fixEntities = await FixEntity.allByOpportunityId(opportunityId);

    expect(fixEntities).to.be.an('array');
    expect(fixEntities.length).to.be.greaterThan(0);

    fixEntities.forEach((fixEntity) => {
      checkFixEntity(fixEntity);
      expect(fixEntity.getOpportunityId()).to.equal(opportunityId);
    });
  });

  it('gets all fix entities for an opportunity by status', async () => {
    const { opportunityId } = fixEntityFixtures[1];

    const fixEntities = await FixEntity.allByOpportunityIdAndStatus(opportunityId, 'FAILED');

    expect(fixEntities).to.be.an('array');
    expect(fixEntities.length).to.be.greaterThan(0);

    fixEntities.forEach((fixEntity) => {
      checkFixEntity(fixEntity);
      expect(fixEntity.getOpportunityId()).to.equal(opportunityId);
      expect(fixEntity.getStatus()).to.equal('FAILED');
    });
  });

  it('creates a fix entity', async () => {
    const data = {
      opportunityId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
      status: 'PENDING',
      type: 'CONTENT_UPDATE',
      changeDetails: {
        description: 'Fixes a typo in the content',
        changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
      },
    };

    const fixEntity = await FixEntity.create(data);

    checkFixEntity(fixEntity);

    expect(fixEntity.getOpportunityId()).to.equal(data.opportunityId);
    expect(fixEntity.getStatus()).to.equal(data.status);
    expect(fixEntity.getType()).to.equal(data.type);
  });

  it('updates a fix entity', async () => {
    const fixEntity = await FixEntity.findById(sampleData.fixEntities[0].getId());

    const updates = {
      status: 'DEPLOYED',
    };

    fixEntity.setStatus(updates.status);

    await fixEntity.save();

    const updatedFixEntity = await FixEntity.findById(sampleData.fixEntities[0].getId());

    checkFixEntity(updatedFixEntity);

    expect(updatedFixEntity.getStatus()).to.equal(updates.status);
  });

  it('removes a fix entity', async () => {
    const fixEntity = await FixEntity.findById(sampleData.fixEntities[0].getId());

    await fixEntity.remove();

    const notFound = await FixEntity.findById(sampleData.fixEntities[0].getId());
    expect(notFound).to.equal(null);
  });

  describe('origin attribute', () => {
    it('creates a fix entity with explicit origin "spacecat"', async () => {
      const data = {
        opportunityId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
        status: 'PENDING',
        type: 'CONTENT_UPDATE',
        origin: 'spacecat',
        changeDetails: {
          description: 'Fixes a typo in the content',
          changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
        },
      };

      const fixEntity = await FixEntity.create(data);

      checkFixEntity(fixEntity);
      expect(fixEntity.getOrigin()).to.equal('spacecat');
    });

    it('creates a fix entity with explicit origin "aso"', async () => {
      const data = {
        opportunityId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
        status: 'PENDING',
        type: 'CONTENT_UPDATE',
        origin: 'aso',
        changeDetails: {
          description: 'Fixes a typo in the content',
          changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
        },
      };

      const fixEntity = await FixEntity.create(data);

      checkFixEntity(fixEntity);
      expect(fixEntity.getOrigin()).to.equal('aso');
    });

    it('creates a fix entity without origin (defaults to "spacecat")', async () => {
      const data = {
        opportunityId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
        status: 'PENDING',
        type: 'CONTENT_UPDATE',
        changeDetails: {
          description: 'Fixes a typo in the content',
          changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
        },
      };

      const fixEntity = await FixEntity.create(data);

      checkFixEntity(fixEntity);
      expect(fixEntity.getOrigin()).to.equal('spacecat'); // default value
    });

    it('rejects invalid origin values', async () => {
      const data = {
        opportunityId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
        status: 'PENDING',
        type: 'CONTENT_UPDATE',
        origin: 'invalid-origin',
        changeDetails: {
          description: 'Fixes a typo in the content',
          changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
        },
      };

      await expect(FixEntity.create(data)).to.be.rejected;
    });

    it('updates a fix entity origin', async () => {
      const data = {
        opportunityId: 'd27f4e5a-850c-441e-9c22-8e5e08b1e687',
        status: 'PENDING',
        type: 'CONTENT_UPDATE',
        origin: 'spacecat',
        changeDetails: {
          description: 'Fixes a typo in the content',
          changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
        },
      };

      const fixEntity = await FixEntity.create(data);
      expect(fixEntity.getOrigin()).to.equal('spacecat');

      // Update origin
      fixEntity.setOrigin('aso');
      await fixEntity.save();

      // Verify the update persisted
      const updatedFixEntity = await FixEntity.findById(fixEntity.getId());
      expect(updatedFixEntity.getOrigin()).to.equal('aso');
    });

    it('validates existing fix entities have origin attribute', async () => {
      const { opportunityId } = fixEntityFixtures[0];
      const fixEntities = await FixEntity.allByOpportunityId(opportunityId);

      fixEntities.forEach((fixEntity) => {
        checkFixEntity(fixEntity);
        // Should have origin from fixtures or default to 'spacecat'
        expect(['spacecat', 'aso']).to.include(fixEntity.getOrigin());
      });
    });
  });
  it('gets suggestions for a fix entity', async () => {
    const fixEntity = sampleData.fixEntities[0];

    // First, set up some suggestions for this fix entity
    const suggestionsToSet = [
      sampleData.suggestions[0],
      sampleData.suggestions[1],
    ];

    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    await FixEntity.setSuggestionsForFixEntity(opportunity.getId(), fixEntity, suggestionsToSet);

    // Test the model method
    const suggestions = await fixEntity.getSuggestions();

    expect(suggestions).to.be.an('array').with.length(2);
    suggestions.forEach((suggestion) => {
      checkSuggestion(suggestion);
      expect(suggestionsToSet.map((s) => s.getId())).to.include(suggestion.getId());
    });
  });

  it('gets all fixes with suggestions by created date', async () => {
    // First, create some fix entities with specific created dates
    const opportunityId = 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4';
    const fixEntityCreatedDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format

    // Create fix entities with the same opportunity and created date
    const fixEntity1 = await FixEntity.create({
      opportunityId,
      status: 'PENDING',
      type: 'CONTENT_UPDATE',
      changeDetails: {
        description: 'Test fix entity 1',
        changes: [{ field: 'title', oldValue: 'Old', newValue: 'New' }],
      },
    });

    const fixEntity2 = await FixEntity.create({
      opportunityId,
      status: 'PENDING',
      type: 'METADATA_UPDATE',
      changeDetails: {
        description: 'Test fix entity 2',
        changes: [{ field: 'description', oldValue: 'Old', newValue: 'New' }],
      },
    });

    // Create suggestions
    const suggestion1 = await Suggestion.create({
      opportunityId,
      title: 'Test Suggestion 1',
      description: 'Description for suggestion 1',
      data: {
        foo: 'bar-1',
      },
      type: 'CODE_CHANGE',
      rank: 0,
      status: 'NEW',
    });

    const suggestion2 = await Suggestion.create({
      opportunityId,
      title: 'Test Suggestion 2',
      description: 'Description for suggestion 2',
      data: {
        foo: 'bar-2',
      },
      type: 'CODE_CHANGE',
      rank: 1,
      status: 'NEW',
    });

    const suggestion3 = await Suggestion.create({
      opportunityId,
      title: 'Test Suggestion 3',
      description: 'Description for suggestion 3',
      data: {
        foo: 'bar-3',
      },
      type: 'CODE_CHANGE',
      rank: 2,
      status: 'NEW',
    });

    // Set up relationships between fix entities and suggestions
    const opportunity = { getId: () => opportunityId };

    // Associate suggestion1 and suggestion2 with fixEntity1
    await FixEntity
      .setSuggestionsForFixEntity(opportunity.getId(), fixEntity1, [suggestion1, suggestion2]);

    // Associate suggestion3 with fixEntity2
    await FixEntity.setSuggestionsForFixEntity(opportunity.getId(), fixEntity2, [suggestion3]);

    // Test the getAllFixesWithSuggestionByCreatedAt method
    const result = await FixEntity.getAllFixesWithSuggestionByCreatedAt(
      opportunityId,
      fixEntityCreatedDate,
    );

    expect(result).to.be.an('array');
    expect(result.length).to.equal(2);

    // Check the structure of each result
    result.forEach((item) => {
      expect(item).to.have.property('fixEntity');
      expect(item).to.have.property('suggestions');
      expect(item.suggestions).to.be.an('array');

      checkFixEntity(item.fixEntity);
      expect(item.fixEntity.getOpportunityId()).to.equal(opportunityId);

      item.suggestions.forEach((suggestion) => {
        checkSuggestion(suggestion);
        expect(suggestion.getOpportunityId()).to.equal(opportunityId);
      });
    });

    // Verify that we have the correct fix entities
    const fixEntityIds = result.map((item) => item.fixEntity.getId());
    expect(fixEntityIds).to.include(fixEntity1.getId());
    expect(fixEntityIds).to.include(fixEntity2.getId());

    // Verify that fixEntity1 has 2 suggestions and fixEntity2 has 1 suggestion
    const fixEntity1Result = result.find((item) => item.fixEntity.getId() === fixEntity1.getId());
    const fixEntity2Result = result.find((item) => item.fixEntity.getId() === fixEntity2.getId());

    expect(fixEntity1Result.suggestions).to.have.length(2);
    expect(fixEntity2Result.suggestions).to.have.length(1);

    // Verify the suggestion IDs match
    const fixEntity1SuggestionIds = fixEntity1Result.suggestions.map((s) => s.getId());
    expect(fixEntity1SuggestionIds).to.include(suggestion1.getId());
    expect(fixEntity1SuggestionIds).to.include(suggestion2.getId());

    const fixEntity2SuggestionIds = fixEntity2Result.suggestions.map((s) => s.getId());
    expect(fixEntity2SuggestionIds).to.include(suggestion3.getId());
  });

  it('returns empty array when no fixes found for given opportunity and date', async () => {
    const opportunityId = '00000000-0000-0000-0000-000000000000';
    const fixEntityCreatedDate = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format

    const result = await FixEntity.getAllFixesWithSuggestionByCreatedAt(
      opportunityId,
      fixEntityCreatedDate,
    );

    expect(result).to.be.an('array');
    expect(result.length).to.equal(0);
  });

  it('validates required parameters', async () => {
    const today = new Date().toISOString().split('T')[0]; // Today's date in YYYY-MM-DD format

    // Test missing opportunityId
    await expect(
      FixEntity.getAllFixesWithSuggestionByCreatedAt(null, today),
    ).to.be.rejectedWith('opportunityId must be a valid UUID');

    // Test missing fixEntityCreatedDate
    await expect(
      FixEntity.getAllFixesWithSuggestionByCreatedAt('aeeb4b8d-e771-47ef-99f4-ea4e349c81e4', null),
    ).to.be.rejectedWith('fixEntityCreatedDate is required');
  });

  describe('rollbackFixWithSuggestionUpdates', () => {
    let testFixEntity;
    let testSuggestion1;
    let testSuggestion2;
    const testOpportunityId = 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4';

    beforeEach(async function () {
      this.timeout(10000);

      // Create a FAILED fix entity for rollback testing
      testFixEntity = await FixEntity.create({
        opportunityId: testOpportunityId,
        status: 'FAILED',
        type: 'CONTENT_UPDATE',
        changeDetails: {
          description: 'Test fix for rollback',
          changes: [{ field: 'title', oldValue: 'Old', newValue: 'New' }],
        },
      });

      // Create suggestions in ERROR status
      testSuggestion1 = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Test Suggestion 1 for Rollback',
        description: 'Description for suggestion 1',
        data: { foo: 'bar-1' },
        type: 'CODE_CHANGE',
        rank: 10,
        status: 'ERROR',
      });

      testSuggestion2 = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Test Suggestion 2 for Rollback',
        description: 'Description for suggestion 2',
        data: { foo: 'bar-2' },
        type: 'CODE_CHANGE',
        rank: 11,
        status: 'ERROR',
      });
    });

    it('successfully rolls back a FAILED fix and updates suggestions from ERROR to SKIPPED', async () => {
      const suggestionUpdates = [
        { suggestionId: testSuggestion1.getId() },
        { suggestionId: testSuggestion2.getId() },
      ];

      const result = await FixEntity.rollbackFixWithSuggestionUpdates(
        testFixEntity.getId(),
        testOpportunityId,
        suggestionUpdates,
      );

      expect(result).to.be.an('object');
      expect(result.canceled).to.be.false;
      expect(result.data).to.be.an('array');

      // Verify the fix entity was updated to ROLLED_BACK
      const updatedFix = await FixEntity.findById(testFixEntity.getId());
      expect(updatedFix.getStatus()).to.equal('ROLLED_BACK');

      // Verify suggestions were updated to SKIPPED
      const updatedSuggestion1 = await Suggestion.findById(testSuggestion1.getId());
      const updatedSuggestion2 = await Suggestion.findById(testSuggestion2.getId());

      expect(updatedSuggestion1.getStatus()).to.equal('SKIPPED');
      expect(updatedSuggestion2.getStatus()).to.equal('SKIPPED');
    });

    it('rejects with ValidationError when fixEntityId is invalid', async () => {
      const suggestionUpdates = [{ suggestionId: testSuggestion1.getId() }];

      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          'invalid-id',
          testOpportunityId,
          suggestionUpdates,
        ),
      ).to.be.rejectedWith('fixEntityId must be a valid UUID');
    });

    it('rejects with ValidationError when opportunityId is invalid', async () => {
      const suggestionUpdates = [{ suggestionId: testSuggestion1.getId() }];

      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          testFixEntity.getId(),
          'invalid-id',
          suggestionUpdates,
        ),
      ).to.be.rejectedWith('opportunityId must be a valid UUID');
    });

    it('rejects with ValidationError when suggestionUpdates is not an array', async () => {
      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          testFixEntity.getId(),
          testOpportunityId,
          'not-an-array',
        ),
      ).to.be.rejectedWith('suggestionUpdates must be an array');
    });

    it('rejects with ValidationError when suggestionUpdates is empty', async () => {
      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          testFixEntity.getId(),
          testOpportunityId,
          [],
        ),
      ).to.be.rejectedWith('At least one suggestion update is required');
    });

    it('rejects with ValidationError when suggestionId in update is invalid', async () => {
      const suggestionUpdates = [
        { suggestionId: 'invalid-id' },
      ];

      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          testFixEntity.getId(),
          testOpportunityId,
          suggestionUpdates,
        ),
      ).to.be.rejectedWith('suggestionId must be a valid UUID');
    });

    it('throws DataAccessError when fix entity is not in FAILED status (transaction canceled)', async () => {
      // Create a fix entity in DEPLOYED status instead of FAILED
      const deployedFixEntity = await FixEntity.create({
        opportunityId: testOpportunityId,
        status: 'DEPLOYED',
        type: 'CONTENT_UPDATE',
        changeDetails: {
          description: 'Test fix in DEPLOYED status',
          changes: [{ field: 'title', oldValue: 'Old', newValue: 'New' }],
        },
      });

      const suggestionUpdates = [{ suggestionId: testSuggestion1.getId() }];

      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          deployedFixEntity.getId(),
          testOpportunityId,
          suggestionUpdates,
        ),
      ).to.be.rejectedWith('Transaction canceled');
    });

    it('throws DataAccessError when suggestion is not in ERROR status (transaction canceled)', async () => {
      // Create a suggestion in NEW status instead of ERROR
      const newSuggestion = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Test Suggestion in NEW status',
        description: 'Description for suggestion',
        data: { foo: 'bar' },
        type: 'CODE_CHANGE',
        rank: 12,
        status: 'NEW',
      });

      const suggestionUpdates = [{ suggestionId: newSuggestion.getId() }];

      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          testFixEntity.getId(),
          testOpportunityId,
          suggestionUpdates,
        ),
      ).to.be.rejectedWith('Transaction canceled');

      // Verify fix entity was NOT updated
      const fixAfterFailure = await FixEntity.findById(testFixEntity.getId());
      expect(fixAfterFailure.getStatus()).to.equal('FAILED');

      // Verify suggestion was NOT updated
      const suggestionAfterFailure = await Suggestion.findById(newSuggestion.getId());
      expect(suggestionAfterFailure.getStatus()).to.equal('NEW');
    });

    it('throws DataAccessError when one suggestion is in wrong status (partial transaction failure)', async () => {
      // Create one valid suggestion in ERROR status and one in NEW status
      const validSuggestion = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Valid Suggestion',
        description: 'In ERROR status',
        data: { foo: 'valid' },
        type: 'CODE_CHANGE',
        rank: 13,
        status: 'ERROR',
      });

      const invalidSuggestion = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Invalid Suggestion',
        description: 'In NEW status',
        data: { foo: 'invalid' },
        type: 'CODE_CHANGE',
        rank: 14,
        status: 'NEW',
      });

      const suggestionUpdates = [
        { suggestionId: validSuggestion.getId() },
        { suggestionId: invalidSuggestion.getId() },
      ];

      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          testFixEntity.getId(),
          testOpportunityId,
          suggestionUpdates,
        ),
      ).to.be.rejectedWith('Transaction canceled');

      // Verify atomicity: fix entity should NOT be updated
      const fixAfterFailure = await FixEntity.findById(testFixEntity.getId());
      expect(fixAfterFailure.getStatus()).to.equal('FAILED');

      // Verify atomicity: valid suggestion should NOT be updated either
      const validSuggestionAfterFailure = await Suggestion.findById(validSuggestion.getId());
      expect(validSuggestionAfterFailure.getStatus()).to.equal('ERROR');

      // Verify invalid suggestion remains unchanged
      const invalidSuggestionAfterFailure = await Suggestion.findById(invalidSuggestion.getId());
      expect(invalidSuggestionAfterFailure.getStatus()).to.equal('NEW');
    });

    it('throws DataAccessError when fix entity does not exist (transaction canceled)', async () => {
      const nonExistentFixId = '00000000-0000-0000-0000-000000000000';
      const suggestionUpdates = [{ suggestionId: testSuggestion1.getId() }];

      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          nonExistentFixId,
          testOpportunityId,
          suggestionUpdates,
        ),
      ).to.be.rejectedWith('Transaction canceled');
    });

    it('throws error when suggestion does not exist (fails to fetch rank)', async () => {
      const nonExistentSuggestionId = '00000000-0000-0000-0000-000000000000';
      const suggestionUpdates = [{ suggestionId: nonExistentSuggestionId }];

      // This will fail during the rank fetching phase, before the transaction
      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          testFixEntity.getId(),
          testOpportunityId,
          suggestionUpdates,
        ),
      ).to.be.rejected;

      // Verify fix entity was NOT updated due to early failure
      const fixAfterFailure = await FixEntity.findById(testFixEntity.getId());
      expect(fixAfterFailure.getStatus()).to.equal('FAILED');
    });

    it('successfully handles multiple suggestions with different ranks', async () => {
      // Create suggestions with different ranks
      const suggestion1 = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Suggestion rank 100',
        description: 'Description',
        data: { foo: 'bar' },
        type: 'CODE_CHANGE',
        rank: 100,
        status: 'ERROR',
      });

      const suggestion2 = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Suggestion rank 200',
        description: 'Description',
        data: { foo: 'bar' },
        type: 'CODE_CHANGE',
        rank: 200,
        status: 'ERROR',
      });

      const suggestion3 = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Suggestion rank 300',
        description: 'Description',
        data: { foo: 'bar' },
        type: 'CODE_CHANGE',
        rank: 300,
        status: 'ERROR',
      });

      const suggestionUpdates = [
        { suggestionId: suggestion1.getId() },
        { suggestionId: suggestion2.getId() },
        { suggestionId: suggestion3.getId() },
      ];

      const result = await FixEntity.rollbackFixWithSuggestionUpdates(
        testFixEntity.getId(),
        testOpportunityId,
        suggestionUpdates,
      );

      expect(result.canceled).to.be.false;

      // Verify all suggestions were updated
      const updatedSuggestion1 = await Suggestion.findById(suggestion1.getId());
      const updatedSuggestion2 = await Suggestion.findById(suggestion2.getId());
      const updatedSuggestion3 = await Suggestion.findById(suggestion3.getId());

      expect(updatedSuggestion1.getStatus()).to.equal('SKIPPED');
      expect(updatedSuggestion2.getStatus()).to.equal('SKIPPED');
      expect(updatedSuggestion3.getStatus()).to.equal('SKIPPED');
    });

    it('maintains transaction atomicity when both fix and suggestions fail conditions', async () => {
      // Create a fix in PENDING status (not FAILED) and suggestion in NEW status (not ERROR)
      const wrongStatusFix = await FixEntity.create({
        opportunityId: testOpportunityId,
        status: 'PENDING',
        type: 'CONTENT_UPDATE',
        changeDetails: {
          description: 'Fix in wrong status',
          changes: [{ field: 'title', oldValue: 'Old', newValue: 'New' }],
        },
      });

      const wrongStatusSuggestion = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Suggestion in wrong status',
        description: 'Description',
        data: { foo: 'bar' },
        type: 'CODE_CHANGE',
        rank: 15,
        status: 'FIXED',
      });

      const suggestionUpdates = [{ suggestionId: wrongStatusSuggestion.getId() }];

      await expect(
        FixEntity.rollbackFixWithSuggestionUpdates(
          wrongStatusFix.getId(),
          testOpportunityId,
          suggestionUpdates,
        ),
      ).to.be.rejectedWith('Transaction canceled');

      // Verify neither entity was modified
      const fixAfter = await FixEntity.findById(wrongStatusFix.getId());
      const suggestionAfter = await Suggestion.findById(wrongStatusSuggestion.getId());

      expect(fixAfter.getStatus()).to.equal('PENDING');
      expect(suggestionAfter.getStatus()).to.equal('FIXED');
    });

    it('returns transaction result with proper structure', async () => {
      const suggestionUpdates = [
        { suggestionId: testSuggestion1.getId() },
      ];

      const result = await FixEntity.rollbackFixWithSuggestionUpdates(
        testFixEntity.getId(),
        testOpportunityId,
        suggestionUpdates,
      );

      expect(result).to.have.property('canceled');
      expect(result).to.have.property('data');
      expect(result.canceled).to.be.false;
      expect(result.data).to.be.an('array');
      expect(result.data.length).to.equal(2); // 1 fix + 1 suggestion

      // The transaction succeeded, so verify the entities were actually updated
      const updatedFix = await FixEntity.findById(testFixEntity.getId());
      const updatedSuggestion = await Suggestion.findById(testSuggestion1.getId());

      expect(updatedFix.getStatus()).to.equal('ROLLED_BACK');
      expect(updatedSuggestion.getStatus()).to.equal('SKIPPED');
    });

    it('handles suggestions with rank value of 0', async () => {
      const suggestionWithZeroRank = await Suggestion.create({
        opportunityId: testOpportunityId,
        title: 'Suggestion with rank 0',
        description: 'Description',
        data: { foo: 'bar' },
        type: 'CODE_CHANGE',
        rank: 0,
        status: 'ERROR',
      });

      const suggestionUpdates = [{ suggestionId: suggestionWithZeroRank.getId() }];

      const result = await FixEntity.rollbackFixWithSuggestionUpdates(
        testFixEntity.getId(),
        testOpportunityId,
        suggestionUpdates,
      );

      expect(result.canceled).to.be.false;

      const updatedSuggestion = await Suggestion.findById(suggestionWithZeroRank.getId());
      expect(updatedSuggestion.getStatus()).to.equal('SKIPPED');
    });
  });
});
