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

import { DataAccessError, ValidationError } from '../../../../src/errors/index.js';
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
  const sandbox = sinon.createSandbox();

  beforeEach(() => {
    ({ collection: instance } = createElectroMocks(TicketSuggestion, MOCK_RECORD));
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('allBySuggestionIds()', () => {
    it('throws ValidationError for non-array input', async () => {
      await expect(instance.allBySuggestionIds(null))
        .to.be.rejectedWith(ValidationError);
    });

    it('returns empty array for empty input without querying', async () => {
      instance.all = sandbox.stub();

      const result = await instance.allBySuggestionIds([]);

      expect(result).to.deep.equal([]);
      expect(instance.all).to.not.have.been.called;
    });

    it('delegates to this.all() with correct where clause', async () => {
      const mockResults = [{ getSuggestionId: () => SUGGESTION_ID }];
      instance.all = sandbox.stub().resolves(mockResults);

      const result = await instance.allBySuggestionIds([SUGGESTION_ID]);

      expect(result).to.deep.equal(mockResults);
      expect(instance.all).to.have.been.calledOnce;

      const [sortKeys, options] = instance.all.firstCall.args;
      expect(sortKeys).to.deep.equal({});

      const opStub = { in: sandbox.stub().returns('IN_EXPR') };
      const expression = options.where({ suggestionId: 'suggestionId' }, opStub);
      expect(opStub.in).to.have.been.calledOnceWith('suggestionId', [SUGGESTION_ID]);
      expect(expression).to.equal('IN_EXPR');
    });

    it('deduplicates ids before querying', async () => {
      instance.all = sandbox.stub().resolves([]);

      await instance.allBySuggestionIds([SUGGESTION_ID, SUGGESTION_ID]);

      expect(instance.all).to.have.been.calledOnce;
      const [, options] = instance.all.firstCall.args;
      const opStub = { in: sandbox.stub().returns('IN_EXPR') };
      options.where({ suggestionId: 'suggestionId' }, opStub);
      expect(opStub.in.firstCall.args[1]).to.deep.equal([SUGGESTION_ID]);
    });

    it('chunks large id arrays into batches of 50', async () => {
      const ids = Array.from({ length: 75 }, (_, i) => `id-${i}`);
      instance.all = sandbox.stub().resolves([]);

      await instance.allBySuggestionIds(ids);

      expect(instance.all).to.have.been.calledTwice;
    });

    it('throws DataAccessError when this.all() rejects', async () => {
      instance.all = sandbox.stub().rejects(new Error('DB error'));

      await expect(instance.allBySuggestionIds([SUGGESTION_ID]))
        .to.be.rejectedWith(DataAccessError, 'Failed to load ticket suggestions by suggestion IDs');
    });

    it('re-throws DataAccessError without wrapping', async () => {
      const inner = new DataAccessError('inner failure');
      instance.all = sandbox.stub().rejects(inner);

      try {
        await instance.allBySuggestionIds([SUGGESTION_ID]);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).to.equal(inner);
      }
    });
  });

  describe('allByTicketIds()', () => {
    it('throws ValidationError for non-array input', async () => {
      await expect(instance.allByTicketIds(null))
        .to.be.rejectedWith(ValidationError);
    });

    it('returns empty array for empty input without querying', async () => {
      instance.all = sandbox.stub();

      const result = await instance.allByTicketIds([]);

      expect(result).to.deep.equal([]);
      expect(instance.all).to.not.have.been.called;
    });

    it('delegates to this.all() with correct where clause', async () => {
      const mockResults = [{ getTicketId: () => TICKET_ID }];
      instance.all = sandbox.stub().resolves(mockResults);

      const result = await instance.allByTicketIds([TICKET_ID]);

      expect(result).to.deep.equal(mockResults);
      expect(instance.all).to.have.been.calledOnce;

      const [sortKeys, options] = instance.all.firstCall.args;
      expect(sortKeys).to.deep.equal({});

      const opStub = { in: sandbox.stub().returns('IN_EXPR') };
      const expression = options.where({ ticketId: 'ticketId' }, opStub);
      expect(opStub.in).to.have.been.calledOnceWith('ticketId', [TICKET_ID]);
      expect(expression).to.equal('IN_EXPR');
    });

    it('deduplicates ids before querying', async () => {
      instance.all = sandbox.stub().resolves([]);

      await instance.allByTicketIds([TICKET_ID, TICKET_ID]);

      expect(instance.all).to.have.been.calledOnce;
      const [, options] = instance.all.firstCall.args;
      const opStub = { in: sandbox.stub().returns('IN_EXPR') };
      options.where({ ticketId: 'ticketId' }, opStub);
      expect(opStub.in.firstCall.args[1]).to.deep.equal([TICKET_ID]);
    });

    it('chunks large id arrays into batches of 50', async () => {
      const ids = Array.from({ length: 75 }, (_, i) => `id-${i}`);
      instance.all = sandbox.stub().resolves([]);

      await instance.allByTicketIds(ids);

      expect(instance.all).to.have.been.calledTwice;
    });

    it('throws DataAccessError when this.all() rejects', async () => {
      instance.all = sandbox.stub().rejects(new Error('DB error'));

      await expect(instance.allByTicketIds([TICKET_ID]))
        .to.be.rejectedWith(DataAccessError, 'Failed to load ticket suggestions by ticket IDs');
    });

    it('re-throws DataAccessError without wrapping', async () => {
      const inner = new DataAccessError('inner failure');
      instance.all = sandbox.stub().rejects(inner);

      try {
        await instance.allByTicketIds([TICKET_ID]);
        expect.fail('should have thrown');
      } catch (err) {
        expect(err).to.equal(inner);
      }
    });
  });
});
