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
    const suggestionIds = [
      sampleData.suggestions[0].getId(),
      sampleData.suggestions[1].getId(),
      sampleData.suggestions[2].getId(),
    ];

    const result = await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      suggestionIds,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(3);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(0);

    // Verify the relationships were created
    result.createdItems.forEach((item, index) => {
      expect(item.getFixEntityId()).to.equal(fixEntity.getId());
      expect(item.getSuggestionId()).to.equal(suggestionIds[index]);
    });
  });

  it('sets suggestions for a fix entity using suggestion objects', async () => {
    const fixEntity = sampleData.fixEntities[1];
    const suggestions = [
      sampleData.suggestions[3].getId(),
      sampleData.suggestions[4].getId(),
    ];

    const result = await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      suggestions,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(0);

    // Verify the relationships were created
    result.createdItems.forEach((item, index) => {
      expect(item.getFixEntityId()).to.equal(fixEntity.getId());
      expect(item.getSuggestionId()).to.equal(suggestions[index]);
    });
  });

  it('updates suggestions for a fix entity (removes old, adds new)', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const initialSuggestionIds = [
      sampleData.suggestions[0].getId(),
      sampleData.suggestions[1].getId(),
    ];

    // First, set initial suggestions
    await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      initialSuggestionIds,
    );

    // Then update with different suggestions
    const newSuggestionIds = [
      sampleData.suggestions[1].getId(), // Keep this one
      sampleData.suggestions[2].getId(), // Add this one
      sampleData.suggestions[3].getId(), // Add this one
    ];

    const result = await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      newSuggestionIds,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2); // Added 2 new
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(1); // Removed 1 old

    // Verify final state
    const finalSuggestions = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());
    expect(finalSuggestions).to.be.an('array').with.length(3);

    const finalSuggestionIds = finalSuggestions.map((s) => s.getId()).sort();
    expect(finalSuggestionIds).to.deep.equal(newSuggestionIds.sort());
  });

  it('sets empty array to remove all suggestions from a fix entity', async () => {
    const fixEntity = sampleData.fixEntities[1];

    // First add some suggestions
    await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      [sampleData.suggestions[0].getId(), sampleData.suggestions[1].getId()],
    );

    // Then remove all by setting empty array
    const result = await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      [],
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(0);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(2);

    // Verify no suggestions remain
    const suggestions = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());
    expect(suggestions).to.be.an('array').with.length(0);
  });

  it('throws error when fixEntityId is not provided', async () => {
    await expect(
      FixEntity.setSuggestionsByFixEntityId(null, []),
    ).to.be.rejectedWith('Validation failed in FixEntityCollection: fixEntityId must be a valid UUID');
  });

  it('sets fix entities for a suggestion using fix entity IDs', async () => {
    const suggestion = sampleData.suggestions[0];
    const fixEntityIds = [
      sampleData.fixEntities[0].getId(),
      sampleData.fixEntities[1].getId(),
    ];

    const result = await Suggestion.setFixEntitiesBySuggestionId(
      suggestion.getId(),
      fixEntityIds,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(0);

    // Verify the relationships were created
    result.createdItems.forEach((item, index) => {
      expect(item.getSuggestionId()).to.equal(suggestion.getId());
      expect(item.getFixEntityId()).to.equal(fixEntityIds[index]);
    });
  });

  it('sets fix entities for a suggestion using fix entity objects', async () => {
    const suggestion = sampleData.suggestions[1];
    const fixEntities = [
      sampleData.fixEntities[0].getId(),
      sampleData.fixEntities[2].getId(),
    ];

    const result = await Suggestion.setFixEntitiesBySuggestionId(
      suggestion.getId(),
      fixEntities,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(0);

    // Verify the relationships were created
    result.createdItems.forEach((item, index) => {
      expect(item.getSuggestionId()).to.equal(suggestion.getId());
      expect(item.getFixEntityId()).to.equal(fixEntities[index]);
    });
  });

  it('updates fix entities for a suggestion (removes old, adds new)', async () => {
    const suggestion = sampleData.suggestions[2];
    const initialFixEntityIds = [
      sampleData.fixEntities[0].getId(),
      sampleData.fixEntities[1].getId(),
    ];

    // First, set initial fix entities
    await Suggestion.setFixEntitiesBySuggestionId(
      suggestion.getId(),
      initialFixEntityIds,
    );

    // Then update with different fix entities
    const newFixEntityIds = [
      sampleData.fixEntities[1].getId(), // Keep this one
      sampleData.fixEntities[2].getId(), // Add this one
    ];

    const result = await Suggestion.setFixEntitiesBySuggestionId(
      suggestion.getId(),
      newFixEntityIds,
    );

    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(1); // Added 1 new
    expect(result.errorItems).to.be.an('array').with.length(0);
    expect(result.removedCount).to.equal(1); // Removed 1 old

    // Verify final state
    const finalFixEntities = await Suggestion.getFixEntitiesBySuggestionId(suggestion.getId());
    expect(finalFixEntities).to.be.an('array').with.length(2);

    const finalFixEntityIds = finalFixEntities.map((f) => f.getId()).sort();
    expect(finalFixEntityIds).to.deep.equal(newFixEntityIds.sort());
  });

  it('throws error when suggestionId is not provided', async () => {
    await expect(
      Suggestion.setFixEntitiesBySuggestionId(null, []),
    ).to.be.rejectedWith('Validation failed in SuggestionCollection: suggestionId must be a valid UUID');
  });

  it('gets all suggestions for a fix entity', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const suggestionIds = [
      sampleData.suggestions[0].getId(),
      sampleData.suggestions[1].getId(),
    ];

    // First set up the relationships
    await FixEntity.setSuggestionsByFixEntityId(fixEntity.getId(), suggestionIds);

    // Then retrieve them
    const result = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());

    expect(result).to.be.an('array').with.length(2);

    // Verify the suggestions are correct
    const retrievedIds = result.map((s) => s.getId()).sort();
    expect(retrievedIds).to.deep.equal(suggestionIds.sort());

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
    await Suggestion.setFixEntitiesBySuggestionId(suggestion.getId(), fixEntityIds);

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
      },
      {
        suggestionId: sampleData.suggestions[1].getId(),
        fixEntityId: sampleData.fixEntities[1].getId(),
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

    // Create a junction record first
    await FixEntitySuggestion.create({
      suggestionId,
      fixEntityId: sampleData.fixEntities[0].getId(),
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
    const fixEntityId = sampleData.fixEntities[0].getId();

    // Create a junction record first
    await FixEntitySuggestion.create({
      suggestionId: sampleData.suggestions[0].getId(),
      fixEntityId,
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
    const mixedIds = [
      sampleData.suggestions[0].getId(), // Valid
      'invalid-suggestion-id', // Invalid
      sampleData.suggestions[1].getId(), // Valid
    ];

    // This should not throw an error, but should handle validation at the junction level
    const result = await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      mixedIds,
    );

    // The behavior depends on validation - some items might be created, others might error
    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array');
    expect(result.errorItems).to.be.an('array');
  });

  it('handles duplicate suggestion IDs in the input array', async () => {
    const fixEntity = sampleData.fixEntities[1];
    const duplicateIds = [
      sampleData.suggestions[0].getId(),
      sampleData.suggestions[1].getId(),
      sampleData.suggestions[0].getId(), // Duplicate
    ];

    const result = await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      duplicateIds,
    );

    // Should only create unique relationships
    expect(result).to.be.an('object');
    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(0);
  });

  it('handles setting the same suggestions multiple times (idempotent)', async () => {
    const fixEntity = sampleData.fixEntities[2];
    const suggestionIds = [
      sampleData.suggestions[0].getId(),
      sampleData.suggestions[1].getId(),
    ];

    // Set suggestions first time
    const result1 = await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      suggestionIds,
    );

    expect(result1.createdItems).to.be.an('array').with.length(2);
    expect(result1.removedCount).to.equal(0);

    // Set the same suggestions again
    const result2 = await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      suggestionIds,
    );

    expect(result2.createdItems).to.be.an('array').with.length(0);
    expect(result2.removedCount).to.equal(0);

    // Verify final state
    const suggestions = await FixEntity.getSuggestionsByFixEntityId(fixEntity.getId());
    expect(suggestions).to.be.an('array').with.length(2);
  });

  it('maintains consistency when setting relationships from both sides', async () => {
    const fixEntity = sampleData.fixEntities[0];
    const suggestion = sampleData.suggestions[0];

    // Set relationship from FixEntity side
    await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      [suggestion.getId()],
    );

    // Verify from Suggestion side
    const fixEntitiesFromSuggestion = await Suggestion.getFixEntitiesBySuggestionId(
      suggestion.getId(),
    );
    expect(fixEntitiesFromSuggestion).to.be.an('array').with.length(1);
    expect(fixEntitiesFromSuggestion[0].getId()).to.equal(fixEntity.getId());

    // Set additional relationship from Suggestion side
    await Suggestion.setFixEntitiesBySuggestionId(
      suggestion.getId(),
      [fixEntity.getId(), sampleData.fixEntities[1].getId()],
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

    // Create relationships between fix entity and suggestions
    await FixEntity.setSuggestionsByFixEntityId(
      fixEntity.getId(),
      [suggestion1.getId(), suggestion2.getId()],
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
    await Suggestion.setFixEntitiesBySuggestionId(
      suggestion.getId(),
      [fixEntity1.getId(), fixEntity2.getId()],
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

    // Create multiple relationships
    await FixEntity.setSuggestionsByFixEntityId(
      fixEntity1.getId(),
      [suggestion1.getId(), suggestion2.getId()],
    );
    await FixEntity.setSuggestionsByFixEntityId(
      fixEntity2.getId(),
      [suggestion1.getId()], // suggestion1 is related to both fix entities
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
});
