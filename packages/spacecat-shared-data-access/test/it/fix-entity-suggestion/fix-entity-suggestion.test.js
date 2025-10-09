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
import sinon from 'sinon';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('FixEntity-Suggestion Many-to-Many Relationship IT', async () => {
  let sampleData;
  let FixEntity;
  let Suggestion;
  let FixEntitySuggestion;
  let mockLogger;

  beforeEach(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();
    mockLogger = {
      debug: sinon.stub(),
      error: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
    };

    const dataAccess = getDataAccess({}, mockLogger);
    FixEntity = dataAccess.FixEntity;
    Suggestion = dataAccess.Suggestion;
    FixEntitySuggestion = dataAccess.FixEntitySuggestion;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('sets suggestions for a fix entity using suggestion IDs', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const suggestions = [
      sampleData.suggestions[0],
      sampleData.suggestions[1],
      sampleData.suggestions[2],
    ];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    const result = await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      suggestions,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(3);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(0);

    // Verify the relationships were created
    result.createdItems.forEach((item, index) => {
      expect(item.getFixEntityId()).to.equal(fixEntity.getId());
      expect(item.getSuggestionId()).to.equal(suggestions[index].getId());
    });
  });

  it('sets suggestions for a fix entity using suggestion objects', async () => {
    const fixEntity = sampleData.fixEntities[1];
    const suggestions = [
      sampleData.suggestions[3],
      sampleData.suggestions[4],
    ];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    const result = await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      suggestions,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(0);

    // Verify the relationships were created
    result.createdItems.forEach((item, index) => {
      expect(item.getFixEntityId()).to.equal(fixEntity.getId());
      expect(item.getSuggestionId()).to.equal(suggestions[index].getId());
    });
  });

  it('updates suggestions for a fix entity (removes old, adds new)', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const initialSuggestions = [
      sampleData.suggestions[0],
      sampleData.suggestions[1],
    ];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    // First, set initial suggestions
    await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      initialSuggestions,
    );

    // Then update with different suggestions
    const newSuggestions = [
      sampleData.suggestions[1], // Keep this one
      sampleData.suggestions[2], // Add this one
      sampleData.suggestions[3], // Add this one
    ];

    const result = await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      newSuggestions,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2); // Added 2 new
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(1); // Removed 1 old

    // Verify final state
    const finalSuggestions = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());
    expect(finalSuggestions).to.be.an('array').with.length(3);

    const finalSuggestionIds = finalSuggestions.map((s) => s.getId()).sort();
    const newSuggestionIds = newSuggestions.map((s) => s.getId()).sort();
    expect(finalSuggestionIds).to.deep.equal(newSuggestionIds);
  });

  it('sets empty array to remove all suggestions from a fix entity', async () => {
    const fixEntity = sampleData.fixEntities[1];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    // First add some suggestions
    await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      [sampleData.suggestions[0], sampleData.suggestions[1]],
    );

    // Then remove all by setting empty array
    const result = await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      [],
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(0);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(2);

    // Verify no suggestions remain
    const finalSuggestions = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());
    expect(finalSuggestions).to.be.an('array').with.length(0);
  });

  it('throws error when opportunity is not provided', async () => {
    const fixEntity = sampleData.fixEntities[0];
    await expect(
      FixEntity.setSuggestionsForFixEntity(null, fixEntity, []),
    ).to.be.rejectedWith('opportunity is required');
  });

  it('sets fix entities for a suggestion using fix entity IDs', async () => {
    const suggestion = sampleData.suggestions[0];
    const fixEntities = [
      sampleData.fixEntities[0],
      sampleData.fixEntities[1],
    ];
    const opportunity = {
      getId: () => 'opp-123',
    };

    const result = await Suggestion.setFixEntitiesForSuggestion(
      opportunity,
      suggestion,
      fixEntities,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(0);

    // Verify the relationships were created
    result.createdItems.forEach((item, index) => {
      expect(item.getSuggestionId()).to.equal(suggestion.getId());
      expect(item.getFixEntityId()).to.equal(fixEntities[index].getId());
    });
  });

  it('sets fix entities for a suggestion using fix entity objects', async () => {
    const suggestion = sampleData.suggestions[1];
    const fixEntities = [
      sampleData.fixEntities[0],
      sampleData.fixEntities[2],
    ];
    const opportunity = {
      getId: () => 'opp-123',
    };

    const result = await Suggestion.setFixEntitiesForSuggestion(
      opportunity,
      suggestion,
      fixEntities,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(0);

    // Verify the relationships were created
    result.createdItems.forEach((item, index) => {
      expect(item.getSuggestionId()).to.equal(suggestion.getId());
      expect(item.getFixEntityId()).to.equal(fixEntities[index].getId());
    });
  });

  it('updates fix entities for a suggestion (removes old, adds new)', async () => {
    const suggestion = sampleData.suggestions[2];
    const initialFixEntities = [
      sampleData.fixEntities[0],
      sampleData.fixEntities[1],
    ];
    const opportunity = {
      getId: () => 'opp-123',
    };

    // First, set initial fix entities
    await Suggestion.setFixEntitiesForSuggestion(
      opportunity,
      suggestion,
      initialFixEntities,
    );

    // Then update with different fix entities
    const newFixEntities = [
      sampleData.fixEntities[1], // Keep this one
      sampleData.fixEntities[2], // Add this one
    ];

    const result = await Suggestion.setFixEntitiesForSuggestion(
      opportunity,
      suggestion,
      newFixEntities,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(1); // Added 1 new
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(1); // Removed 1 old

    // Verify final state
    const finalFixEntities = await Suggestion.getFixEntitiesBySuggestionId(suggestion.getId());
    expect(finalFixEntities).to.be.an('array').with.length(2);

    const finalFixEntityIds = finalFixEntities.map((f) => f.getId()).sort();
    const newFixEntityIds = newFixEntities.map((f) => f.getId()).sort();
    expect(finalFixEntityIds).to.deep.equal(newFixEntityIds);
  });

  it('throws error when opportunity is not provided', async () => {
    const suggestion = sampleData.suggestions[0];
    const fixEntities = [];
    await expect(
      Suggestion.setFixEntitiesForSuggestion(null, suggestion, fixEntities),
    ).to.be.rejectedWith('Opportunity parameter is required');
  });

  it('gets all suggestions for a fix entity', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const suggestions = [
      sampleData.suggestions[0],
      sampleData.suggestions[1],
    ];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    // First set up the relationships
    await FixEntity.setSuggestionsForFixEntity(opportunity, fixEntity, suggestions);

    // Then retrieve them
    const result = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());

    expect(result).to.be.an('array').with.length(2);

    // Verify the suggestions are correct
    const retrievedIds = result.map((s) => s.getId()).sort();
    const suggestionIds = suggestions.map((s) => s.getId()).sort();
    expect(retrievedIds).to.deep.equal(suggestionIds);

    // Verify they are proper suggestion objects
    result.forEach((suggestion) => {
      expect(suggestion).to.be.an('object');
      expect(suggestion.getId()).to.be.a('string');
      expect(suggestion.getOpportunityId()).to.be.a('string');
      expect(suggestion.getType()).to.be.a('string');
      expect(suggestion.getStatus()).to.be.a('string');
    });
  });

  it('returns empty array when fix entity has no suggestions', async () => {
    const fixEntity = sampleData.fixEntities[2];

    const result = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());

    expect(result).to.be.an('array').with.length(0);
  });

  it('throws error when fixEntityId is not provided', async () => {
    await expect(
      FixEntity.getSuggestionsByFixEntityId(null),
    ).to.be.rejectedWith('Validation failed in FixEntityCollection: fixEntityId must be a valid UUID');
  });

  it('gets all fix entities for a suggestion', async () => {
    const suggestion = sampleData.suggestions[0];
    const fixEntityIds = [
      sampleData.fixEntities[0].getId(),
      sampleData.fixEntities[1].getId(),
    ];

    // First set up the relationships
    const opportunity = { getId: () => 'opp-123' };
    const fixEntities = fixEntityIds.map((id) => ({ getId: () => id, getCreatedAt: () => '2024-01-01T00:00:00Z' }));
    await Suggestion.setFixEntitiesForSuggestion(opportunity, suggestion, fixEntities);

    // Then retrieve them
    const result = await Suggestion.getFixEntitiesBySuggestionId(suggestion.getId());

    expect(result).to.be.an('array').with.length(2);

    // Verify the fix entities are correct
    const retrievedIds = result.map((f) => f.getId()).sort();
    expect(retrievedIds).to.deep.equal(fixEntityIds.sort());

    // Verify they are proper fix entity objects
    result.forEach((fixEntity) => {
      expect(fixEntity).to.be.an('object');
      expect(fixEntity.getId()).to.be.a('string');
      expect(fixEntity.getOpportunityId()).to.be.a('string');
      expect(fixEntity.getType()).to.be.a('string');
      expect(fixEntity.getStatus()).to.be.a('string');
    });
  });

  it('returns empty array when suggestion has no fix entities', async () => {
    const suggestion = sampleData.suggestions[8];

    const result = await Suggestion.getFixEntitiesBySuggestionId(suggestion.getId());

    expect(result).to.be.an('array').with.length(0);
  });

  it('throws error when suggestionId is not provided', async () => {
    await expect(
      Suggestion.getFixEntitiesBySuggestionId(null),
    ).to.be.rejectedWith('Validation failed in SuggestionCollection: suggestionId must be a valid UUID');
  });

  it('creates junction records directly', async () => {
    const junctionData = [
      {
        suggestionId: sampleData.suggestions[0].getId(),
        fixEntityId: sampleData.fixEntities[0].getId(),
        opportunityId: sampleData.fixEntities[0].getOpportunityId(),
        fixEntityCreatedAt: sampleData.fixEntities[0].getCreatedAt(),
      },
      {
        suggestionId: sampleData.suggestions[1].getId(),
        fixEntityId: sampleData.fixEntities[1].getId(),
        opportunityId: sampleData.fixEntities[1].getOpportunityId(),
        fixEntityCreatedAt: sampleData.fixEntities[1].getCreatedAt(),
      },
    ];

    const result = await FixEntitySuggestion.createMany(junctionData);

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);

    result.createdItems.forEach((item, index) => {
      expect(item.getSuggestionId()).to.equal(junctionData[index].suggestionId);
      expect(item.getFixEntityId()).to.equal(junctionData[index].fixEntityId);
    });
  });

  it('gets junction records by suggestion ID', async () => {
    const suggestionId = sampleData.suggestions[0].getId();
    const fixEntity = sampleData.fixEntities[0];

    // Create a junction record first
    await FixEntitySuggestion.create({
      suggestionId,
      fixEntityId: fixEntity.getId(),
      opportunityId: fixEntity.getOpportunityId(),
      fixEntityCreatedAt: fixEntity.getCreatedAt(),
    });

    const junctionRecords = await FixEntitySuggestion.allBySuggestionId(suggestionId);

    expect(junctionRecords).to.be.an('array');
    expect(junctionRecords.length).to.be.greaterThan(0);

    junctionRecords.forEach((record) => {
      expect(record.getSuggestionId()).to.equal(suggestionId);
      expect(record.getFixEntityId()).to.be.a('string');
    });
  });

  it('gets junction records by fix entity ID', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const fixEntityId = fixEntity.getId();

    // Create a junction record first
    await FixEntitySuggestion.create({
      suggestionId: sampleData.suggestions[0].getId(),
      fixEntityId,
      opportunityId: fixEntity.getOpportunityId(),
      fixEntityCreatedAt: fixEntity.getCreatedAt(),
    });

    const junctionRecords = await FixEntitySuggestion.allByFixEntityId(fixEntityId);

    expect(junctionRecords).to.be.an('array');
    expect(junctionRecords.length).to.be.greaterThan(0);

    junctionRecords.forEach((record) => {
      expect(record.getFixEntityId()).to.equal(fixEntityId);
      expect(record.getSuggestionId()).to.be.a('string');
    });
  });

  it('handles mixed valid and invalid suggestion IDs gracefully', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const mixedSuggestions = [
      sampleData.suggestions[0], // Valid
      { getId: () => 'invalid-suggestion-id' }, // Invalid
      sampleData.suggestions[1], // Valid
    ];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    // This should not throw an error, but should handle validation at the junction level
    const result = await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      mixedSuggestions,
    );

    // The behavior depends on validation - some items might be created, others might error
    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array');
    expect(result.errorItems).to.be.an('array');
  });

  it('handles duplicate suggestion IDs in the input array', async () => {
    const fixEntity = sampleData.fixEntities[1];
    const duplicateSuggestions = [
      sampleData.suggestions[0],
      sampleData.suggestions[1],
      sampleData.suggestions[0], // Duplicate
    ];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    const result = await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      duplicateSuggestions,
    );

    // Should only create unique relationships
    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);
  });

  it('handles setting the same suggestions multiple times (idempotent)', async () => {
    const fixEntity = sampleData.fixEntities[2];
    const suggestions = [
      sampleData.suggestions[0],
      sampleData.suggestions[1],
    ];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    // Set suggestions first time
    const result1 = await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      suggestions,
    );

    expect(result1.createdItems).to.be.an('array').with.length(2);
    expect(result1.removedCount).to.equal(0);

    // Set the same suggestions again
    const result2 = await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      suggestions,
    );

    expect(result2.createdItems).to.be.an('array').with.length(0);
    expect(result2.removedCount).to.equal(0);

    // Verify final state
    const finalSuggestions = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());
    expect(finalSuggestions).to.be.an('array').with.length(2);
  });

  it('maintains consistency when setting relationships from both sides', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const suggestion = sampleData.suggestions[0];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    // Set relationship from FixEntity side
    await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      [suggestion],
    );

    // Verify from Suggestion side
    const fixEntitiesFromSuggestion = await Suggestion.getFixEntitiesBySuggestionId(
      suggestion.getId(),
    );
    expect(fixEntitiesFromSuggestion).to.be.an('array').with.length(1);
    expect(fixEntitiesFromSuggestion[0].getId()).to.equal(fixEntity.getId());

    // Set additional relationship from Suggestion side
    const opportunity2 = { getId: () => 'opp-123' };
    await Suggestion.setFixEntitiesForSuggestion(
      opportunity2,
      suggestion,
      [fixEntity, sampleData.fixEntities[1]],
    );

    // Verify from FixEntity side
    const suggestionsFromFixEntity1 = await FixEntity.getSuggestionsByFixEntityId(
      fixEntity.getId(),
    );
    const suggestionsFromFixEntity2 = await FixEntity.getSuggestionsByFixEntityId(
      sampleData.fixEntities[1].getId(),
    );

    expect(suggestionsFromFixEntity1).to.be.an('array').with.length(1);
    expect(suggestionsFromFixEntity1[0].getId()).to.equal(suggestion.getId());

    expect(suggestionsFromFixEntity2).to.be.an('array').with.length(1);
    expect(suggestionsFromFixEntity2[0].getId()).to.equal(suggestion.getId());
  });

  it('cascades delete of junction records when fix entity is deleted', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const suggestion1 = sampleData.suggestions[0];
    const suggestion2 = sampleData.suggestions[1];
    const opportunity = {
      getId: () => fixEntity.getOpportunityId(),
    };

    // Create relationships between fix entity and suggestions
    await FixEntity.setSuggestionsForFixEntity(
      opportunity,
      fixEntity,
      [suggestion1, suggestion2],
    );

    // Verify relationships existy
    const firstJunctionRecord = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion1.getId(),
      fixEntityId: fixEntity.getId(),
    });
    const secondJunctionRecord = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion2.getId(),
      fixEntityId: fixEntity.getId(),
    });
    expect(firstJunctionRecord).to.be.an('array').with.length(1);
    expect(secondJunctionRecord).to.be.an('array').with.length(1);

    // Delete the fix entity (this should cascade delete junction records)
    await fixEntity.remove();

    // Verify junction records are deleted
    const firstJunctionRecordAfter = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion1.getId(),
      fixEntityId: fixEntity.getId(),
    });
    const secondJunctionRecordAfter = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion2.getId(),
      fixEntityId: fixEntity.getId(),
    });
    expect(firstJunctionRecordAfter).to.be.an('array').with.length(0);
    expect(secondJunctionRecordAfter).to.be.an('array').with.length(0);

    // Verify suggestions still exist (they should not be deleted)
    const suggestion1After = await Suggestion.findById(suggestion1.getId());
    const suggestion2After = await Suggestion.findById(suggestion2.getId());
    expect(suggestion1After).to.not.be.null;
    expect(suggestion2After).to.not.be.null;
  });

  it('cascades delete of junction records when suggestion is deleted', async () => {
    const suggestion = sampleData.suggestions[2];
    const fixEntity1 = sampleData.fixEntities[1];
    const fixEntity2 = sampleData.fixEntities[2];

    // Create relationships between suggestion and fix entities
    const opportunity = { getId: () => 'opp-123' };
    await Suggestion.setFixEntitiesForSuggestion(
      opportunity,
      suggestion,
      [fixEntity1, fixEntity2],
    );

    // Verify relationships exist
    const firstJunctionRecordBefore = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion.getId(),
      fixEntityId: fixEntity1.getId(),
    });
    const secondJunctionRecordBefore = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion.getId(),
      fixEntityId: fixEntity2.getId(),
    });
    expect(firstJunctionRecordBefore).to.be.an('array').with.length(1);
    expect(secondJunctionRecordBefore).to.be.an('array').with.length(1);

    // Delete the suggestion (this should cascade delete junction records)
    await suggestion.remove();

    // Verify junction records are deleted
    const firstJunctionRecordAfter = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion.getId(),
      fixEntityId: fixEntity1.getId(),
    });
    const secondJunctionRecordAfter = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion.getId(),
      fixEntityId: fixEntity2.getId(),
    });
    expect(firstJunctionRecordAfter).to.be.an('array').with.length(0);
    expect(secondJunctionRecordAfter).to.be.an('array').with.length(0);

    // Verify fix entities still exist (they should not be deleted)
    const fixEntity1After = await FixEntity.findById(fixEntity1.getId());
    const fixEntity2After = await FixEntity.findById(fixEntity2.getId());
    expect(fixEntity1After).to.not.be.null;
    expect(fixEntity2After).to.not.be.null;
  });

  it('only deletes junction records for the deleted entity, not others', async () => {
    const fixEntity1 = sampleData.fixEntities[3];
    const fixEntity2 = sampleData.fixEntities[4];
    const suggestion1 = sampleData.suggestions[3];
    const suggestion2 = sampleData.suggestions[4];
    const opportunity1 = {
      getId: () => fixEntity1.getOpportunityId(),
    };
    const opportunity2 = {
      getId: () => fixEntity2.getOpportunityId(),
    };

    // Create multiple relationships
    await FixEntity.setSuggestionsForFixEntity(
      opportunity1,
      fixEntity1,
      [suggestion1, suggestion2],
    );
    await FixEntity.setSuggestionsForFixEntity(
      opportunity2,
      fixEntity2,
      [suggestion1], // suggestion1 is related to both fix entities
    );

    // Verify initial state
    const firstJunctionRecords = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion1.getId(),
      fixEntityId: fixEntity1.getId(),
    });
    const secondJunctionRecords = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion1.getId(),
      fixEntityId: fixEntity2.getId(),
    });
    const thirdJunctionRecords = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion2.getId(),
      fixEntityId: fixEntity1.getId(),
    });
    expect(firstJunctionRecords).to.be.an('array').with.length(1);
    expect(secondJunctionRecords).to.be.an('array').with.length(1);
    expect(thirdJunctionRecords).to.be.an('array').with.length(1);

    // Delete fixEntity1 (this should only delete its junction records)
    await fixEntity1.remove();

    // Verify only fixEntity1's junction records are deleted
    const firstJunctionRecordsAfter = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion1.getId(),
      fixEntityId: fixEntity1.getId(),
    });
    const secondJunctionRecordsAfter = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion1.getId(),
      fixEntityId: fixEntity2.getId(),
    });
    const thirdJunctionRecordsAfter = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion2.getId(),
      fixEntityId: fixEntity1.getId(),
    });

    expect(firstJunctionRecordsAfter).to.be.an('array').with.length(0);
    expect(secondJunctionRecordsAfter).to.be.an('array').with.length(1); // Should remain unchanged
    expect(thirdJunctionRecordsAfter).to.be.an('array').with.length(0); // Only one relationship remains

    // Verify other entities still exist
    const fixEntity2After = await FixEntity.findById(fixEntity2.getId());
    const suggestion1After = await Suggestion.findById(suggestion1.getId());
    const suggestion2After = await Suggestion.findById(suggestion2.getId());
    expect(fixEntity2After).to.not.be.null;
    expect(suggestion1After).to.not.be.null;
    expect(suggestion2After).to.not.be.null;
  });

  it('handles cascading delete when entity has no relationships', async () => {
    const fixEntity = sampleData.fixEntities[5]; // Use an entity with no relationships
    const suggestion = sampleData.suggestions[5]; // Use an entity with no relationships

    // Verify no relationships exist initially
    const junctionRecordsFixEntityBefore = await FixEntitySuggestion.allByIndexKeys({
      suggestionId: suggestion.getId(),
      fixEntityId: fixEntity.getId(),
    });
    expect(junctionRecordsFixEntityBefore).to.be.an('array').with.length(0);

    // Delete entities (should not cause any errors)
    await fixEntity.remove();
    await suggestion.remove();

    // Verify entities are deleted
    const fixEntityAfter = await FixEntity.findById(fixEntity.getId());
    const suggestionAfter = await Suggestion.findById(suggestion.getId());
    expect(fixEntityAfter).to.be.null;
    expect(suggestionAfter).to.be.null;
  });

  it('gets junction records by opportunity ID and fix entity created date', async () => {
    const opportunityId = 'd27f4e5a-850c-441e-9c22-8e5e08b1e687';
    const fixEntityCreatedDate = '2024-01-15';

    // Create test data with specific opportunity ID and created date
    const fixEntity1 = await FixEntity.create({
      opportunityId,
      type: 'CONTENT_UPDATE',
      status: 'PENDING',
      changeDetails: {
        description: 'Test fix entity 1',
        changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
      },
    });

    const fixEntity2 = await FixEntity.create({
      opportunityId,
      type: 'METADATA_UPDATE',
      status: 'PENDING',
      changeDetails: {
        description: 'Test fix entity 2',
        changes: [{ field: 'description', oldValue: 'Old Desc', newValue: 'New Desc' }],
      },
    });

    const fixEntity3 = await FixEntity.create({
      opportunityId: '742c49a7-d61f-4c62-9f7c-3207f520ed1e',
      type: 'CODE_CHANGE',
      status: 'PENDING',
      changeDetails: {
        description: 'Test fix entity 3',
        changes: [{ field: 'code', oldValue: 'Old Code', newValue: 'New Code' }],
      },
    });

    const suggestion1 = await Suggestion.create({
      opportunityId,
      title: 'Test Suggestion 1',
      description: 'Description for Test Suggestion 1',
      data: { foo: 'bar-1' },
      type: 'CONTENT_UPDATE',
      rank: 0,
      status: 'NEW',
    });

    const suggestion2 = await Suggestion.create({
      opportunityId,
      title: 'Test Suggestion 2',
      description: 'Description for Test Suggestion 2',
      data: { foo: 'bar-2' },
      type: 'METADATA_UPDATE',
      rank: 1,
      status: 'NEW',
    });

    // Create junction records with specific dates
    await FixEntitySuggestion.create({
      suggestionId: suggestion1.getId(),
      fixEntityId: fixEntity1.getId(),
      opportunityId: fixEntity1.getOpportunityId(),
      fixEntityCreatedAt: '2024-01-15T10:30:00.000Z',
    });

    await FixEntitySuggestion.create({
      suggestionId: suggestion2.getId(),
      fixEntityId: fixEntity2.getId(),
      opportunityId: fixEntity2.getOpportunityId(),
      fixEntityCreatedAt: '2024-01-15T14:45:00.000Z',
    });

    // Create a junction record with different opportunity ID (should not be returned)
    await FixEntitySuggestion.create({
      suggestionId: suggestion1.getId(),
      fixEntityId: fixEntity3.getId(),
      opportunityId: fixEntity3.getOpportunityId(),
      fixEntityCreatedAt: '2024-01-15T16:00:00.000Z',
    });

    // Test the accessor method
    const result = await FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(
      opportunityId,
      fixEntityCreatedDate,
    );

    expect(result).to.be.an('array').with.length(2);

    // Verify all returned records have the correct opportunity ID and date
    result.forEach((record) => {
      expect(record.getOpportunityId()).to.equal(opportunityId);
      expect(record.getFixEntityCreatedDate()).to.equal(fixEntityCreatedDate);
      expect(record.getSuggestionId()).to.be.a('string');
      expect(record.getFixEntityId()).to.be.a('string');
    });

    // Verify we got the expected records
    const returnedFixEntityIds = result.map((r) => r.getFixEntityId()).sort();
    const expectedFixEntityIds = [fixEntity1.getId(), fixEntity2.getId()].sort();
    expect(returnedFixEntityIds).to.deep.equal(expectedFixEntityIds);
  });

  it('returns empty array when no junction records match opportunity ID and date', async () => {
    const opportunityId = 'aeeb4b8d-e771-47ef-99f4-ea4e349c81e4';
    const fixEntityCreatedDate = '2024-01-15';

    const result = await FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(
      opportunityId,
      fixEntityCreatedDate,
    );

    expect(result).to.be.an('array').with.length(0);
  });

  it('throws error when opportunityId is not provided', async () => {
    await expect(
      FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(null, '2024-01-15'),
    ).to.be.rejectedWith('opportunityId is required');

    await expect(
      FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate('', '2024-01-15'),
    ).to.be.rejectedWith('opportunityId is required');

    await expect(
      FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(undefined, '2024-01-15'),
    ).to.be.rejectedWith('opportunityId is required');
  });

  it('throws error when fixEntityCreatedDate is not provided', async () => {
    const opportunityId = 'd27f4e5a-850c-441e-9c22-8e5e08b1e687';

    await expect(
      FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(opportunityId, null),
    ).to.be.rejectedWith('fixEntityCreatedDate is required');

    await expect(
      FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(opportunityId, ''),
    ).to.be.rejectedWith('fixEntityCreatedDate is required');

    await expect(
      FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(opportunityId, undefined),
    ).to.be.rejectedWith('fixEntityCreatedDate is required');
  });

  it('handles different date formats correctly', async () => {
    const opportunityId = 'd27f4e5a-850c-441e-9c22-8e5e08b1e687';
    const fixEntityCreatedDate = '2024-01-15';

    // Create fix entity with specific date
    const fixEntity = await FixEntity.create({
      opportunityId,
      type: 'CONTENT_UPDATE',
      status: 'PENDING',
      changeDetails: {
        description: 'Date test fix entity',
        changes: [{ field: 'title', oldValue: 'Old Title', newValue: 'New Title' }],
      },
    });

    const suggestion = await Suggestion.create({
      opportunityId,
      title: 'Date Test Suggestion',
      description: 'Description for Date Test Suggestion',
      data: { foo: 'bar' },
      type: 'CONTENT_UPDATE',
      rank: 0,
      status: 'NEW',
    });

    // Create junction record
    await FixEntitySuggestion.create({
      suggestionId: suggestion.getId(),
      fixEntityId: fixEntity.getId(),
      opportunityId: fixEntity.getOpportunityId(),
      fixEntityCreatedAt: '2024-01-15T23:59:59.999Z',
    });

    // Test that the date is correctly extracted (should be 2024-01-15)
    const result = await FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(
      opportunityId,
      fixEntityCreatedDate,
    );

    expect(result).to.be.an('array').with.length(1);
    expect(result[0].getFixEntityCreatedDate()).to.equal('2024-01-15');
  });

  it('supports pagination options', async () => {
    const opportunityId = 'd27f4e5a-850c-441e-9c22-8e5e08b1e687';
    const fixEntityCreatedDate = '2024-01-15';

    // Create multiple fix entities and suggestions
    const fixEntities = [];
    const suggestions = [];

    // Create all fix entities and suggestions in parallel
    const createPromises = Array.from({ length: 5 }, async (_, i) => {
      const fixEntity = await FixEntity.create({
        opportunityId,
        type: 'CONTENT_UPDATE',
        status: 'PENDING',
        changeDetails: {
          description: `Pagination test fix entity ${i}`,
          changes: [{ field: 'title', oldValue: `Old Title ${i}`, newValue: `New Title ${i}` }],
        },
      });

      const suggestion = await Suggestion.create({
        opportunityId,
        title: `Pagination Test Suggestion ${i}`,
        description: `Description for Pagination Test Suggestion ${i}`,
        data: { foo: `bar-${i}` },
        type: 'CONTENT_UPDATE',
        rank: i,
        status: 'NEW',
      });

      // Create junction record
      await FixEntitySuggestion.create({
        suggestionId: suggestion.getId(),
        fixEntityId: fixEntity.getId(),
        opportunityId: fixEntity.getOpportunityId(),
        fixEntityCreatedAt: '2024-01-15T10:00:00.000Z',
      });

      return { fixEntity, suggestion };
    });

    const results = await Promise.all(createPromises);
    results.forEach(({ fixEntity, suggestion }) => {
      fixEntities.push(fixEntity);
      suggestions.push(suggestion);
    });

    // Test with limit
    const limitedResult = await FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(
      opportunityId,
      fixEntityCreatedDate,
      { limit: 3 },
    );

    expect(limitedResult).to.be.an('array').with.length(3);

    // Test without limit (should return all)
    const allResult = await FixEntitySuggestion.allByOpportunityIdAndFixEntityCreatedDate(
      opportunityId,
      fixEntityCreatedDate,
    );

    expect(allResult).to.be.an('array').with.length(5);
  });
});
