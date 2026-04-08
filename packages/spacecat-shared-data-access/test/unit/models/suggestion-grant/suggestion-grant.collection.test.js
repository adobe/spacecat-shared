/*
 * Copyright 2025 Adobe. All rights reserved.
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

import SuggestionGrant from '../../../../src/models/suggestion-grant/suggestion-grant.model.js';
import SuggestionGrantCollection from '../../../../src/models/suggestion-grant/suggestion-grant.collection.js';
import DataAccessError from '../../../../src/errors/data-access.error.js';
import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SuggestionGrantCollection', () => {
  let instance;
  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let schema;

  const mockRecord = {
    suggestionGrantId: 'grant-uuid-1',
    suggestionId: 'sugg-uuid-1',
    grantId: 'grant-id-1',
    siteId: 'site-uuid-1',
    tokenId: 'token-uuid-1',
    tokenType: 'grant_cwv',
    grantedAt: '2025-03-01T00:00:00.000Z',
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      schema,
    } = createElectroMocks(SuggestionGrant, mockRecord));
    mockElectroService.entities = {};
    instance = new SuggestionGrantCollection(
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
    it('initializes the SuggestionGrantCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.postgrestService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);
      expect(instance.tableName).to.equal('suggestion_grants');
    });
  });

  describe('findBySuggestionIds', () => {
    it('returns data from postgrest when suggestionIds is non-empty', async () => {
      const suggestionIds = ['sugg-1', 'sugg-2'];
      const grantData = [
        { suggestion_id: 'sugg-1', grant_id: 'g1' },
        { suggestion_id: 'sugg-2', grant_id: 'g2' },
      ];
      const inStub = stub().resolves({ data: grantData, error: null });
      const fromStub = stub().returns({
        select: stub().returns({ in: inStub }),
      });
      instance.postgrestService = { from: fromStub };

      const result = await instance.findBySuggestionIds(suggestionIds);

      expect(result).to.deep.equal(grantData);
      expect(fromStub).to.have.been.calledOnceWith('suggestion_grants');
      expect(inStub).to.have.been.calledOnceWith('suggestion_id', suggestionIds);
    });

    it('returns empty array when suggestionIds is empty array', async () => {
      const result = await instance.findBySuggestionIds([]);

      expect(result).to.deep.equal([]);
    });

    it('returns empty array when suggestionIds is not an array', async () => {
      const result = await instance.findBySuggestionIds(undefined);

      expect(result).to.deep.equal([]);
    });

    it('returns empty array when postgrest returns null data', async () => {
      const inStub = stub().resolves({ data: null, error: null });
      instance.postgrestService = {
        from: stub().returns({ select: stub().returns({ in: inStub }) }),
      };

      const result = await instance.findBySuggestionIds(['sugg-1']);

      expect(result).to.deep.equal([]);
    });

    it('throws DataAccessError when postgrest returns an error', async () => {
      const queryError = { message: 'db error' };
      const inStub = stub().resolves({ data: null, error: queryError });
      instance.postgrestService = {
        from: stub().returns({ select: stub().returns({ in: inStub }) }),
      };

      await expect(instance.findBySuggestionIds(['sugg-1']))
        .to.be.rejectedWith(DataAccessError, 'Failed to find grants by suggestion IDs');
    });
  });

  describe('splitSuggestionsByGrantStatus', () => {
    const stubFindBySuggestionIds = (grantData) => {
      stub(instance, 'findBySuggestionIds').resolves(grantData ?? []);
    };

    it('returns grantedIds, notGrantedIds, and unique grantIds for the given suggestion IDs', async () => {
      const suggestionIds = ['sugg-1', 'sugg-2', 'sugg-3'];
      const grantIdA = 'grant-uuid-a';
      const grantIdB = 'grant-uuid-b';
      const grantData = [
        { suggestion_id: 'sugg-1', grant_id: grantIdA },
        { suggestion_id: 'sugg-3', grant_id: grantIdB },
      ];
      stubFindBySuggestionIds(grantData);

      const result = await instance.splitSuggestionsByGrantStatus(suggestionIds);

      expect(result.grantedIds).to.deep.equal(['sugg-1', 'sugg-3']);
      expect(result.notGrantedIds).to.deep.equal(['sugg-2']);
      expect(result.grantIds).to.have.members([grantIdA, grantIdB]);
      expect(result.grantIds).to.have.lengthOf(2);
      expect(instance.findBySuggestionIds).to.have.been.calledOnceWith(['sugg-1', 'sugg-2', 'sugg-3']);
    });

    it('returns unique grantIds when multiple suggestions share the same grant_id', async () => {
      const suggestionIds = ['sugg-1', 'sugg-2'];
      const sharedGrantId = 'grant-shared';
      const grantData = [
        { suggestion_id: 'sugg-1', grant_id: sharedGrantId },
        { suggestion_id: 'sugg-2', grant_id: sharedGrantId },
      ];
      stubFindBySuggestionIds(grantData);

      const result = await instance.splitSuggestionsByGrantStatus(suggestionIds);

      expect(result.grantedIds).to.have.lengthOf(2);
      expect(result.grantIds).to.deep.equal([sharedGrantId]);
    });

    it('returns empty arrays and grantIds when suggestionIds is empty', async () => {
      const result = await instance.splitSuggestionsByGrantStatus([]);

      expect(result).to.deep.equal({ grantedIds: [], notGrantedIds: [], grantIds: [] });
    });

    it('deduplicates and filters out empty/invalid ids', async () => {
      const suggestionIds = ['sugg-1', 'sugg-1', '', 'sugg-2'];
      const grantId = 'grant-uuid-x';
      const grantData = [{ suggestion_id: 'sugg-1', grant_id: grantId }];
      stubFindBySuggestionIds(grantData);

      const result = await instance.splitSuggestionsByGrantStatus(suggestionIds);

      expect(result.grantedIds).to.deep.equal(['sugg-1']);
      expect(result.notGrantedIds).to.deep.equal(['sugg-2']);
      expect(result.grantIds).to.deep.equal([grantId]);
      expect(instance.findBySuggestionIds).to.have.been.calledOnceWith(['sugg-1', 'sugg-2']);
    });

    it('throws DataAccessError when suggestionIds is not an array', async () => {
      await expect(instance.splitSuggestionsByGrantStatus(null))
        .to.be.rejectedWith(DataAccessError, 'splitSuggestionsByGrantStatus: suggestionIds must be an array');
      await expect(instance.splitSuggestionsByGrantStatus('sugg-1'))
        .to.be.rejectedWith(DataAccessError, 'splitSuggestionsByGrantStatus: suggestionIds must be an array');
    });

    it('rethrows DataAccessError from findBySuggestionIds', async () => {
      const dbError = new DataAccessError('Failed to find grants by suggestion IDs');
      stub(instance, 'findBySuggestionIds').rejects(dbError);

      await expect(instance.splitSuggestionsByGrantStatus(['sugg-1']))
        .to.be.rejectedWith(DataAccessError, 'Failed to find grants by suggestion IDs');
    });

    it('logs and rethrows as DataAccessError when findBySuggestionIds rejects with non-DataAccessError', async () => {
      const networkError = new Error('network failure');
      stub(instance, 'findBySuggestionIds').rejects(networkError);

      await expect(instance.splitSuggestionsByGrantStatus(['sugg-1']))
        .to.be.rejectedWith(DataAccessError, 'Failed to split suggestions by grant status');
      expect(mockLogger.error).to.have.been.calledWith('splitSuggestionsByGrantStatus failed', networkError);
    });
  });

  describe('isSuggestionGranted', () => {
    it('returns false when suggestionId is empty', async () => {
      expect(await instance.isSuggestionGranted('')).to.be.false;
      expect(await instance.isSuggestionGranted(null)).to.be.false;
      expect(await instance.isSuggestionGranted(undefined)).to.be.false;
    });

    it('returns true when the suggestion has been granted', async () => {
      stub(instance, 'findBySuggestionIds').resolves(
        [{ suggestion_id: 'sugg-1', grant_id: 'grant-1' }],
      );

      expect(await instance.isSuggestionGranted('sugg-1')).to.be.true;
    });

    it('returns false when the suggestion has not been granted', async () => {
      stub(instance, 'findBySuggestionIds').resolves([]);

      expect(await instance.isSuggestionGranted('sugg-1')).to.be.false;
    });
  });

  describe('grantSuggestions', () => {
    const siteId = 'site-001';
    const tokenType = 'grant_cwv';
    const suggestionIds = ['sugg-1', 'sugg-2'];

    let mockToken;
    let mockTokenCollection;

    beforeEach(() => {
      mockToken = {
        getRemaining: stub(),
        getCycle: stub().returns('2025-03'),
      };
      mockTokenCollection = {
        findBySiteIdAndTokenType: stub().resolves(mockToken),
      };
      mockEntityRegistry.getCollection
        .withArgs('TokenCollection')
        .returns(mockTokenCollection);
      stub(instance, 'invokeGrantSuggestionsRpc');
    });

    it('grants suggestions when tokens are available and RPC succeeds', async () => {
      const grantedSuggestions = [
        { suggestion_id: 'sugg-1', grant: { token_id: 'tok-1', granted_at: '2025-03-01T00:00:00.000Z' } },
        { suggestion_id: 'sugg-2', grant: { token_id: 'tok-1', granted_at: '2025-03-01T00:00:00.000Z' } },
      ];
      mockToken.getRemaining.returns(5);
      instance.invokeGrantSuggestionsRpc.resolves({
        data: [{ success: true, reason: null, granted_suggestions: grantedSuggestions }],
        error: null,
      });

      const result = await instance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: true, grantedSuggestions });
      expect(mockTokenCollection.findBySiteIdAndTokenType)
        .to.have.been.calledOnceWith(siteId, tokenType);
      expect(instance.invokeGrantSuggestionsRpc).to.have.been.calledOnceWith(
        suggestionIds,
        siteId,
        tokenType,
        '2025-03',
      );
    });

    it('grants multiple suggestions with one token (one token consumed per call for whole list)', async () => {
      const grantedSuggestions = [
        { suggestion_id: 'sugg-1', grant: { token_id: 'tok-1', granted_at: '2025-03-01T00:00:00.000Z' } },
        { suggestion_id: 'sugg-2', grant: { token_id: 'tok-1', granted_at: '2025-03-01T00:00:00.000Z' } },
      ];
      mockToken.getRemaining.returns(1);
      instance.invokeGrantSuggestionsRpc.resolves({
        data: [{ success: true, reason: null, granted_suggestions: grantedSuggestions }],
        error: null,
      });

      const result = await instance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: true, grantedSuggestions });
      expect(instance.invokeGrantSuggestionsRpc).to.have.been.calledOnceWith(
        suggestionIds,
        siteId,
        tokenType,
        '2025-03',
      );
    });

    it('returns no_tokens when no tokens remain (one token consumed per call for whole list)', async () => {
      mockToken.getRemaining.returns(0);

      const result = await instance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: false, reason: 'no_tokens' });
      expect(instance.invokeGrantSuggestionsRpc).to.not.have.been.called;
    });

    it('throws DataAccessError when RPC returns an error', async () => {
      mockToken.getRemaining.returns(5);
      const rpcError = { message: 'rpc failure' };
      instance.invokeGrantSuggestionsRpc.resolves({ data: null, error: rpcError });

      await expect(instance.grantSuggestions(suggestionIds, siteId, tokenType))
        .to.be.rejectedWith(DataAccessError, 'Failed to grant suggestions (grant_suggestions)');
      expect(mockLogger.error).to.have.been.calledWith('grantSuggestions: RPC failed', rpcError);
    });

    it('returns success false with reason when RPC returns empty data', async () => {
      mockToken.getRemaining.returns(5);
      instance.invokeGrantSuggestionsRpc.resolves({ data: [], error: null });

      const result = await instance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: false, reason: 'rpc_no_result' });
    });

    it('returns success false with reason from RPC row', async () => {
      mockToken.getRemaining.returns(5);
      instance.invokeGrantSuggestionsRpc.resolves({
        data: [{ success: false, reason: 'no_eligible_suggestions' }],
        error: null,
      });

      const result = await instance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: false, reason: 'no_eligible_suggestions' });
    });

    it('returns rpc_no_result when data is null', async () => {
      mockToken.getRemaining.returns(5);
      instance.invokeGrantSuggestionsRpc.resolves({ data: null, error: null });

      const result = await instance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: false, reason: 'rpc_no_result' });
    });

    it('throws DataAccessError when suggestionIds is not an array', async () => {
      await expect(instance.grantSuggestions('not-an-array', siteId, tokenType))
        .to.be.rejectedWith(DataAccessError, 'suggestionIds must be an array of non-empty strings');
    });

    it('throws DataAccessError when suggestionIds contains empty strings', async () => {
      await expect(instance.grantSuggestions(['sugg-1', ''], siteId, tokenType))
        .to.be.rejectedWith(DataAccessError, 'suggestionIds must be an array of non-empty strings');
    });

    it('throws DataAccessError when siteId is missing', async () => {
      await expect(instance.grantSuggestions(suggestionIds, '', tokenType))
        .to.be.rejectedWith(DataAccessError, 'siteId is required');
    });

    it('throws DataAccessError when tokenType is missing', async () => {
      await expect(instance.grantSuggestions(suggestionIds, siteId, ''))
        .to.be.rejectedWith(DataAccessError, 'tokenType is required');
    });
  });

  describe('revokeSuggestionGrant', () => {
    const grantId = 'grant-uuid-1';

    beforeEach(() => {
      stub(instance, 'invokeRevokeSuggestionGrantRpc');
    });

    it('revokes a grant when RPC succeeds', async () => {
      instance.invokeRevokeSuggestionGrantRpc.resolves({
        data: [{ success: true, reason: null, revoked_count: 2 }],
        error: null,
      });

      const result = await instance.revokeSuggestionGrant(grantId);

      expect(result).to.deep.equal({ success: true, revokedCount: 2 });
      expect(instance.invokeRevokeSuggestionGrantRpc)
        .to.have.been.calledOnceWith(grantId);
    });

    it('throws DataAccessError when RPC returns an error', async () => {
      const rpcError = { message: 'rpc failure' };
      instance.invokeRevokeSuggestionGrantRpc.resolves({ data: null, error: rpcError });

      await expect(instance.revokeSuggestionGrant(grantId))
        .to.be.rejectedWith(DataAccessError, 'Failed to revoke suggestion grant (revoke_suggestion_grant)');
      expect(mockLogger.error).to.have.been.calledWith('revokeSuggestionGrant: RPC failed', rpcError);
    });

    it('returns success false with reason when RPC returns empty data', async () => {
      instance.invokeRevokeSuggestionGrantRpc.resolves({ data: [], error: null });

      const result = await instance.revokeSuggestionGrant(grantId);

      expect(result).to.deep.equal({ success: false, reason: 'rpc_no_result' });
    });

    it('returns success false with reason from RPC row', async () => {
      instance.invokeRevokeSuggestionGrantRpc.resolves({
        data: [{ success: false, reason: 'grant_not_found' }],
        error: null,
      });

      const result = await instance.revokeSuggestionGrant(grantId);

      expect(result).to.deep.equal({ success: false, reason: 'grant_not_found' });
    });

    it('returns rpc_no_result when data is null', async () => {
      instance.invokeRevokeSuggestionGrantRpc.resolves({ data: null, error: null });

      const result = await instance.revokeSuggestionGrant(grantId);

      expect(result).to.deep.equal({ success: false, reason: 'rpc_no_result' });
    });

    it('throws DataAccessError when grantId is missing', async () => {
      await expect(instance.revokeSuggestionGrant(''))
        .to.be.rejectedWith(DataAccessError, 'grantId is required');
    });
  });

  describe('invokeRevokeSuggestionGrantRpc', () => {
    it('calls postgrest rpc with revoke_suggestion_grant and correct params', async () => {
      const grantId = 'grant-1';
      const rpcStub = stub().resolves({ data: [{ success: true }], error: null });
      instance.postgrestService = { rpc: rpcStub };

      await instance.invokeRevokeSuggestionGrantRpc(grantId);

      expect(rpcStub).to.have.been.calledOnceWith('revoke_suggestion_grant', {
        p_grant_id: grantId,
      });
    });

    it('returns the result from postgrest rpc', async () => {
      const rpcResult = { data: [{ success: true }], error: null };
      instance.postgrestService = { rpc: stub().resolves(rpcResult) };

      const result = await instance.invokeRevokeSuggestionGrantRpc('grant-1');

      expect(result).to.deep.equal(rpcResult);
    });

    it('throws DataAccessError when grantId is missing', async () => {
      await expect(instance.invokeRevokeSuggestionGrantRpc(''))
        .to.be.rejectedWith(DataAccessError, 'grantId is required');
      await expect(instance.invokeRevokeSuggestionGrantRpc(null))
        .to.be.rejectedWith(DataAccessError, 'grantId is required');
    });
  });

  describe('invokeGrantSuggestionsRpc', () => {
    it('calls postgrest rpc with grant_suggestions and correct params', async () => {
      const suggestionIds = ['sugg-1', 'sugg-2'];
      const siteId = 'site-1';
      const tokenType = 'grant_cwv';
      const cycle = '2025-03';
      const rpcStub = stub().resolves({ data: [{ success: true }], error: null });
      instance.postgrestService = { rpc: rpcStub };

      await instance.invokeGrantSuggestionsRpc(suggestionIds, siteId, tokenType, cycle);

      expect(rpcStub).to.have.been.calledOnceWith('grant_suggestions', {
        p_suggestion_ids: suggestionIds,
        p_site_id: siteId,
        p_token_type: tokenType,
        p_cycle: cycle,
      });
    });

    it('returns the result from postgrest rpc', async () => {
      const rpcResult = { data: [{ success: true, granted_suggestions: [] }], error: null };
      instance.postgrestService = { rpc: stub().resolves(rpcResult) };

      const result = await instance.invokeGrantSuggestionsRpc(
        ['sugg-1'],
        'site-1',
        'grant_cwv',
        '2025-03',
      );

      expect(result).to.deep.equal(rpcResult);
    });
  });
});
