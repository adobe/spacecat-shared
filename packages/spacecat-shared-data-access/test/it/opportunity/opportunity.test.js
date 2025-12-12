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
import sinon from 'sinon';
import sinonChai from 'sinon-chai';

import { ValidationError } from '../../../src/index.js';

import fixtures from '../../fixtures/index.fixtures.js';
import { getDataAccess } from '../util/db.js';
import { seedDatabase } from '../util/seed.js';
import { sanitizeIdAndAuditFields, sanitizeTimestamps } from '../../../src/util/util.js';

use(chaiAsPromised);
use(sinonChai);

describe('Opportunity IT', async () => {
  const { siteId } = fixtures.sites[0];

  let sampleData;
  let mockLogger;

  let Opportunity;
  let Suggestion;
  let FixEntity;
  let FixEntitySuggestion;

  before(async function () {
    this.timeout(10000);
    sampleData = await seedDatabase();

    mockLogger = {
      debug: sinon.stub(),
      error: sinon.stub(),
      info: sinon.stub(),
      warn: sinon.stub(),
    };

    const dataAccess = getDataAccess({}, mockLogger);
    Opportunity = dataAccess.Opportunity;
    Suggestion = dataAccess.Suggestion;
    FixEntity = dataAccess.FixEntity;
    FixEntitySuggestion = dataAccess.FixEntitySuggestion;
  });

  afterEach(() => {
    sinon.restore();
  });

  it('finds one opportunity by id', async () => {
    const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());

    expect(opportunity).to.be.an('object');
    expect(
      sanitizeTimestamps(opportunity.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleData.opportunities[0].toJSON()),
    );

    const suggestions = await opportunity.getSuggestions();
    expect(suggestions).to.be.an('array').with.length(3);

    const parentOpportunity = await suggestions[0].getOpportunity();
    expect(parentOpportunity).to.be.an('object');
    expect(
      sanitizeTimestamps(opportunity.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleData.opportunities[0].toJSON()),
    );
  });

  it('finds all opportunities by siteId and status', async () => {
    const opportunities = await Opportunity.allBySiteIdAndStatus(siteId, 'NEW');

    expect(opportunities).to.be.an('array').with.length(2);
  });

  it('partially updates one opportunity by id', async () => {
    // retrieve the opportunity by ID
    const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());
    expect(opportunity).to.be.an('object');
    expect(
      sanitizeTimestamps(opportunity.toJSON()),
    ).to.eql(
      sanitizeTimestamps(sampleData.opportunities[0].toJSON()),
    );

    // apply updates
    const updates = {
      runbook: 'https://example-updated.com',
      status: 'IN_PROGRESS',
    };

    opportunity
      .setRunbook(updates.runbook)
      .setStatus(updates.status);

    // opportunity.setAuditId('invalid-audit-id');

    await opportunity.save();

    expect(opportunity.getRunbook()).to.equal(updates.runbook);
    expect(opportunity.getStatus()).to.equal(updates.status);

    const updated = sanitizeTimestamps(opportunity.toJSON());
    delete updated.runbook;
    delete updated.status;

    const original = sanitizeTimestamps(sampleData.opportunities[0].toJSON());
    delete original.runbook;
    delete original.status;

    expect(updated).to.eql(original);

    const storedOpportunity = await Opportunity.findById(sampleData.opportunities[0].getId());
    expect(storedOpportunity.getRunbook()).to.equal(updates.runbook);
    expect(storedOpportunity.getStatus()).to.equal(updates.status);

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
      auditId: crypto.randomUUID(),
      title: 'New Opportunity',
      description: 'Description',
      runbook: 'https://example.com',
      type: 'broken-backlinks',
      origin: 'AI',
      status: 'NEW',
      guidance: { foo: 'bar' },
      data: { brokenLinks: ['https://example.com'] },
      updatedBy: 'system',
    };

    const opportunity = await Opportunity.create(data);

    expect(opportunity).to.be.an('object');

    expect(isValidUUID(opportunity.getId())).to.be.true;
    expect(isIsoDate(opportunity.getCreatedAt())).to.be.true;
    expect(isIsoDate(opportunity.getUpdatedAt())).to.be.true;

    const record = opportunity.toJSON();
    delete record.opportunityId;
    delete record.createdAt;
    delete record.updatedAt;
    expect(record).to.eql(data);
  });

  it('creates a new opportunity without auditId', async () => {
    const data = {
      siteId,
      title: 'New Opportunity',
      description: 'Description',
      runbook: 'https://example.com',
      type: 'broken-backlinks',
      origin: 'AI',
      status: 'NEW',
      guidance: { foo: 'bar' },
      data: { brokenLinks: ['https://example.com'] },
      updatedBy: 'system',
    };

    const opportunity = await Opportunity.create(data);

    expect(opportunity).to.be.an('object');

    expect(isValidUUID(opportunity.getId())).to.be.true;
    expect(isIsoDate(opportunity.getCreatedAt())).to.be.true;
    expect(isIsoDate(opportunity.getUpdatedAt())).to.be.true;

    const record = opportunity.toJSON();
    delete record.opportunityId;
    delete record.createdAt;
    delete record.updatedAt;
    expect(record).to.eql(data);

    expect(opportunity.getAuditId()).to.be.undefined;
    await expect(opportunity.getAudit()).to.eventually.be.equal(null);
  });

  it('removes an opportunity', async () => {
    const opportunity = await Opportunity.findById(sampleData.opportunities[0].getId());
    const suggestions = await opportunity.getSuggestions();

    expect(suggestions).to.be.an('array').with.length(3);

    await opportunity.remove();

    const notFound = await Opportunity.findById(sampleData.opportunities[0].getId());
    await expect(notFound).to.be.null;

    // make sure dependent suggestions are removed as well
    await Promise.all(suggestions.map(async (suggestion) => {
      const notFoundSuggestion = await Suggestion.findById(suggestion.getId());
      await expect(notFoundSuggestion).to.be.null;
    }));
  });

  it('throws when removing a dependent fails', async () => { /* eslint-disable no-underscore-dangle */
    const opportunity = await Opportunity.findById(sampleData.opportunities[1].getId());
    const suggestions = await opportunity.getSuggestions();

    expect(suggestions).to.be.an('array').with.length(3);

    // make one suggestion fail to remove
    suggestions[0]._remove = sinon.stub().rejects(new Error('Failed to remove suggestion'));

    opportunity.getSuggestions = sinon.stub().resolves(suggestions);

    await expect(opportunity.remove()).to.be.rejectedWith(`Failed to remove entity opportunity with ID ${opportunity.getId()}`);
    expect(suggestions[0]._remove).to.have.been.calledOnce;
    expect(mockLogger.error).to.have.been.calledWith(`Failed to remove dependent entity suggestion with ID ${suggestions[0].getId()}`);

    // make sure the opportunity is still there
    const stillThere = await Opportunity.findById(sampleData.opportunities[1].getId());
    expect(stillThere).to.be.an('object');

    // make sure the other suggestions are removed
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });
    const remainingSuggestions = await Suggestion.allByOpportunityId(opportunity.getId());
    expect(remainingSuggestions).to.be.an('array').with.length(1);
    expect(remainingSuggestions[0].getId()).to.equal(suggestions[0].getId());
  });

  it('creates many opportunities', async () => {
    const data = [
      {
        siteId,
        auditId: crypto.randomUUID(),
        title: 'New Opportunity 1',
        description: 'Description',
        runbook: 'https://example.com',
        type: 'broken-backlinks',
        origin: 'AI',
        status: 'NEW',
        data: { brokenLinks: ['https://example.com'] },
        updatedBy: 'system',
      },
      {
        siteId,
        auditId: crypto.randomUUID(),
        title: 'New Opportunity 2',
        description: 'Description',
        runbook: 'https://example.com',
        type: 'broken-internal-links',
        origin: 'AI',
        status: 'NEW',
        data: { brokenInternalLinks: ['https://example.com'] },
        updatedBy: 'system',
      },
    ];

    const opportunities = await Opportunity.createMany(data);

    expect(opportunities).to.be.an('object');
    expect(opportunities.createdItems).to.be.an('array').with.length(2);
    expect(opportunities.errorItems).to.be.an('array').with.length(0);

    opportunities.createdItems.forEach((opportunity, index) => {
      expect(opportunity).to.be.an('object');

      expect(isValidUUID(opportunity.getId())).to.be.true;
      expect(isIsoDate(opportunity.getCreatedAt())).to.be.true;
      expect(isIsoDate(opportunity.getUpdatedAt())).to.be.true;

      expect(
        sanitizeIdAndAuditFields('Opportunity', opportunity.toJSON()),
      ).to.eql(
        sanitizeTimestamps(data[index]),
      );
    });
  });

  it('fails to create many opportunities with invalid data', async () => {
    const data = [
      {
        siteId,
        auditId: crypto.randomUUID(),
        title: 'New Opportunity 1',
        description: 'Description',
        runbook: 'https://example.com',
        type: 'broken-backlinks',
        origin: 'AI',
        status: 'NEW',
        data: { brokenLinks: ['https://example.com'] },
        updatedBy: 'system',
      },
      {
        siteId,
        auditId: crypto.randomUUID(),
        title: 'New Opportunity 2',
        description: 'Description',
        runbook: 'https://example.com',
        type: 'broken-internal-links',
        origin: 'AI',
        status: 'NEW',
        data: { brokenInternalLinks: ['https://example.com'] },
        updatedBy: 'system',
      },
      {
        siteId,
        auditId: crypto.randomUUID(),
        title: 'New Opportunity 3',
        description: 'Description',
        runbook: 'https://example.com',
        type: 'broken-internal-links',
        origin: 'AI',
        status: 'NEW',
        data: { brokenInternalLinks: ['https://example.com'] },
        updatedBy: 'system',
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

  describe('addFixEntities', () => {
    it('creates fix entities with valid suggestions', async () => {
      const opportunity = await Opportunity.findById(sampleData.opportunities[2].getId());
      const suggestions = await opportunity.getSuggestions();

      expect(suggestions).to.be.an('array').with.length(3);

      const fixEntityData = [
        {
          type: 'CODE_CHANGE',
          changeDetails: {
            file: 'test1.js',
            changes: 'some changes',
          },
          suggestions: [suggestions[0].getId(), suggestions[1].getId()],
        },
        {
          type: 'CONTENT_UPDATE',
          changeDetails: {
            file: 'test2.md',
            changes: 'content changes',
          },
          suggestions: [suggestions[2].getId()],
        },
      ];

      const result = await opportunity.addFixEntities(fixEntityData);

      expect(result).to.be.an('object');
      expect(result.createdItems).to.be.an('array').with.length(2);
      expect(result.errorItems).to.be.an('array').with.length(0);

      // Verify fix entities were created
      const fixEntity1 = result.createdItems[0];
      const fixEntity2 = result.createdItems[1];

      expect(isValidUUID(fixEntity1.getId())).to.be.true;
      expect(isValidUUID(fixEntity2.getId())).to.be.true;
      expect(fixEntity1.getType()).to.equal('CODE_CHANGE');
      expect(fixEntity2.getType()).to.equal('CONTENT_UPDATE');
      expect(fixEntity1.getStatus()).to.equal('PENDING');
      expect(fixEntity2.getStatus()).to.equal('PENDING');

      // Verify junction records were created
      const junctionRecords1 = await FixEntitySuggestion.allByFixEntityId(fixEntity1.getId());
      const junctionRecords2 = await FixEntitySuggestion.allByFixEntityId(fixEntity2.getId());

      expect(junctionRecords1).to.be.an('array').with.length(2);
      expect(junctionRecords2).to.be.an('array').with.length(1);

      // Verify the fix entities can be retrieved through their suggestions
      const suggestionsForFixEntity1 = await FixEntity.getSuggestionsByFixEntityId(
        fixEntity1.getId(),
      );
      expect(suggestionsForFixEntity1).to.be.an('array').with.length(2);
      expect(suggestionsForFixEntity1.map((s) => s.getId())).to.have.members([
        suggestions[0].getId(),
        suggestions[1].getId(),
      ]);
    });

    it('handles invalid fixEntities without suggestions property', async () => {
      const opportunity = await Opportunity.findById(sampleData.opportunities[2].getId());

      const fixEntityData = [
        {
          type: 'CODE_CHANGE',
          changeDetails: {
            file: 'test.js',
          },
          // Missing suggestions property
        },
      ];

      const result = await opportunity.addFixEntities(fixEntityData);

      expect(result).to.be.an('object');
      expect(result.createdItems).to.be.an('array').with.length(0);
      expect(result.errorItems).to.be.an('array').with.length(1);
      expect(result.errorItems[0].error.message).to.equal('fixEntity must have a suggestions property');
    });

    it('handles fixEntities with empty suggestions array', async () => {
      const opportunity = await Opportunity.findById(sampleData.opportunities[2].getId());

      const fixEntityData = [
        {
          type: 'CODE_CHANGE',
          changeDetails: {
            file: 'test.js',
          },
          suggestions: [],
        },
      ];

      const result = await opportunity.addFixEntities(fixEntityData);

      expect(result).to.be.an('object');
      expect(result.createdItems).to.be.an('array').with.length(0);
      expect(result.errorItems).to.be.an('array').with.length(1);
      expect(result.errorItems[0].error.message).to.equal('fixEntity.suggestions cannot be empty');
    });

    it('handles fixEntities with invalid suggestion IDs', async () => {
      const opportunity = await Opportunity.findById(sampleData.opportunities[2].getId());

      const fixEntityData = [
        {
          type: 'CODE_CHANGE',
          changeDetails: {
            file: 'test.js',
          },
          suggestions: ['invalid-suggestion-id', 'another-invalid-id'],
        },
      ];

      const result = await opportunity.addFixEntities(fixEntityData);

      expect(result).to.be.an('object');
      expect(result.createdItems).to.be.an('array').with.length(0);
      expect(result.errorItems).to.be.an('array').with.length(1);
      expect(result.errorItems[0].error.message).to.include('Invalid suggestion IDs');
    });

    it('processes mixed valid and invalid fixEntities', async () => {
      const opportunity = await Opportunity.findById(sampleData.opportunities[2].getId());
      const suggestions = await opportunity.getSuggestions();

      const fixEntityData = [
        {
          type: 'CODE_CHANGE',
          changeDetails: {
            file: 'valid.js',
          },
          suggestions: [suggestions[0].getId()],
        },
        {
          type: 'CONTENT_UPDATE',
          changeDetails: {
            file: 'no-suggestions.md',
          },
          // Missing suggestions
        },
        {
          type: 'REDIRECT_UPDATE',
          changeDetails: {
            from: '/old',
            to: '/new',
          },
          suggestions: [], // Empty array
        },
        {
          type: 'METADATA_UPDATE',
          changeDetails: {
            title: 'Updated Title',
          },
          suggestions: ['invalid-id'], // Invalid suggestion ID
        },
        {
          type: 'AI_INSIGHTS',
          changeDetails: {
            insights: 'Some insights',
          },
          suggestions: [suggestions[1].getId(), suggestions[2].getId()],
        },
      ];

      const result = await opportunity.addFixEntities(fixEntityData);

      expect(result).to.be.an('object');
      expect(result.createdItems).to.be.an('array').with.length(2);
      expect(result.errorItems).to.be.an('array').with.length(3);

      // Verify the valid ones were created
      expect(result.createdItems[0].getType()).to.equal('CODE_CHANGE');
      expect(result.createdItems[1].getType()).to.equal('AI_INSIGHTS');

      // Verify error messages
      expect(result.errorItems[0].error.message).to.equal('fixEntity must have a suggestions property');
      expect(result.errorItems[1].error.message).to.equal('fixEntity.suggestions cannot be empty');
      expect(result.errorItems[2].error.message).to.include('Invalid suggestion IDs');
    });

    it('handles fixEntity creation errors from validation', async () => {
      const opportunity = await Opportunity.findById(sampleData.opportunities[2].getId());
      const suggestions = await opportunity.getSuggestions();

      const fixEntityData = [
        {
          type: 'INVALID_TYPE', // Invalid type
          changeDetails: {
            file: 'test.js',
          },
          suggestions: [suggestions[0].getId()],
        },
      ];

      const result = await opportunity.addFixEntities(fixEntityData);

      expect(result).to.be.an('object');
      expect(result.createdItems).to.be.an('array').with.length(0);
      expect(result.errorItems).to.be.an('array').with.length(1);
      expect(result.errorItems[0].error).to.be.an.instanceOf(ValidationError);
    });

    it('creates fix entities across multiple opportunities', async () => {
      const opportunity1 = await Opportunity.findById(sampleData.opportunities[2].getId());
      const opportunity2 = await Opportunity.findById(sampleData.opportunities[1].getId());

      const suggestions1 = await opportunity1.getSuggestions();
      const suggestions2 = await opportunity2.getSuggestions();

      const fixEntityData1 = [
        {
          type: 'CODE_CHANGE',
          changeDetails: { file: 'test1.js' },
          suggestions: [suggestions1[0].getId()],
        },
      ];

      const fixEntityData2 = [
        {
          type: 'CONTENT_UPDATE',
          changeDetails: { file: 'test2.md' },
          suggestions: [suggestions2[0].getId()],
        },
      ];

      const result1 = await opportunity1.addFixEntities(fixEntityData1);
      const result2 = await opportunity2.addFixEntities(fixEntityData2);

      expect(result1.createdItems).to.have.length(1);
      expect(result2.createdItems).to.have.length(1);

      // Verify they belong to different opportunities
      expect(result1.createdItems[0].getOpportunityId()).to.equal(opportunity1.getId());
      expect(result2.createdItems[0].getOpportunityId()).to.equal(opportunity2.getId());
    });
  });
});
