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
import { v4 as uuid, validate as uuidValidate } from 'uuid';

import SCHEMA from '../../../docs/schema.json' with { type: 'json' };
import { createDataAccess } from '../../../src/service/index.js';

import { closeDynamoClients, getDynamoClients } from '../util/db.js';
import { createTable, deleteTable } from '../util/tableOperations.js';

use(chaiAsPromised);

const DATA_TABLE_NAME = 'spacecat-services-data';

const setupDb = async (client, table) => {
  await deleteTable(client, table);

  const schema = SCHEMA.DataModel.find((model) => model.TableName === table);
  await createTable(client, schema);
};

const generateSampleData = async (dataAccess, siteId) => {
  const { Opportunity, Suggestion } = dataAccess;
  const sampleData = { opportunities: [], suggestions: [] };

  for (let i = 0; i < 10; i += 1) {
    const type = i % 2 === 0 ? 'broken-backlinks' : 'broken-internal-links';
    const status = i % 2 === 0 ? 'NEW' : 'IN_PROGRESS';
    const data = type === 'broken-backlinks'
      ? { brokenLinks: [`foo-${i}`] }
      : { brokenInternalLinks: [`bar-${i}`] };

    // eslint-disable-next-line no-await-in-loop
    const opportunity = await Opportunity.create({
      siteId,
      auditId: uuid(),
      title: `Opportunity ${i}`,
      description: `Description ${i}`,
      runbook: `https://example${i}.com`,
      type,
      origin: 'AI',
      status,
      data,
    });

    sampleData.opportunities.push(opportunity);

    // generate suggestions for each opportunity
    for (let j = 0; j < 3; j += 1) {
      // eslint-disable-next-line no-await-in-loop
      const suggestion = await Suggestion.create({
        opportunityId: opportunity.getId(),
        title: `Suggestion ${j} for Opportunity ${i}`,
        description: `Description for Suggestion ${j} of Opportunity ${i}`,
        data: { foo: `bar-${j}` },
        type: 'CODE_CHANGE',
        rank: j,
        status: 'NEW',
      });

      sampleData.suggestions.push(suggestion);
    }
  }

  return sampleData;
};

// eslint-disable-next-line func-names
describe('Opportunity & Suggestion IT', function () {
  this.timeout(30000);

  const siteId = uuid();

  let dataAccess;
  let sampleData;

  before(async () => {
    const { dbClient } = await getDynamoClients();

    await setupDb(dbClient, DATA_TABLE_NAME);

    dataAccess = createDataAccess({ tableNameData: DATA_TABLE_NAME }, console);

    sampleData = await generateSampleData(dataAccess, siteId);
  });

  after(async () => {
    await closeDynamoClients();
  });

  describe('Opportunity', () => {
    it('finds one opportunity by id', async () => {
      const { Opportunity } = dataAccess;

      const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());

      expect(opportunity).to.be.an('object');
      expect(opportunity.record).to.eql(sampleData.opportunities[0].record);

      const suggestions = await opportunity.getSuggestions();
      expect(suggestions).to.be.an('array').with.length(3);

      const parentOpportunity = await suggestions[0].getOpportunity();
      expect(parentOpportunity).to.be.an('object');
      expect(parentOpportunity.record).to.eql(sampleData.opportunities[0].record);
    });

    it('finds all opportunities by siteId and status', async () => {
      const { Opportunity } = dataAccess;

      const opportunities = await Opportunity.allBySiteIdAndStatus(siteId, 'NEW');

      expect(opportunities).to.be.an('array').with.length(5);
    });

    it('partially updates one opportunity by id', async () => {
      const { Opportunity } = dataAccess;

      // retrieve the opportunity by ID
      const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());
      expect(opportunity).to.be.an('object');
      expect(opportunity.record).to.eql(sampleData.opportunities[0].record);

      // apply updates
      const updates = {
        runbook: 'https://example-updated.com',
        status: 'IN_PROGRESS',
      };

      opportunity
        .setRunbook(updates.runbook)
        .setStatus(updates.status);

      expect(() => {
        opportunity.setAuditId('invalid-audit-id');
      }).to.throw(Error);

      await opportunity.save();

      // validate in-memory updates
      expect(opportunity.getRunbook()).to.equal(updates.runbook);
      expect(opportunity.getStatus()).to.equal(updates.status);

      // validate unchanged fields
      const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
        runbook, status, updatedAt, ...originalUnchangedFields
      } = sampleData.opportunities[0].record;
      const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
        runbook: _, status: __, updatedAt: ___, ...actualUnchangedFields
      } = opportunity.record;

      expect(actualUnchangedFields).to.eql(originalUnchangedFields);

      // validate persistence of updates
      const storedOpportunity = await Opportunity.findById(sampleData.opportunities[0].getId());
      expect(storedOpportunity.getRunbook()).to.equal(updates.runbook);
      expect(storedOpportunity.getStatus()).to.equal(updates.status);

      // validate timestamps or audit logs
      expect(new Date(storedOpportunity.record.updatedAt)).to.be.greaterThan(
        new Date(sampleData.opportunities[0].record.updatedAt),
      );

      // validate persisted record matches in-memory state
      const storedWithoutUpdatedAt = { ...storedOpportunity.record };
      const inMemoryWithoutUpdatedAt = { ...opportunity.record };
      delete storedWithoutUpdatedAt.updatedAt;
      delete inMemoryWithoutUpdatedAt.updatedAt;

      expect(storedWithoutUpdatedAt).to.eql(inMemoryWithoutUpdatedAt);
    });

    it('finds all opportunities by siteId', async () => {
      const { Opportunity } = dataAccess;

      const opportunities = await Opportunity.allBySiteId(siteId);

      expect(opportunities).to.be.an('array').with.length(10);
    });

    it('creates a new opportunity', async () => {
      const { Opportunity } = dataAccess;
      const data = {
        siteId,
        auditId: uuid(),
        title: 'New Opportunity',
        description: 'Description',
        runbook: 'https://example.com',
        type: 'broken-backlinks',
        origin: 'AI',
        status: 'NEW',
        data: { brokenLinks: ['https://example.com'] },
      };

      const opportunity = await Opportunity.create(data);

      expect(opportunity).to.be.an('object');

      expect(uuidValidate(opportunity.getId())).to.be.true;
      expect(isIsoDate(opportunity.getCreatedAt())).to.be.true;
      expect(isIsoDate(opportunity.getUpdatedAt())).to.be.true;

      delete opportunity.record.opportunityId;
      delete opportunity.record.createdAt;
      delete opportunity.record.updatedAt;
      expect(opportunity.record).to.eql(data);
    });

    it('deletes an opportunity', async () => {
      const { Opportunity } = dataAccess;

      const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());

      await opportunity.remove();

      const notFound = await Opportunity.findById(sampleData.opportunities[0].getId());
      await expect(notFound).to.be.null;
    });

    it('creates many opportunities', async () => {
      const { Opportunity } = dataAccess;
      const data = [
        {
          siteId,
          auditId: uuid(),
          title: 'New Opportunity 1',
          description: 'Description',
          runbook: 'https://example.com',
          type: 'broken-backlinks',
          origin: 'AI',
          status: 'NEW',
          data: { brokenLinks: ['https://example.com'] },
        },
        {
          siteId,
          auditId: uuid(),
          title: 'New Opportunity 2',
          description: 'Description',
          runbook: 'https://example.com',
          type: 'broken-internal-links',
          origin: 'AI',
          status: 'NEW',
          data: { brokenInternalLinks: ['https://example.com'] },
        },
      ];

      const opportunities = await Opportunity.createMany(data);

      expect(opportunities).to.be.an('array').with.length(2);

      opportunities.forEach((opportunity, index) => {
        expect(opportunity).to.be.an('object');

        expect(uuidValidate(opportunity.getId())).to.be.true;
        expect(isIsoDate(opportunity.getCreatedAt())).to.be.true;
        expect(isIsoDate(opportunity.getUpdatedAt())).to.be.true;

        const { record } = opportunity;
        delete record.opportunityId;
        delete record.createdAt;
        delete record.updatedAt;
        delete record.sk;
        delete record.pk;
        delete record.gsi1pk;
        delete record.gsi1sk;
        delete record.gsi2pk;
        delete record.gsi2sk;
        // eslint-disable-next-line no-underscore-dangle
        delete record.__edb_e__;
        // eslint-disable-next-line no-underscore-dangle
        delete record.__edb_v__;
        expect(record).to.eql(data[index]);
      });
    });
  });

  describe('Suggestion', () => {
    it('finds one suggestion by id', async () => {
      const { Suggestion } = dataAccess;
      const sampleSuggestion = sampleData.suggestions[6];

      const suggestion = await Suggestion.findById(sampleSuggestion.getId());

      expect(suggestion).to.be.an('object');
      expect(suggestion.record).to.eql(sampleSuggestion.record);

      const opportunity = await suggestion.getOpportunity();
      expect(opportunity).to.be.an('object');
      expect(opportunity.record).to.eql(sampleData.opportunities[2].record);
    });

    it('partially updates one suggestion by id', async () => {
      const { Suggestion } = dataAccess;

      // retrieve the suggestion by ID
      const suggestion = await Suggestion.findById(sampleData.suggestions[0].getId());
      expect(suggestion).to.be.an('object');
      expect(suggestion.record).to.eql(sampleData.suggestions[0].record);

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
      } = sampleData.suggestions[0].record;
      const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
        status: _, updatedAt: __, ...actualUnchangedFields
      } = suggestion.record;

      expect(actualUnchangedFields).to.eql(originalUnchangedFields);

      // validate persistence of updates
      const storedSuggestion = await Suggestion.findById(sampleData.suggestions[0].getId());
      expect(storedSuggestion.getStatus()).to.equal(updates.status);

      // validate timestamps or audit logs
      expect(new Date(storedSuggestion.record.updatedAt)).to.be.greaterThan(
        new Date(sampleData.suggestions[0].record.updatedAt),
      );

      // validate persisted record matches in-memory state
      const storedWithoutUpdatedAt = { ...storedSuggestion.record };
      const inMemoryWithoutUpdatedAt = { ...suggestion.record };
      delete storedWithoutUpdatedAt.updatedAt;
      delete inMemoryWithoutUpdatedAt.updatedAt;

      expect(storedWithoutUpdatedAt).to.eql(inMemoryWithoutUpdatedAt);
    });

    it('finds all suggestions by opportunityId', async () => {
      const { Suggestion } = dataAccess;

      const suggestions = await Suggestion.allByOpportunityId(sampleData.opportunities[0].getId());

      expect(suggestions).to.be.an('array').with.length(3);
    });

    it('finds all suggestions by opportunityId and status', async () => {
      const { Suggestion } = dataAccess;

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

      expect(suggestions).to.be.an('array').with.length(2);

      suggestions.forEach((suggestion, index) => {
        expect(suggestion).to.be.an('object');

        expect(suggestion.getOpportunityId()).to.equal(opportunity.getId());
        expect(uuidValidate(suggestion.getId())).to.be.true;
        expect(isIsoDate(suggestion.getCreatedAt())).to.be.true;
        expect(isIsoDate(suggestion.getUpdatedAt())).to.be.true;

        const { record } = suggestion;
        delete record.opportunityId;
        delete record.suggestionId;
        delete record.createdAt;
        delete record.updatedAt;
        delete record.sk;
        delete record.pk;
        delete record.gsi1pk;
        delete record.gsi1sk;
        delete record.gsi2pk;
        delete record.gsi2sk;
        // eslint-disable-next-line no-underscore-dangle
        delete record.__edb_e__;
        // eslint-disable-next-line no-underscore-dangle
        delete record.__edb_v__;
        expect(record).to.eql(data[index]);
      });
    });
  });
});
