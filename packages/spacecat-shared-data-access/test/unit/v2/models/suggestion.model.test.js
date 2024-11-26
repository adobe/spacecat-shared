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
import { Entity } from 'electrodb';
import { spy, stub } from 'sinon';
import chaiAsPromised from 'chai-as-promised';

import Suggestion from '../../../../src/v2/models/suggestion.model.js';
import SuggestionSchema from '../../../../src/v2/schema/suggestion.schema.js';

chaiUse(chaiAsPromised);

const { attributes } = new Entity(SuggestionSchema).model.schema;

describe('Suggestion', () => {
  let suggestionInstance;
  let mockElectroService;
  let mockModelFactory;
  let mockLogger;

  const mockRecord = {
    suggestionId: 'sug12345',
    opportunityId: 'op67890',
    type: 'CODE_CHANGE',
    status: 'NEW',
    rank: 1,
    data: {
      info: 'sample data',
    },
    kpiDeltas: {
      conversionRate: 0.05,
    },
  };

  beforeEach(() => {
    mockElectroService = {
      entities: {
        suggestion: {
          model: {
            name: 'suggestion',
            schema: { attributes },
            original: {
              references: {},
            },
            indexes: {
              primary: {
                pk: {
                  field: 'pk',
                  composite: ['suggestionId'],
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

    mockModelFactory = {
      getCollection: stub(),
    };

    mockLogger = {
      error: spy(),
    };

    suggestionInstance = new Suggestion(
      mockElectroService,
      mockModelFactory,
      mockRecord,
      mockLogger,
    );
  });

  describe('constructor', () => {
    it('initializes the Suggestion instance correctly', () => {
      expect(suggestionInstance).to.be.an('object');
      expect(suggestionInstance.record).to.deep.equal(mockRecord);
    });
  });

  describe('getOpportunityId and setOpportunityId', () => {
    it('returns the Opportunity ID of the suggestion', () => {
      expect(suggestionInstance.getOpportunityId()).to.equal('op67890');
    });

    it('sets the Opportunity ID of the suggestion', () => {
      suggestionInstance.setOpportunityId('ef39921f-9a02-41db-b491-02c98987d956');
      expect(suggestionInstance.record.opportunityId).to.equal('ef39921f-9a02-41db-b491-02c98987d956');
    });
  });

  describe('getType', () => {
    it('returns the type of the suggestion', () => {
      expect(suggestionInstance.getType()).to.equal('CODE_CHANGE');
    });
  });

  describe('getStatus and setStatus', () => {
    it('returns the status of the suggestion', () => {
      expect(suggestionInstance.getStatus()).to.equal('NEW');
    });

    it('sets the status of the suggestion', () => {
      suggestionInstance.setStatus('APPROVED');
      expect(suggestionInstance.record.status).to.equal('APPROVED');
    });
  });

  describe('getRank and setRank', () => {
    it('returns the rank of the suggestion', () => {
      expect(suggestionInstance.getRank()).to.equal(1);
    });

    it('sets the rank of the suggestion', () => {
      suggestionInstance.setRank(5);
      expect(suggestionInstance.record.rank).to.equal(5);
    });
  });

  describe('getData and setData', () => {
    it('returns additional data for the suggestion', () => {
      expect(suggestionInstance.getData()).to.deep.equal({ info: 'sample data' });
    });

    it('sets additional data for the suggestion', () => {
      suggestionInstance.setData({ newInfo: 'updated data' });
      expect(suggestionInstance.record.data).to.deep.equal({ newInfo: 'updated data' });
    });
  });

  describe('getKpiDeltas and setKpiDeltas', () => {
    it('returns the KPI deltas for the suggestion', () => {
      expect(suggestionInstance.getKpiDeltas()).to.deep.equal({ conversionRate: 0.05 });
    });

    it('sets the KPI deltas for the suggestion', () => {
      suggestionInstance.setKpiDeltas({ conversionRate: 0.1 });
      expect(suggestionInstance.record.kpiDeltas).to.deep.equal({ conversionRate: 0.1 });
    });
  });
});
