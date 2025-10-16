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
});
