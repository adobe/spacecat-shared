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
/* eslint-disable no-console */

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import { validate as uuidValidate } from 'uuid';

import { ValidationError } from '../../../src/index.js';

import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { removeElectroProperties } from '../util/util.js';

use(chaiAsPromised);

describe('Suggestion IT', async () => {
  let sampleData;
  let Suggestion;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Suggestion = dataAccess.Suggestion;
  });

  it('finds one suggestion by id', async () => {
    const sampleSuggestion = sampleData.suggestions[6];

    const suggestion = await Suggestion.findById(sampleSuggestion.getId());

    expect(suggestion).to.be.an('object');
    expect(suggestion.toJSON()).to.eql(removeElectroProperties(sampleSuggestion.toJSON()));

    const opportunity = await suggestion.getOpportunity();
    expect(opportunity).to.be.an('object');
    expect(opportunity.toJSON()).to.eql(sampleData.opportunities[2].toJSON());
  });

  it('partially updates one suggestion by id', async () => {
    // retrieve the suggestion by ID
    const suggestion = await Suggestion.findById(sampleData.suggestions[0].getId());
    expect(suggestion).to.be.an('object');
    expect(suggestion.toJSON()).to.eql(sampleData.suggestions[0].toJSON());

    // apply updates
    const updates = {
      status: 'APPROVED',
    };

    await suggestion
      .setStatus(updates.status)
      .save();

    // validate in-memory updates
    expect(suggestion.getStatus()).to.equal(updates.status);

    // validate unchanged fields
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      status, updatedAt, ...originalUnchangedFields
    } = sampleData.suggestions[0].toJSON();
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      status: _, updatedAt: __, ...actualUnchangedFields
    } = suggestion.toJSON();

    expect(actualUnchangedFields).to.eql(removeElectroProperties(originalUnchangedFields));

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

  it('finds all suggestions by opportunityId', async () => {
    const suggestions = await Suggestion.allByOpportunityId(sampleData.opportunities[0].getId());

    expect(suggestions).to.be.an('array').with.length(3);
  });

  it('finds all suggestions by opportunityId and status', async () => {
    const suggestions = await Suggestion.allByOpportunityIdAndStatus(
      sampleData.opportunities[0].getId(),
      'NEW',
    );

    expect(suggestions).to.be.an('array').with.length(2);
  });

  it('adds many suggestions to an opportunity', async () => {
    const opportunity = sampleData.opportunities[0];
    const data = [
      {
        type: 'CODE_CHANGE',
        rank: 0,
        status: 'NEW',
        data: { foo: 'bar' },
      },
      {
        type: 'REDIRECT_UPDATE',
        rank: 1,
        status: 'APPROVED',
        data: { foo: 'bar' },
      },
    ];

    const suggestions = await opportunity.addSuggestions(data);

    expect(suggestions).to.be.an('object');
    expect(suggestions.createdItems).to.be.an('array').with.length(2);
    expect(suggestions.errorItems).to.be.an('array').with.length(0);

    suggestions.createdItems.forEach((suggestion, index) => {
      expect(suggestion).to.be.an('object');

      expect(suggestion.getOpportunityId()).to.equal(opportunity.getId());
      expect(uuidValidate(suggestion.getId())).to.be.true;
      expect(isIsoDate(suggestion.getCreatedAt())).to.be.true;
      expect(isIsoDate(suggestion.getUpdatedAt())).to.be.true;

      const record = suggestion.toJSON();
      delete record.opportunityId;
      delete record.suggestionId;
      delete record.createdAt;
      delete record.updatedAt;

      expect(record).to.eql(data[index]);
    });
  });

  it('updates the status of multiple suggestions', async () => {
    const suggestions = sampleData.suggestions.slice(0, 3);

    await Suggestion.bulkUpdateStatus(suggestions, 'APPROVED');

    const updatedSuggestions = await Promise.all(
      suggestions.map((suggestion) => Suggestion.findById(suggestion.getId())),
    );

    updatedSuggestions.forEach((suggestion) => {
      expect(suggestion.getStatus()).to.equal('APPROVED');
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
});
