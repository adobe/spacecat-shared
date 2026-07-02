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
import IdempotencyKey from '../../../../src/models/idempotency-key/idempotency-key.model.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

const VALID_ORG_ID = '22222222-2222-2222-2222-222222222222';

const MOCK_RECORD = {
  idempotencyKeyId: '11111111-1111-1111-1111-111111111111',
  key: 'test-idempotency-key',
  organizationId: VALID_ORG_ID,
  endpoint: 'POST /task-management/jira_cloud/tickets',
  status: 'processing',
  response: null,
  expiresAt: '2026-01-02T00:00:00.000Z',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'system',
};

describe('IdempotencyKeyCollection', () => {
  let instance;

  beforeEach(() => {
    ({ collection: instance } = createElectroMocks(IdempotencyKey, MOCK_RECORD));
  });

  describe('findActiveKey()', () => {
    function setupSelectChain(result) {
      const limitStub = sinon.stub().resolves(result);
      const gtStub = sinon.stub().returns({ limit: limitStub });
      const eqOrgStub = sinon.stub().returns({ gt: gtStub });
      const eqKeyStub = sinon.stub().returns({ eq: eqOrgStub });
      const selectStub = sinon.stub().returns({ eq: eqKeyStub });
      instance.postgrestService.from = sinon.stub().returns({ select: selectStub });
      return {
        selectStub, eqKeyStub, eqOrgStub, gtStub, limitStub,
      };
    }

    it('returns instance when active key found', async () => {
      const dbRow = {
        id: MOCK_RECORD.idempotencyKeyId,
        key: MOCK_RECORD.key,
        organization_id: MOCK_RECORD.organizationId,
        endpoint: MOCK_RECORD.endpoint,
        status: MOCK_RECORD.status,
        response: null,
        expires_at: MOCK_RECORD.expiresAt,
        created_at: MOCK_RECORD.createdAt,
        updated_at: MOCK_RECORD.updatedAt,
      };
      setupSelectChain({ data: [dbRow], error: null });

      const result = await instance.findActiveKey('test-key', VALID_ORG_ID);

      expect(result).to.not.be.null;
    });

    it('returns null when no key found', async () => {
      setupSelectChain({ data: [], error: null });

      const result = await instance.findActiveKey('unknown-key', VALID_ORG_ID);

      expect(result).to.be.null;
    });

    it('returns null when data is null', async () => {
      setupSelectChain({ data: null, error: null });

      const result = await instance.findActiveKey('test-key', VALID_ORG_ID);

      expect(result).to.be.null;
    });

    it('filters by expires_at > now', async () => {
      const { gtStub } = setupSelectChain({ data: [], error: null });

      await instance.findActiveKey('test-key', VALID_ORG_ID);

      expect(gtStub).to.have.been.calledOnce;
      expect(gtStub.firstCall.args[0]).to.equal('expires_at');
      const filterTimestamp = new Date(gtStub.firstCall.args[1]);
      expect(Date.now() - filterTimestamp.getTime()).to.be.lessThan(5000);
    });

    it('throws DataAccessError when PostgREST returns an error', async () => {
      setupSelectChain({ data: null, error: { code: 'PGRST205', message: 'DB error' } });

      await expect(instance.findActiveKey('test-key', VALID_ORG_ID))
        .to.be.rejectedWith('Failed to find active idempotency key');
    });

    it('throws ValidationError when key is missing', async () => {
      await expect(instance.findActiveKey('', VALID_ORG_ID))
        .to.be.rejectedWith('key is required');
    });

    it('throws ValidationError when organizationId is not a valid UUID', async () => {
      await expect(instance.findActiveKey('test-key', 'not-a-uuid'))
        .to.be.rejectedWith('organizationId must be a valid UUID');
    });
  });

  describe('deleteExpired()', () => {
    function setupDeleteChain(result) {
      const selectStub = sinon.stub().resolves(result);
      const ltStub = sinon.stub().returns({ select: selectStub });
      const deleteStub = sinon.stub().returns({ lt: ltStub });
      instance.postgrestService.from = sinon.stub().returns({ delete: deleteStub });
      return { deleteStub, ltStub, selectStub };
    }

    it('returns number of deleted rows', async () => {
      setupDeleteChain({ data: [{ id: '1' }, { id: '2' }], error: null });

      const result = await instance.deleteExpired();

      expect(result).to.equal(2);
    });

    it('returns 0 when no expired rows', async () => {
      setupDeleteChain({ data: [], error: null });

      const result = await instance.deleteExpired();

      expect(result).to.equal(0);
    });

    it('returns 0 when data is null', async () => {
      setupDeleteChain({ data: null, error: null });

      const result = await instance.deleteExpired();

      expect(result).to.equal(0);
    });

    it('filters by expires_at < now', async () => {
      const { ltStub } = setupDeleteChain({ data: [], error: null });

      await instance.deleteExpired();

      expect(ltStub).to.have.been.calledOnce;
      expect(ltStub.firstCall.args[0]).to.equal('expires_at');
      const filterTimestamp = new Date(ltStub.firstCall.args[1]);
      expect(Date.now() - filterTimestamp.getTime()).to.be.lessThan(5000);
    });

    it('throws DataAccessError when PostgREST returns an error', async () => {
      setupDeleteChain({ data: null, error: { code: 'PGRST205', message: 'DB error' } });

      await expect(instance.deleteExpired())
        .to.be.rejectedWith('Failed to delete expired idempotency keys');
    });
  });
});
