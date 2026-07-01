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
import OAuthNonce from '../../../../src/models/oauth-nonce/oauth-nonce.model.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const MOCK_RECORD = {
  oAuthNonceId: '11111111-1111-1111-1111-111111111111',
  nonce: 'abc123',
  expiresAt: '2025-01-01T00:00:10.000Z',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  updatedBy: 'system',
};

describe('OAuthNonceCollection', () => {
  let instance;

  beforeEach(() => {
    ({ collection: instance } = createElectroMocks(OAuthNonce, MOCK_RECORD));
  });

  describe('delete()', () => {
    function setupDeleteChain(result) {
      const selectStub = sinon.stub().resolves(result);
      const eqStub = sinon.stub().returns({ select: selectStub });
      const deleteStub = sinon.stub().returns({ eq: eqStub });
      instance.postgrestService.from = sinon.stub().returns({ delete: deleteStub });
      return { deleteStub, eqStub, selectStub };
    }

    it('returns 1 when nonce is found and deleted', async () => {
      setupDeleteChain({ data: [MOCK_RECORD], error: null });

      const result = await instance.delete({ nonce: 'abc123' });

      expect(result).to.equal(1);
    });

    it('returns 0 when nonce is not found', async () => {
      setupDeleteChain({ data: [], error: null });

      const result = await instance.delete({ nonce: 'unknown' });

      expect(result).to.equal(0);
    });

    it('returns 0 when data is null', async () => {
      setupDeleteChain({ data: null, error: null });

      const result = await instance.delete({ nonce: 'abc123' });

      expect(result).to.equal(0);
    });

    it('throws when PostgREST returns an error', async () => {
      setupDeleteChain({ data: null, error: new Error('DB error') });

      await expect(instance.delete({ nonce: 'abc123' })).to.be.rejectedWith('DB error');
    });

    it('throws when nonce is missing', async () => {
      await expect(instance.delete({})).to.be.rejectedWith('nonce is required and must be a non-empty string');
    });
  });
});
