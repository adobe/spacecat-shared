/*
 * Copyright 2026 Adobe. All rights reserved.
 * This file is licensed to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain a copy
 * of the License at http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under
 * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { expect, use as chaiUse } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import sinon from 'sinon';

import { createElectroMocks } from '../../util.js';
import TicketSuggestion from '../../../../src/models/ticket-suggestion/ticket-suggestion.model.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const TICKET_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const SUGGESTION_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const MOCK_RECORD = {
  ticketSuggestionId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  ticketId: TICKET_ID,
  suggestionId: SUGGESTION_ID,
  opportunityId: 'dddddddd-dddd-dddd-dddd-dddddddddddd',
  createdBy: 'user-1',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const DB_ROW = {
  id: MOCK_RECORD.ticketSuggestionId,
  ticket_id: MOCK_RECORD.ticketId,
  suggestion_id: MOCK_RECORD.suggestionId,
  opportunity_id: MOCK_RECORD.opportunityId,
  created_by: MOCK_RECORD.createdBy,
  created_at: MOCK_RECORD.createdAt,
};

describe('TicketSuggestionCollection', () => {
  let instance;

  beforeEach(() => {
    ({ collection: instance } = createElectroMocks(TicketSuggestion, MOCK_RECORD));
  });

  describe('allBySuggestionIds()', () => {
    function setupInChain(result) {
      const inStub = sinon.stub().resolves(result);
      const selectStub = sinon.stub().returns({ in: inStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });
      return { selectStub, inStub };
    }

    it('returns empty array for empty input', async () => {
      const result = await instance.allBySuggestionIds([]);
      expect(result).to.deep.equal([]);
    });

    it('returns empty array for non-array input', async () => {
      const result = await instance.allBySuggestionIds(null);
      expect(result).to.deep.equal([]);
    });

    it('returns mapped instances when rows found', async () => {
      setupInChain({ data: [DB_ROW], error: null });

      const result = await instance.allBySuggestionIds([SUGGESTION_ID]);

      expect(result).to.have.length(1);
      expect(result[0].getSuggestionId()).to.equal(SUGGESTION_ID);
    });

    it('returns empty array when data is null', async () => {
      setupInChain({ data: null, error: null });

      const result = await instance.allBySuggestionIds([SUGGESTION_ID]);

      expect(result).to.deep.equal([]);
    });

    it('queries with correct column and values', async () => {
      const { inStub } = setupInChain({ data: [], error: null });

      await instance.allBySuggestionIds([SUGGESTION_ID]);

      expect(inStub).to.have.been.calledWith('suggestion_id', [SUGGESTION_ID]);
    });

    it('throws DataAccessError when PostgREST returns an error', async () => {
      setupInChain({ data: null, error: { code: 'PGRST205', message: 'DB error' } });

      await expect(instance.allBySuggestionIds([SUGGESTION_ID]))
        .to.be.rejectedWith('Failed to load ticket suggestions by suggestion IDs');
    });
  });

  describe('allByTicketIds()', () => {
    function setupInChain(result) {
      const inStub = sinon.stub().resolves(result);
      const selectStub = sinon.stub().returns({ in: inStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });
      return { selectStub, inStub };
    }

    it('returns empty array for empty input', async () => {
      const result = await instance.allByTicketIds([]);
      expect(result).to.deep.equal([]);
    });

    it('returns empty array for non-array input', async () => {
      const result = await instance.allByTicketIds(null);
      expect(result).to.deep.equal([]);
    });

    it('returns mapped instances when rows found', async () => {
      setupInChain({ data: [DB_ROW], error: null });

      const result = await instance.allByTicketIds([TICKET_ID]);

      expect(result).to.have.length(1);
      expect(result[0].getTicketId()).to.equal(TICKET_ID);
    });

    it('returns empty array when data is null', async () => {
      setupInChain({ data: null, error: null });

      const result = await instance.allByTicketIds([TICKET_ID]);

      expect(result).to.deep.equal([]);
    });

    it('queries with correct column and values', async () => {
      const { inStub } = setupInChain({ data: [], error: null });

      await instance.allByTicketIds([TICKET_ID]);

      expect(inStub).to.have.been.calledWith('ticket_id', [TICKET_ID]);
    });

    it('throws DataAccessError when PostgREST returns an error', async () => {
      setupInChain({ data: null, error: { code: 'PGRST205', message: 'DB error' } });

      await expect(instance.allByTicketIds([TICKET_ID]))
        .to.be.rejectedWith('Failed to load ticket suggestions by ticket IDs');
    });
  });
});
