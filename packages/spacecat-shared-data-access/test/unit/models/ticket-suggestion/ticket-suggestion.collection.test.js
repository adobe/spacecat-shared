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
import { stub } from 'sinon';

import { DataAccessError } from '../../../../src/errors/index.js';
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

describe('TicketSuggestionCollection', () => {
  let instance;

  beforeEach(() => {
    ({ collection: instance } = createElectroMocks(TicketSuggestion, MOCK_RECORD));
  });

  describe('allBySuggestionIds()', () => {
    it('returns empty array for empty input without querying', async () => {
      instance.all = stub();

      const result = await instance.allBySuggestionIds([]);

      expect(result).to.deep.equal([]);
      expect(instance.all).to.not.have.been.called;
    });

    it('returns empty array for non-array input without querying', async () => {
      instance.all = stub();

      const result = await instance.allBySuggestionIds(null);

      expect(result).to.deep.equal([]);
      expect(instance.all).to.not.have.been.called;
    });

    it('delegates to this.all() with correct where clause', async () => {
      const mockResults = [{ getSuggestionId: () => SUGGESTION_ID }];
      instance.all = stub().resolves(mockResults);

      const result = await instance.allBySuggestionIds([SUGGESTION_ID]);

      expect(result).to.deep.equal(mockResults);
      expect(instance.all).to.have.been.calledOnce;

      const [sortKeys, options] = instance.all.firstCall.args;
      expect(sortKeys).to.deep.equal({});

      const opStub = { in: stub().returns('IN_EXPR') };
      const expression = options.where({ suggestionId: 'suggestionId' }, opStub);
      expect(opStub.in).to.have.been.calledOnceWith('suggestionId', [SUGGESTION_ID]);
      expect(expression).to.equal('IN_EXPR');
    });

    it('throws DataAccessError when this.all() rejects', async () => {
      instance.all = stub().rejects(new Error('DB error'));

      await expect(instance.allBySuggestionIds([SUGGESTION_ID]))
        .to.be.rejectedWith(DataAccessError, 'Failed to load ticket suggestions by suggestion IDs');
    });

    it('re-throws DataAccessError without wrapping', async () => {
      const inner = new DataAccessError('inner failure');
      instance.all = stub().rejects(inner);

      try {
        await instance.allBySuggestionIds([SUGGESTION_ID]);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).to.equal(inner);
      }
    });
  });

  describe('allByTicketIds()', () => {
    it('returns empty array for empty input without querying', async () => {
      instance.all = stub();

      const result = await instance.allByTicketIds([]);

      expect(result).to.deep.equal([]);
      expect(instance.all).to.not.have.been.called;
    });

    it('returns empty array for non-array input without querying', async () => {
      instance.all = stub();

      const result = await instance.allByTicketIds(null);

      expect(result).to.deep.equal([]);
      expect(instance.all).to.not.have.been.called;
    });

    it('delegates to this.all() with correct where clause', async () => {
      const mockResults = [{ getTicketId: () => TICKET_ID }];
      instance.all = stub().resolves(mockResults);

      const result = await instance.allByTicketIds([TICKET_ID]);

      expect(result).to.deep.equal(mockResults);
      expect(instance.all).to.have.been.calledOnce;

      const [sortKeys, options] = instance.all.firstCall.args;
      expect(sortKeys).to.deep.equal({});

      const opStub = { in: stub().returns('IN_EXPR') };
      const expression = options.where({ ticketId: 'ticketId' }, opStub);
      expect(opStub.in).to.have.been.calledOnceWith('ticketId', [TICKET_ID]);
      expect(expression).to.equal('IN_EXPR');
    });

    it('throws DataAccessError when this.all() rejects', async () => {
      instance.all = stub().rejects(new Error('DB error'));

      await expect(instance.allByTicketIds([TICKET_ID]))
        .to.be.rejectedWith(DataAccessError, 'Failed to load ticket suggestions by ticket IDs');
    });

    it('re-throws DataAccessError without wrapping', async () => {
      const inner = new DataAccessError('inner failure');
      instance.all = stub().rejects(inner);

      try {
        await instance.allByTicketIds([TICKET_ID]);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).to.equal(inner);
      }
    });
  });
});
