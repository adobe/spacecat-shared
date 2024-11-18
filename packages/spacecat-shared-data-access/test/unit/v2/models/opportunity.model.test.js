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

import { expect, use as chaiUse } from 'chai';
import { spy, stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import Opportunity from '../../../../src/v2/models/opportunity.model.js';

chaiUse(chaiAsPromised);

const mockElectroService = {
  entities: {
    opportunity: {
      model: {
        name: 'opportunity',
        schema: {
          attributes: {
            status: {
              enumArray: ['NEW', 'IN_PROGRESS', 'CLOSED'],
            },
          },
        },
        indexes: {
          primary: { // operates on the main table, no 'index' property
            pk: {
              field: 'pk',
              composite: ['opportunityId'],
            },
          },
        },
      },
      patch: stub().returns({
        set: stub(),
      }),
    },
  },
};

describe('Opportunity', () => {
  let opportunityInstance;
  let mockModelFactory;
  let mockLogger;

  const mockRecord = {
    opportunityId: 'op12345',
    siteId: 'site67890',
    auditId: 'audit001',
    title: 'Test Opportunity',
    description: 'This is a test opportunity.',
    runbook: 'http://runbook.url',
    guidance: 'Follow these steps.',
    type: 'SEO',
    status: 'NEW',
    origin: 'ESS_OPS',
    tags: ['tag1', 'tag2'],
    data: {
      additionalInfo: 'info',
    },
  };

  beforeEach(() => {
    mockModelFactory = {
      getCollection: stub(),
    };

    mockLogger = {
      error: spy(),
    };

    opportunityInstance = new Opportunity(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the Opportunity instance correctly', () => {
      expect(opportunityInstance).to.be.an('object');
      expect(opportunityInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('getSuggestions', () => {
    it('returns related suggestions', async () => {
      const mockSuggestionResults = [{ id: 'suggestion-1' }, { id: 'suggestion-2' }];
      const mockSuggestionCollection = {
        allByOpportunityId: stub().returns(Promise.resolve(mockSuggestionResults)),
      };
      mockModelFactory.getCollection.withArgs('SuggestionCollection').returns(mockSuggestionCollection);

      const suggestions = await opportunityInstance.getSuggestions();
      expect(suggestions).to.deep.equal(mockSuggestionResults);
      expect(mockModelFactory.getCollection.calledOnceWith('SuggestionCollection')).to.be.true;
    });
  });

  describe('getSiteId and setSiteId', () => {
    it('returns the site ID of the opportunity', () => {
      expect(opportunityInstance.getSiteId()).to.equal('site67890');
    });

    it('sets the site ID of the opportunity', () => {
      opportunityInstance.setSiteId('newSite123');
      expect(opportunityInstance.record.siteId).to.equal('newSite123');
    });
  });

  describe('getAuditId and setAuditId', () => {
    it('returns the audit ID of the opportunity', () => {
      expect(opportunityInstance.getAuditId()).to.equal('audit001');
    });

    it('sets the audit ID of the opportunity', () => {
      opportunityInstance.setAuditId('ef39921f-9a02-41db-b491-02c98987d956');
      expect(opportunityInstance.record.auditId).to.equal('ef39921f-9a02-41db-b491-02c98987d956');
    });
  });

  describe('getRunbook and setRunbook', () => {
    it('returns the runbook reference', () => {
      expect(opportunityInstance.getRunbook()).to.equal('http://runbook.url');
    });

    it('sets the runbook reference', () => {
      opportunityInstance.setRunbook('http://new.runbook.url');
      expect(opportunityInstance.record.runbook).to.equal('http://new.runbook.url');
    });
  });

  describe('getGuidance and setGuidance', () => {
    it('returns the guidance information', () => {
      expect(opportunityInstance.getGuidance()).to.equal('Follow these steps.');
    });

    it('sets the guidance information', () => {
      opportunityInstance.setGuidance({ text: 'New guidance text' });
      expect(opportunityInstance.record.guidance).to.eql({ text: 'New guidance text' });
    });
  });

  describe('getTitle and setTitle', () => {
    it('returns the title of the opportunity', () => {
      expect(opportunityInstance.getTitle()).to.equal('Test Opportunity');
    });

    it('sets the title of the opportunity', () => {
      opportunityInstance.setTitle('New Opportunity Title');
      expect(opportunityInstance.record.title).to.equal('New Opportunity Title');
    });
  });

  describe('getDescription and setDescription', () => {
    it('returns the description of the opportunity', () => {
      expect(opportunityInstance.getDescription()).to.equal('This is a test opportunity.');
    });

    it('sets the description of the opportunity', () => {
      opportunityInstance.setDescription('Updated description.');
      expect(opportunityInstance.record.description).to.equal('Updated description.');
    });
  });

  describe('getType', () => {
    it('returns the type of the opportunity', () => {
      expect(opportunityInstance.getType()).to.equal('SEO');
    });
  });

  describe('getStatus and setStatus', () => {
    it('returns the status of the opportunity', () => {
      expect(opportunityInstance.getStatus()).to.equal('NEW');
    });

    it('sets the status of the opportunity', () => {
      opportunityInstance.setStatus('IN_PROGRESS');
      expect(opportunityInstance.record.status).to.equal('IN_PROGRESS');
    });
  });

  describe('getOrigin and setOrigin', () => {
    it('returns the origin of the opportunity', () => {
      expect(opportunityInstance.getOrigin()).to.equal('ESS_OPS');
    });

    it('sets the origin of the opportunity', () => {
      opportunityInstance.setOrigin('AI');
      expect(opportunityInstance.record.origin).to.equal('AI');
    });
  });

  describe('getTags and setTags', () => {
    it('returns the tags of the opportunity', () => {
      expect(opportunityInstance.getTags()).to.deep.equal(['tag1', 'tag2']);
    });

    it('sets the tags of the opportunity', () => {
      opportunityInstance.setTags(['newTag1', 'newTag2']);
      expect(opportunityInstance.record.tags).to.deep.equal(['newTag1', 'newTag2']);
    });
  });

  describe('getData and setData', () => {
    it('returns additional data for the opportunity', () => {
      expect(opportunityInstance.getData()).to.deep.equal({ additionalInfo: 'info' });
    });

    it('sets additional data for the opportunity', () => {
      opportunityInstance.setData({ newInfo: 'updatedInfo' });
      expect(opportunityInstance.record.data).to.deep.equal({ newInfo: 'updatedInfo' });
    });
  });
});
