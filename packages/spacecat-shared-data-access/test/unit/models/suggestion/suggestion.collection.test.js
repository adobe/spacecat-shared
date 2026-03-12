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
import chaiAsPromised from 'chai-as-promised';
import sinonChai from 'sinon-chai';
import { stub, restore } from 'sinon';

import Suggestion from '../../../../src/models/suggestion/suggestion.model.js';
import SuggestionCollection from '../../../../src/models/suggestion/suggestion.collection.js';
import DataAccessError from '../../../../src/errors/data-access.error.js';

import { createElectroMocks } from '../../util.js';

chaiUse(chaiAsPromised);
chaiUse(sinonChai);

describe('SuggestionCollection', () => {
  let instance;

  let mockElectroService;
  let mockEntityRegistry;
  let mockLogger;
  let model;
  let schema;

  const mockRecord = {
    suggestionId: 's12345',
    opportunityId: 'op67890',
    data: {
      title: 'Test Suggestion',
      description: 'This is a test suggestion.',
    },
  };

  beforeEach(() => {
    ({
      mockElectroService,
      mockEntityRegistry,
      mockLogger,
      collection: instance,
      model,
      schema,
    } = createElectroMocks(Suggestion, mockRecord));
  });

  afterEach(() => {
    restore();
  });

  describe('constructor', () => {
    it('initializes the SuggestionCollection instance correctly', () => {
      expect(instance).to.be.an('object');
      expect(instance.electroService).to.equal(mockElectroService);
      expect(instance.entityRegistry).to.equal(mockEntityRegistry);
      expect(instance.schema).to.equal(schema);
      expect(instance.log).to.equal(mockLogger);

      expect(model).to.be.an('object');
    });
  });

  describe('bulkUpdateStatus', () => {
    it('updates the status of multiple suggestions', async () => {
      const mockSuggestions = [model];
      const mockStatus = 'NEW';

      await instance.bulkUpdateStatus(mockSuggestions, mockStatus);

      expect(mockElectroService.entities.suggestion.put.calledOnce).to.be.true;
      const putCallArgs = mockElectroService.entities.suggestion.put.firstCall.args[0];
      expect(putCallArgs).to.be.an('array').with.length(1);
      expect(putCallArgs[0]).to.have.property('suggestionId', 's12345');
      expect(putCallArgs[0]).to.have.property('opportunityId', 'op67890');
      expect(putCallArgs[0]).to.have.property('status', 'NEW');
      expect(putCallArgs[0]).to.have.property('updatedAt').that.is.a('string');
      expect(putCallArgs[0].data).to.deep.equal({
        title: 'Test Suggestion',
        description: 'This is a test suggestion.',
      });

      // Note: updatedAt is updated in the database but not in the local model instances
      // The _saveMany method updates the database records but doesn't modify the model instances
    });

    it('throws an error if suggestions is not an array', async () => {
      await expect(instance.bulkUpdateStatus({}, 'NEW'))
        .to.be.rejectedWith('Suggestions must be an array');
    });

    it('throws an error if status is not provided', async () => {
      await expect(instance.bulkUpdateStatus([model], 'foo'))
        .to.be.rejectedWith('Invalid status: foo. Must be one of: NEW, APPROVED, IN_PROGRESS, SKIPPED, FIXED, ERROR, OUTDATED, PENDING_VALIDATION, REJECTED');
    });
  });

  describe('getFixEntitiesBySuggestionId', () => {
    it('should get fix entities for a suggestion', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const mockJunctionRecords = [
        { getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174003' },
        { getFixEntityId: () => '123e4567-e89b-12d3-a456-426614174004' },
      ];
      const mockFixEntities = [
        { id: '123e4567-e89b-12d3-a456-426614174003', title: 'Fix 1' },
        { id: '123e4567-e89b-12d3-a456-426614174004', title: 'Fix 2' },
      ];

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves(mockJunctionRecords),
        removeByIndexKeys: stub().resolves(),
      };

      const mockFixEntityCollection = {
        batchGetByKeys: stub().resolves({
          data: mockFixEntities,
          unprocessed: [],
        }),
        idName: 'fixEntityId',
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);
      mockEntityRegistry.getCollection
        .withArgs('FixEntityCollection')
        .returns(mockFixEntityCollection);

      const result = await instance.getFixEntitiesBySuggestionId(suggestionId);

      expect(result).to.deep.equal(mockFixEntities);

      expect(mockFixEntitySuggestionCollection.allBySuggestionId)
        .to.have.been.calledOnceWith(suggestionId);
      expect(mockFixEntityCollection.batchGetByKeys).to.have.been.calledOnceWith([
        { fixEntityId: '123e4567-e89b-12d3-a456-426614174003' },
        { fixEntityId: '123e4567-e89b-12d3-a456-426614174004' },
      ]);
    });

    it('should return empty arrays when no junction records found', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().resolves([]),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      const result = await instance.getFixEntitiesBySuggestionId(suggestionId);

      expect(result).to.deep.equal([]);

      expect(mockFixEntitySuggestionCollection.allBySuggestionId)
        .to.have.been.calledOnceWith(suggestionId);
    });

    it('should throw error when suggestionId is not provided', async () => {
      await expect(instance.getFixEntitiesBySuggestionId())
        .to.be.rejectedWith('Validation failed in SuggestionCollection: suggestionId must be a valid UUID');
    });

    it('should handle errors and throw DataAccessError', async () => {
      const suggestionId = '123e4567-e89b-12d3-a456-426614174002';
      const error = new Error('Database error');

      const mockFixEntitySuggestionCollection = {
        allBySuggestionId: stub().rejects(error),
        removeByIndexKeys: stub().resolves(),
      };

      mockEntityRegistry.getCollection
        .withArgs('FixEntitySuggestionCollection')
        .returns(mockFixEntitySuggestionCollection);

      await expect(instance.getFixEntitiesBySuggestionId(suggestionId))
        .to.be.rejectedWith(DataAccessError);
      expect(mockLogger.error).to.have.been.calledWith('Failed to get fix entities for suggestion', error);
    });
  });

  describe('partitionByGranted', () => {
    it('returns granted, notGranted, and unique grantIds for the given suggestions', async () => {
      const sugg1 = { getId: () => 'sugg-1', name: 'a' };
      const sugg2 = { getId: () => 'sugg-2', name: 'b' };
      const sugg3 = { getId: () => 'sugg-3', name: 'c' };
      const suggestions = [sugg1, sugg2, sugg3];
      const grantIdA = 'grant-uuid-a';
      const grantIdB = 'grant-uuid-b';
      const grantData = [
        { suggestion_id: 'sugg-1', grant_id: grantIdA },
        { suggestion_id: 'sugg-3', grant_id: grantIdB },
      ];
      const inStub = stub().resolves({ data: grantData, error: null });
      const fromStub = stub().returns({
        select: stub().returns({ in: inStub }),
      });
      instance.postgrestService = { from: fromStub };

      const result = await instance.partitionByGranted(suggestions);

      expect(result.granted).to.deep.equal([sugg1, sugg3]);
      expect(result.notGranted).to.deep.equal([sugg2]);
      expect(result.grantIds).to.have.members([grantIdA, grantIdB]);
      expect(result.grantIds).to.have.lengthOf(2);
      expect(fromStub).to.have.been.calledOnceWith('suggestion_grants');
      expect(inStub).to.have.been.calledOnceWith('suggestion_id', ['sugg-1', 'sugg-2', 'sugg-3']);
    });

    it('returns unique grantIds when multiple suggestions share the same grant_id', async () => {
      const sugg1 = { getId: () => 'sugg-1' };
      const sugg2 = { getId: () => 'sugg-2' };
      const sharedGrantId = 'grant-shared';
      const grantData = [
        { suggestion_id: 'sugg-1', grant_id: sharedGrantId },
        { suggestion_id: 'sugg-2', grant_id: sharedGrantId },
      ];
      const inStub = stub().resolves({ data: grantData, error: null });
      instance.postgrestService = {
        from: stub().returns({
          select: stub().returns({ in: inStub }),
        }),
      };

      const result = await instance.partitionByGranted([sugg1, sugg2]);

      expect(result.granted).to.have.lengthOf(2);
      expect(result.grantIds).to.deep.equal([sharedGrantId]);
    });

    it('accepts plain objects with id property', async () => {
      const sugg1 = { id: 'sugg-1' };
      const sugg2 = { id: 'sugg-2' };
      const grantId = 'grant-uuid-1';
      const inStub = stub().resolves({
        data: [{ suggestion_id: 'sugg-1', grant_id: grantId }],
        error: null,
      });
      instance.postgrestService = {
        from: stub().returns({
          select: stub().returns({ in: inStub }),
        }),
      };

      const result = await instance.partitionByGranted([sugg1, sugg2]);

      expect(result.granted).to.deep.equal([sugg1]);
      expect(result.notGranted).to.deep.equal([sugg2]);
      expect(result.grantIds).to.deep.equal([grantId]);
    });

    it('returns empty arrays and grantIds when suggestions is empty', async () => {
      const result = await instance.partitionByGranted([]);

      expect(result).to.deep.equal({ granted: [], notGranted: [], grantIds: [] });
    });

    it('deduplicates by id and filters out suggestions without valid id', async () => {
      const sugg1 = { getId: () => 'sugg-1' };
      const sugg2 = { getId: () => 'sugg-2' };
      const grantId = 'grant-uuid-x';
      const inStub = stub().resolves({
        data: [{ suggestion_id: 'sugg-1', grant_id: grantId }],
        error: null,
      });
      instance.postgrestService = {
        from: stub().returns({
          select: stub().returns({ in: inStub }),
        }),
      };

      const result = await instance.partitionByGranted([sugg1, sugg1, { getId: () => '' }, sugg2]);

      expect(result.granted).to.deep.equal([sugg1]);
      expect(result.notGranted).to.deep.equal([sugg2]);
      expect(result.grantIds).to.deep.equal([grantId]);
      expect(inStub).to.have.been.calledWith('suggestion_id', ['sugg-1', 'sugg-2']);
    });

    it('throws DataAccessError when suggestions is not an array', async () => {
      await expect(instance.partitionByGranted(null))
        .to.be.rejectedWith(DataAccessError, 'partitionByGranted: suggestions must be an array');
      await expect(instance.partitionByGranted('sugg-1'))
        .to.be.rejectedWith(DataAccessError, 'partitionByGranted: suggestions must be an array');
    });

    it('throws DataAccessError when query fails', async () => {
      const queryError = { message: 'db error' };
      instance.postgrestService = {
        from: stub().returns({
          select: stub().returns({
            in: stub().resolves({ data: null, error: queryError }),
          }),
        }),
      };

      await expect(instance.partitionByGranted([{ getId: () => 'sugg-1' }]))
        .to.be.rejectedWith(DataAccessError, 'Failed to partition suggestions by granted status');
      expect(mockLogger.error).to.have.been.calledWith('partitionByGranted: query failed', queryError);
    });
  });

  describe('grantSuggestions', () => {
    const siteId = 'site-001';
    const tokenType = 'monthly_suggestion_cwv';
    const suggestionIds = ['sugg-1', 'sugg-2'];

    let postgrestInstance;
    let mockToken;
    let mockTokenCollection;

    beforeEach(() => {
      mockElectroService.entities = {};
      postgrestInstance = new SuggestionCollection(
        mockElectroService,
        mockEntityRegistry,
        schema,
        mockLogger,
      );

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
      mockElectroService.rpc = stub();
    });

    it('grants suggestions when tokens are available and RPC succeeds', async () => {
      const grantedSuggestions = [
        { suggestion_id: 'sugg-1', grant: { token_id: 'tok-1', granted_at: '2025-03-01T00:00:00.000Z' } },
        { suggestion_id: 'sugg-2', grant: { token_id: 'tok-1', granted_at: '2025-03-01T00:00:00.000Z' } },
      ];
      mockToken.getRemaining.returns(5);
      mockElectroService.rpc.resolves({
        data: [{ success: true, reason: null, granted_suggestions: grantedSuggestions }],
        error: null,
      });

      const result = await postgrestInstance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: true, grantedSuggestions });
      expect(mockTokenCollection.findBySiteIdAndTokenType)
        .to.have.been.calledOnceWith(siteId, tokenType);
      expect(mockElectroService.rpc).to.have.been.calledOnceWith(
        'grant_suggestions',
        {
          p_suggestion_ids: suggestionIds,
          p_site_id: siteId,
          p_token_type: tokenType,
          p_cycle: '2025-03',
        },
      );
    });

    it('grants multiple suggestions with one token (one token consumed per call for whole list)', async () => {
      const grantedSuggestions = [
        { suggestion_id: 'sugg-1', grant: { token_id: 'tok-1', granted_at: '2025-03-01T00:00:00.000Z' } },
        { suggestion_id: 'sugg-2', grant: { token_id: 'tok-1', granted_at: '2025-03-01T00:00:00.000Z' } },
      ];
      mockToken.getRemaining.returns(1);
      mockElectroService.rpc.resolves({
        data: [{ success: true, reason: null, granted_suggestions: grantedSuggestions }],
        error: null,
      });

      const result = await postgrestInstance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: true, grantedSuggestions });
      expect(mockElectroService.rpc).to.have.been.calledOnceWith(
        'grant_suggestions',
        {
          p_suggestion_ids: suggestionIds,
          p_site_id: siteId,
          p_token_type: tokenType,
          p_cycle: '2025-03',
        },
      );
    });

    it('returns no_tokens when no tokens remain (one token consumed per call for whole list)', async () => {
      mockToken.getRemaining.returns(0);

      const result = await postgrestInstance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: false, reason: 'no_tokens' });
      expect(mockElectroService.rpc).to.not.have.been.called;
    });

    it('throws DataAccessError when RPC returns an error', async () => {
      mockToken.getRemaining.returns(5);
      const rpcError = { message: 'rpc failure' };
      mockElectroService.rpc.resolves({ data: null, error: rpcError });

      await expect(postgrestInstance.grantSuggestions(suggestionIds, siteId, tokenType))
        .to.be.rejectedWith(DataAccessError, 'Failed to grant suggestions (grant_suggestions)');
      expect(mockLogger.error).to.have.been.calledWith('grantSuggestions: RPC failed', rpcError);
    });

    it('returns success false with reason when RPC returns empty data', async () => {
      mockToken.getRemaining.returns(5);
      mockElectroService.rpc.resolves({ data: [], error: null });

      const result = await postgrestInstance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: false, reason: 'rpc_no_result' });
    });

    it('returns success false with reason from RPC row', async () => {
      mockToken.getRemaining.returns(5);
      mockElectroService.rpc.resolves({
        data: [{ success: false, reason: 'no_eligible_suggestions' }],
        error: null,
      });

      const result = await postgrestInstance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: false, reason: 'no_eligible_suggestions' });
    });

    it('returns rpc_no_result when data is null', async () => {
      mockToken.getRemaining.returns(5);
      mockElectroService.rpc.resolves({ data: null, error: null });

      const result = await postgrestInstance.grantSuggestions(suggestionIds, siteId, tokenType);

      expect(result).to.deep.equal({ success: false, reason: 'rpc_no_result' });
    });

    it('throws DataAccessError when suggestionIds is not an array', async () => {
      await expect(postgrestInstance.grantSuggestions('not-an-array', siteId, tokenType))
        .to.be.rejectedWith(DataAccessError, 'suggestionIds must be an array of non-empty strings');
    });

    it('throws DataAccessError when suggestionIds contains empty strings', async () => {
      await expect(postgrestInstance.grantSuggestions(['sugg-1', ''], siteId, tokenType))
        .to.be.rejectedWith(DataAccessError, 'suggestionIds must be an array of non-empty strings');
    });

    it('throws DataAccessError when siteId is missing', async () => {
      await expect(postgrestInstance.grantSuggestions(suggestionIds, '', tokenType))
        .to.be.rejectedWith(DataAccessError, 'siteId is required');
    });

    it('throws DataAccessError when tokenType is missing', async () => {
      await expect(postgrestInstance.grantSuggestions(suggestionIds, siteId, ''))
        .to.be.rejectedWith(DataAccessError, 'tokenType is required');
    });
  });
});
