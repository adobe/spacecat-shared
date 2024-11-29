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

import { ValidationError } from '../../../src/index.js';

import fixtures from '../../fixtures/index.fixtures.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';

use(chaiAsPromised);

describe('Opportunity IT', async () => {
  const { siteId } = fixtures.sites[0];

  let sampleData;

  let Opportunity;

  before(async () => {
    sampleData = await seedDatabase();

    const dataAccess = getDataAccess();
    Opportunity = dataAccess.Opportunity;
  });

  it('finds one opportunity by id', async () => {
    const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());

    expect(opportunity).to.be.an('object');
    expect(opportunity.toJSON()).to.eql(sampleData.opportunities[0].toJSON());

    const suggestions = await opportunity.getSuggestions();
    expect(suggestions).to.be.an('array').with.length(3);

    const parentOpportunity = await suggestions[0].getOpportunity();
    expect(parentOpportunity).to.be.an('object');
    expect(parentOpportunity.toJSON()).to.eql(sampleData.opportunities[0].toJSON());
  });

  it('finds all opportunities by siteId and status', async () => {
    const opportunities = await Opportunity.allBySiteIdAndStatus(siteId, 'NEW');

    expect(opportunities).to.be.an('array').with.length(2);
  });

  it('partially updates one opportunity by id', async () => {
    // retrieve the opportunity by ID
    const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());
    expect(opportunity).to.be.an('object');
    expect(opportunity.toJSON()).to.eql(sampleData.opportunities[0].toJSON());

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
    } = sampleData.opportunities[0].toJSON();
    const {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      runbook: _, status: __, updatedAt: ___, ...actualUnchangedFields
    } = opportunity.toJSON();

    expect(actualUnchangedFields).to.eql(originalUnchangedFields);

    // validate persistence of updates
    const storedOpportunity = await Opportunity.findById(sampleData.opportunities[0].getId());
    expect(storedOpportunity.getRunbook()).to.equal(updates.runbook);
    expect(storedOpportunity.getStatus()).to.equal(updates.status);

    // validate timestamps or audit logs
    expect(new Date(storedOpportunity.toJSON().updatedAt)).to.be.greaterThan(
      new Date(sampleData.opportunities[0].toJSON().updatedAt),
    );

    // validate persisted record matches in-memory state
    const storedWithoutUpdatedAt = { ...storedOpportunity.toJSON() };
    const inMemoryWithoutUpdatedAt = { ...opportunity.toJSON() };
    delete storedWithoutUpdatedAt.updatedAt;
    delete inMemoryWithoutUpdatedAt.updatedAt;

    expect(storedWithoutUpdatedAt).to.eql(inMemoryWithoutUpdatedAt);
  });

  it('finds all opportunities by siteId', async () => {
    const opportunities = await Opportunity.allBySiteId(siteId);

    expect(opportunities).to.be.an('array').with.length(3);
  });

  it('creates a new opportunity', async () => {
    const data = {
      siteId,
      auditId: uuid(),
      title: 'New Opportunity',
      description: 'Description',
      runbook: 'https://example.com',
      type: 'broken-backlinks',
      origin: 'AI',
      status: 'NEW',
      guidance: { foo: 'bar' },
      data: { brokenLinks: ['https://example.com'] },
    };

    const opportunity = await Opportunity.create(data);

    expect(opportunity).to.be.an('object');

    expect(uuidValidate(opportunity.getId())).to.be.true;
    expect(isIsoDate(opportunity.getCreatedAt())).to.be.true;
    expect(isIsoDate(opportunity.getUpdatedAt())).to.be.true;

    const record = opportunity.toJSON();
    delete record.opportunityId;
    delete record.createdAt;
    delete record.updatedAt;
    expect(record).to.eql(data);
  });

  it('deletes an opportunity', async () => {
    const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());

    await opportunity.remove();

    const notFound = await Opportunity.findById(sampleData.opportunities[0].getId());
    await expect(notFound).to.be.null;
  });

  it('creates many opportunities', async () => {
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

    expect(opportunities).to.be.an('object');
    expect(opportunities.createdItems).to.be.an('array').with.length(2);
    expect(opportunities.errorItems).to.be.an('array').with.length(0);

    opportunities.createdItems.forEach((opportunity, index) => {
      expect(opportunity).to.be.an('object');

      expect(uuidValidate(opportunity.getId())).to.be.true;
      expect(isIsoDate(opportunity.getCreatedAt())).to.be.true;
      expect(isIsoDate(opportunity.getUpdatedAt())).to.be.true;

      const record = opportunity.toJSON();
      delete record.opportunityId;
      delete record.createdAt;
      delete record.updatedAt;

      expect(record).to.eql(data[index]);
    });
  });

  it('fails to create many opportunities with invalid data', async () => {
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
      {
        siteId,
        auditId: uuid(),
        title: 'New Opportunity 3',
        description: 'Description',
        runbook: 'https://example.com',
        type: 'broken-internal-links',
        origin: 'AI',
        status: 'NEW',
        data: { brokenInternalLinks: ['https://example.com'] },
      },
    ];

    data[2].title = null;

    const result = await Opportunity.createMany(data);

    expect(result).to.be.an('object');
    expect(result).to.have.property('createdItems');
    expect(result).to.have.property('errorItems');

    expect(result.createdItems).to.be.an('array').with.length(2);
    expect(result.errorItems).to.be.an('array').with.length(1);
    expect(result.errorItems[0].item).to.eql(data[2]);
    expect(result.errorItems[0].error).to.be.an.instanceOf(ValidationError);

    const [opportunity1, opportunity2] = result.createdItems;

    const record1 = opportunity1.toJSON();
    delete record1.opportunityId;
    delete record1.createdAt;
    delete record1.updatedAt;

    const record2 = opportunity2.toJSON();
    delete record2.opportunityId;
    delete record2.createdAt;
    delete record2.updatedAt;

    expect(record1).to.eql(data[0]);
    expect(record2).to.eql(data[1]);
  });
});
