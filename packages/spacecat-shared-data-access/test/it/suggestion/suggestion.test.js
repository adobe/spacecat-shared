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

import { isIsoDate, isValidUUID } from '@adobe/spacecat-shared-utils';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import { sanitizeIdAndAuditFields, sanitizeTimestamps } from '../../../src/util/util.js';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import ValidationError from '../../../src/errors/validation.error.js';

use(chaiAsPromised);

describe('Suggestion IT', async () => {
  let sampleData;
  let Suggestion;
  let FixEntitySuggestion;

  beforeEach(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Suggestion = dataAccess.Suggestion;
    FixEntitySuggestion = dataAccess.FixEntitySuggestion;
  });

  it('finds one suggestion by id', async () => {
    const sampleSuggestion = sampleData.suggestions[6];

    const suggestion = await Suggestion.findById(sampleSuggestion.getId());

    expect(suggestion).to.be.an('object');
    expect(
      sanitizeTimestamps(suggestion.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleSuggestion.toJSON()),
    );

    const opportunity = await suggestion.getOpportunity();
    expect(opportunity).to.be.an('object');
    expect(
      sanitizeTimestamps(opportunity.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleData.opportunities[2].toJSON()),
    );
  });

  it('resolves associations for a suggestion', async () => {
    const sampleSuggestion = sampleData.suggestions[6];

    const suggestion = await Suggestion.findById(sampleSuggestion.getId(), { resolve: true });

    const opportunity = await suggestion.getOpportunity();
    expect(opportunity).to.be.an('object');
    expect(opportunity.getId()).to.equal(suggestion.getOpportunityId());
    expect(opportunity.getId()).to.equal(sampleData.opportunities[2].getId());

    const site = await opportunity.getSite();
    expect(site).to.be.an('object');
    expect(site.getId()).to.equal(opportunity.getSiteId());
    expect(site.getId()).to.equal(sampleData.sites[0].getId());

    const organization = await site.getOrganization();
    expect(organization).to.be.an('object');
    expect(organization.getId()).to.equal(site.getOrganizationId());
    expect(organization.getId()).to.equal(sampleData.organizations[0].getId());
  });

  it('gets all suggestions by opportunityId', async () => {
    const sampleOpportunity = sampleData.opportunities[0];
    const suggestions = await Suggestion.allByOpportunityId(sampleOpportunity.getId());

    expect(suggestions).to.be.an('array').with.length(3);

    suggestions.forEach((suggestion) => {
      expect(suggestion.getOpportunityId()).to.equal(sampleOpportunity.getId());
    });

    const opportunity = await suggestions[0].getOpportunity();
    expect(opportunity).to.be.an('object');
    expect(
      sanitizeTimestamps(opportunity.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleOpportunity.toJSON()),
    );

    const suggestionsFromOpportunity = await opportunity.getSuggestions();
    expect(suggestionsFromOpportunity).to.be.an('array').with.length(3);
    suggestionsFromOpportunity.forEach((suggestion) => {
      expect(suggestion.getOpportunityId()).to.equal(sampleOpportunity.getId());
    });
  });

  it('gets all suggestions by opportunityId and status', async () => {
    const suggestions = await Suggestion.allByOpportunityIdAndStatus(
      sampleData.opportunities[0].getId(),
      'NEW',
    );

    expect(suggestions).to.be.an('array').with.length(2);

    suggestions.forEach((suggestion) => {
      expect(suggestion.getOpportunityId()).to.equal(sampleData.opportunities[0].getId());
      expect(suggestion.getStatus()).to.equal('NEW');
    });
  });

  it('updates one suggestion by id', async () => {
    // retrieve the suggestion by ID
    const suggestion = await Suggestion.findById(sampleData.suggestions[0].getId());
    expect(suggestion).to.be.an('object');
    expect(
      sanitizeTimestamps(suggestion.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleData.suggestions[0].toJSON()),
    );

    // apply updates
    const updates = {
      status: 'APPROVED',
    };

    await suggestion
      .setStatus(updates.status)
      .save();

    // validate in-memory updates
    expect(suggestion.getStatus()).to.equal(updates.status);

    const original = sanitizeTimestamps(sampleData.suggestions[0].toJSON());
    delete original.status;
    const updated = sanitizeTimestamps(suggestion.toJSON());
    delete updated.status;

    expect(updated).to.eql(original);

    // validate persistence of updates
    const storedSuggestion = await Suggestion.findById(sampleData.suggestions[0].getId());
    expect(storedSuggestion.getStatus()).to.equal(updates.status);

    // validate timestamps or audit logs
    expect(new Date(storedSuggestion.toJSON().updatedAt)).to.be.greaterThan(
      new Date(sampleData.suggestions[0].toJSON().updatedAt),
    );

    // validate persisted record matches in-memory state
    const storedWithoutUpdatedAt = { ...storedSuggestion.toJSON() };
    const inMemoryWithoutUpdatedAt = { ...suggestion.toJSON() };
    delete storedWithoutUpdatedAt.updatedAt;
    delete inMemoryWithoutUpdatedAt.updatedAt;

    expect(storedWithoutUpdatedAt).to.eql(inMemoryWithoutUpdatedAt);
  });

  it('adds many suggestions to an opportunity', async () => {
    const opportunity = sampleData.opportunities[0];
    const data = [
      {
        type: 'CODE_CHANGE',
        rank: 0,
        status: 'NEW',
        data: { foo: 'bar' },
        updatedBy: 'system',
      },
      {
        type: 'REDIRECT_UPDATE',
        rank: 1,
        status: 'APPROVED',
        data: { foo: 'bar' },
        updatedBy: 'system',
      },

    ];

    const suggestions = await opportunity.addSuggestions(data);

    expect(suggestions).to.be.an('object');
    expect(suggestions.createdItems).to.be.an('array').with.length(2);
    expect(suggestions.errorItems).to.be.an('array').with.length(0);

    suggestions.createdItems.forEach((suggestion, index) => {
      expect(suggestion).to.be.an('object');

      expect(suggestion.getOpportunityId()).to.equal(opportunity.getId());
      expect(isValidUUID(suggestion.getId())).to.be.true;
      expect(isIsoDate(suggestion.getCreatedAt())).to.be.true;
      expect(isIsoDate(suggestion.getUpdatedAt())).to.be.true;

      const record = sanitizeIdAndAuditFields('Suggestion', suggestion.toJSON());
      delete record.opportunityId;

      expect(record).to.eql(data[index]);
    });
  });

  it('updates the status of multiple suggestions', async () => {
    const suggestions = sampleData.suggestions.slice(0, 3);
    const originalUpdatedAt = suggestions[0].getUpdatedAt();

    await Suggestion.bulkUpdateStatus(suggestions, 'APPROVED');

    const updatedSuggestions = await Promise.all(
      suggestions.map((suggestion) => Suggestion.findById(suggestion.getId())),
    );

    updatedSuggestions.forEach((suggestion) => {
      expect(suggestion.getStatus()).to.equal('APPROVED');
    });

    // Verify that updatedAt was updated for all suggestions
    updatedSuggestions.forEach((suggestion) => {
      expect(new Date(suggestion.getUpdatedAt())).to.be.greaterThan(
        new Date(originalUpdatedAt),
      );
    });
  });

  it('throws an error when adding a suggestion with invalid opportunity id', async () => {
    const data = [
      {
        opportunityId: 'invalid-opportunity-id',
        type: 'CODE_CHANGE',
        rank: 0,
        status: 'NEW',
        data: { foo: 'bar' },
      },
    ];

    const results = await Suggestion.createMany(data);

    expect(results.errorItems).to.be.an('array').with.length(1);
    expect(results.createdItems).to.be.an('array').with.length(0);
    expect(results.errorItems[0].error).to.be.an.instanceOf(ValidationError);
    expect(results.errorItems[0].item).to.eql(data[0]);
  });

  it('removes a suggestion', async () => {
    const suggestion = await Suggestion.findById(sampleData.suggestions[0].getId());

    await suggestion.remove();

    const notFound = await Suggestion.findById(sampleData.suggestions[0].getId());
    expect(notFound).to.be.null;
  });

  it('gets fix entities for a single suggestion ID', async () => {
    const suggestion = sampleData.suggestions[2];
    const fixEntityIds = [
      sampleData.fixEntities[0].getId(),
      sampleData.fixEntities[2].getId(),
    ];

    // First, set up some fix entities for this suggestion using direct junction records
    const junctionData = fixEntityIds.map((fixEntityId, index) => {
      const fixEntity = sampleData.fixEntities[index * 2];
      return {
        suggestionId: suggestion.getId(),
        fixEntityId,
        opportunityId: fixEntity.getOpportunityId(),
        fixEntityCreatedAt: fixEntity.getExecutedAt() || fixEntity.getCreatedAt(),
      };
    });
    await FixEntitySuggestion.createMany(junctionData);

    // Test the single suggestion method
    const retrievedFixEntities = await Suggestion.getFixEntitiesBySuggestionId(suggestion.getId());

    expect(retrievedFixEntities).to.be.an('array').with.length(2);
    retrievedFixEntities.forEach((fixEntity) => {
      expect(fixEntity).to.be.an('object');
      expect(fixEntity.getId()).to.be.a('string');
      expect(fixEntity.getOpportunityId()).to.be.a('string');
      expect(fixEntity.getStatus()).to.be.a('string');
      expect(fixEntity.getType()).to.be.a('string');
      expect(fixEntityIds).to.include(fixEntity.getId());
    });
  });

  it('handles non-existent suggestion ID in single operations', async () => {
    const nonExistentId = '123e4567-e89b-12d3-a456-426614174999';

    const fixEntities = await Suggestion.getFixEntitiesBySuggestionId(nonExistentId);
    expect(fixEntities).to.be.an('array').with.length(0);
  });

  it('validates suggestion ID in single operations', async () => {
    const invalidId = 'invalid-id';

    await expect(
      Suggestion.getFixEntitiesBySuggestionId(invalidId),
    ).to.be.rejectedWith('Validation failed');
  });
});
