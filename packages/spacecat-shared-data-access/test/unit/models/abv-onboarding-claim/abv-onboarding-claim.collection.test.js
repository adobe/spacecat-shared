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
import { stub, restore } from 'sinon';
import sinonChai from 'sinon-chai';
import { isValidUUID } from '@adobe/spacecat-shared-utils';

import AbvOnboardingClaim from '../../../../src/models/abv-onboarding-claim/abv-onboarding-claim.model.js';
import AbvOnboardingClaimCollection from '../../../../src/models/abv-onboarding-claim/abv-onboarding-claim.collection.js';
import DataAccessError from '../../../../src/errors/data-access.error.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('AbvOnboardingClaimCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let schema;

  const claimRow = {
    id: 'id-1',
    ims_org_id: 'a1b2c3d4e5f6a7b8c9d0e1f2@AdobeOrg',
    base_url: 'https://example.com',
    status: 'IN_PROGRESS',
    fact_id: 'fact-1',
    holder: 'e3b0c442-98fc-4c14-9afb-1c2d3e4f5a6b',
    lease_expires_at: '2026-01-01T00:00:00.000Z',
    artifacts: null,
    reason: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  };

  const mockRecord = {
    abvOnboardingClaimId: 'id-1',
    imsOrgId: 'a1b2c3d4e5f6a7b8c9d0e1f2@AdobeOrg',
    baseURL: 'https://example.com',
    status: 'IN_PROGRESS',
    factId: 'fact-1',
    holder: 'e3b0c442-98fc-4c14-9afb-1c2d3e4f5a6b',
    leaseExpiresAt: '2026-01-01T00:00:00.000Z',
    artifacts: null,
    reason: null,
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      schema,
    } = createElectroMocks(AbvOnboardingClaim, mockRecord));
    mockElectroService.entities = {};
    instance = new AbvOnboardingClaimCollection(
      mockElectroService,
      mockEntityRegistry,
      schema,
      mockLogger,
    );
  });

  afterEach(() => {
    restore();
  });

  describe('constructor', () => {
    it('initializes the AbvOnboardingClaimCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.postgrestService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(instance.tableName).to.equal('abv_onboarding_claims');
    });

    it('names the base URL attribute baseURL, mapped to base_url', () => {
      expect(schema.getAttribute('baseUrl')).to.be.undefined;
      expect(schema.getAttribute('baseURL')).to.include({ postgrestField: 'base_url' });
    });
  });

  describe('acquire', () => {
    it('mints a holder, invokes wrpc_acquire_abv_claim, and maps { acquired, claim }', async () => {
      const rpc = stub().resolves({ data: [{ ...claimRow, acquired: true }], error: null });
      instance.postgrestService = { rpc };

      const result = await instance.acquire({
        imsOrgId: claimRow.ims_org_id,
        baseURL: claimRow.base_url,
        factId: 'fact-1',
        leaseMs: 60000,
      });

      expect(rpc).to.have.been.calledOnce;
      const [fnName, params] = rpc.firstCall.args;
      expect(fnName).to.equal('wrpc_acquire_abv_claim');
      expect(params.p_ims_org_id).to.equal(claimRow.ims_org_id);
      expect(params.p_base_url).to.equal(claimRow.base_url);
      expect(params.p_fact_id).to.equal('fact-1');
      expect(params.p_lease_ms).to.equal(60000);
      // The model mints the holder token internally.
      expect(isValidUUID(params.p_holder)).to.be.true;

      expect(result.acquired).to.be.true;
      expect(result.claim).to.deep.equal({
        id: 'id-1',
        imsOrgId: claimRow.ims_org_id,
        baseURL: claimRow.base_url,
        status: 'IN_PROGRESS',
        factId: 'fact-1',
        holder: claimRow.holder,
        leaseExpiresAt: claimRow.lease_expires_at,
        artifacts: null,
        reason: null,
        createdAt: claimRow.created_at,
        updatedAt: claimRow.updated_at,
      });
      expect(result.claim).to.not.have.property('acquired');
    });

    it('returns acquired=false with the blocking claim (COMPLETED)', async () => {
      const rpc = stub().resolves({
        data: [{
          ...claimRow,
          status: 'COMPLETED',
          artifacts: { siteId: 's1', entitlementId: 'e1' },
          acquired: false,
        }],
        error: null,
      });
      instance.postgrestService = { rpc };

      const result = await instance.acquire({
        imsOrgId: claimRow.ims_org_id,
        baseURL: claimRow.base_url,
        factId: 'fact-1',
        leaseMs: 60000,
      });

      expect(result.acquired).to.be.false;
      expect(result.claim.status).to.equal('COMPLETED');
      expect(result.claim.artifacts).to.deep.equal({ siteId: 's1', entitlementId: 'e1' });
    });

    it('never exposes a holder token on a blocked acquire', async () => {
      const rpc = stub().resolves({
        data: [{ ...claimRow, holder: 'live-holder-token', acquired: false }],
        error: null,
      });
      instance.postgrestService = { rpc };

      const result = await instance.acquire({
        imsOrgId: claimRow.ims_org_id,
        baseURL: claimRow.base_url,
        leaseMs: 60000,
      });

      expect(result.acquired).to.be.false;
      expect(result.claim.holder).to.be.null;
    });

    it('sends p_fact_id = null when factId is omitted', async () => {
      const rpc = stub().resolves({ data: [{ ...claimRow, acquired: true }], error: null });
      instance.postgrestService = { rpc };

      await instance.acquire({
        imsOrgId: claimRow.ims_org_id,
        baseURL: claimRow.base_url,
        leaseMs: 60000,
      });

      expect(rpc.firstCall.args[1].p_fact_id).to.be.null;
    });

    it('throws DataAccessError when the RPC returns an error', async () => {
      const rpc = stub().resolves({ data: null, error: { message: 'db error' } });
      instance.postgrestService = { rpc };

      await expect(instance.acquire({ imsOrgId: 'o@AdobeOrg', baseURL: 'https://u.com', leaseMs: 1 }))
        .to.be.rejectedWith(DataAccessError, 'Failed to acquire ABV onboarding claim');
    });

    it('throws DataAccessError when the RPC returns no row', async () => {
      const rpc = stub().resolves({ data: [], error: null });
      instance.postgrestService = { rpc };

      await expect(instance.acquire({ imsOrgId: 'o@AdobeOrg', baseURL: 'https://u.com', leaseMs: 1 }))
        .to.be.rejectedWith(DataAccessError);
    });

    it('validates imsOrgId, baseURL and leaseMs before calling the RPC', async () => {
      const rpc = stub();
      instance.postgrestService = { rpc };

      await expect(instance.acquire({ baseURL: 'https://u.com', leaseMs: 1 }))
        .to.be.rejectedWith(DataAccessError);
      await expect(instance.acquire({ imsOrgId: 'o@AdobeOrg', leaseMs: 1 }))
        .to.be.rejectedWith(DataAccessError);
      await expect(instance.acquire({ imsOrgId: 'o@AdobeOrg', baseURL: 'https://u.com' }))
        .to.be.rejectedWith(DataAccessError);
      await expect(instance.acquire({ imsOrgId: 'o@AdobeOrg', baseURL: 'https://u.com', leaseMs: 0 }))
        .to.be.rejectedWith(DataAccessError);
      expect(rpc).to.not.have.been.called;
    });
  });

  describe('finalize', () => {
    const claim = {
      id: 'id-1',
      imsOrgId: 'a1b2c3d4e5f6a7b8c9d0e1f2@AdobeOrg',
      baseURL: 'https://example.com',
      holder: 'e3b0c442-98fc-4c14-9afb-1c2d3e4f5a6b',
      status: 'IN_PROGRESS',
    };

    it('invokes wrpc_finalize_abv_claim with holder-scoped COMPLETED args', async () => {
      const rpc = stub().resolves({ data: [{}], error: null });
      instance.postgrestService = { rpc };

      await instance.finalize(claim, {
        status: 'COMPLETED',
        artifacts: { siteId: 's1', entitlementId: 'e1' },
      });

      expect(rpc).to.have.been.calledOnceWith('wrpc_finalize_abv_claim', {
        p_ims_org_id: claim.imsOrgId,
        p_base_url: claim.baseURL,
        p_holder: claim.holder,
        p_status: 'COMPLETED',
        p_artifacts: { siteId: 's1', entitlementId: 'e1' },
        p_reason: null,
      });
    });

    it('passes reason and null artifacts for a terminal FAILED', async () => {
      const rpc = stub().resolves({ data: [{}], error: null });
      instance.postgrestService = { rpc };

      await instance.finalize(claim, { status: 'FAILED', reason: 'boom' });

      const params = rpc.firstCall.args[1];
      expect(params.p_status).to.equal('FAILED');
      expect(params.p_artifacts).to.be.null;
      expect(params.p_reason).to.equal('boom');
    });

    it('throws DataAccessError when the RPC returns an error', async () => {
      const rpc = stub().resolves({ data: null, error: { message: 'db error' } });
      instance.postgrestService = { rpc };

      await expect(instance.finalize(claim, { status: 'FAILED' }))
        .to.be.rejectedWith(DataAccessError, 'Failed to finalize ABV onboarding claim');
    });

    it('validates the claim (imsOrgId, baseURL, holder) before calling the RPC', async () => {
      const rpc = stub();
      instance.postgrestService = { rpc };

      await expect(instance.finalize({ imsOrgId: 'o@AdobeOrg', baseURL: 'https://u.com' }, { status: 'FAILED' }))
        .to.be.rejectedWith(DataAccessError);
      await expect(instance.finalize(null, { status: 'FAILED' }))
        .to.be.rejectedWith(DataAccessError);
      expect(rpc).to.not.have.been.called;
    });

    [undefined, 'IN_PROGRESS', 'DONE'].forEach((status) => {
      it(`rejects non-terminal status ${status} before calling the RPC`, async () => {
        const rpc = stub();
        instance.postgrestService = { rpc };

        await expect(instance.finalize(claim, { status }))
          .to.be.rejectedWith(DataAccessError, 'finalize: status must be one of COMPLETED, FAILED, CONFLICT');
        expect(rpc).to.not.have.been.called;
      });
    });
  });

  describe('invalidate', () => {
    it('invokes wrpc_invalidate_abv_claim', async () => {
      const rpc = stub().resolves({ data: null, error: null });
      instance.postgrestService = { rpc };

      await instance.invalidate({ imsOrgId: 'a1b2c3d4e5f6a7b8c9d0e1f2@AdobeOrg', baseURL: 'https://example.com' });

      expect(rpc).to.have.been.calledOnceWith('wrpc_invalidate_abv_claim', {
        p_ims_org_id: 'a1b2c3d4e5f6a7b8c9d0e1f2@AdobeOrg',
        p_base_url: 'https://example.com',
      });
    });

    it('throws DataAccessError when the RPC returns an error', async () => {
      const rpc = stub().resolves({ data: null, error: { message: 'db error' } });
      instance.postgrestService = { rpc };

      await expect(instance.invalidate({ imsOrgId: 'o@AdobeOrg', baseURL: 'https://u.com' }))
        .to.be.rejectedWith(DataAccessError, 'Failed to invalidate ABV onboarding claim');
    });

    it('validates imsOrgId and baseURL before calling the RPC', async () => {
      const rpc = stub();
      instance.postgrestService = { rpc };

      await expect(instance.invalidate({ baseURL: 'https://u.com' })).to.be.rejectedWith(DataAccessError);
      await expect(instance.invalidate({ imsOrgId: 'o@AdobeOrg' })).to.be.rejectedWith(DataAccessError);
      expect(rpc).to.not.have.been.called;
    });
  });
});
