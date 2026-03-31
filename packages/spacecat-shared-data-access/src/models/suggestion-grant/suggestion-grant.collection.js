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

import { hasText } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';

/**
 * SuggestionGrantCollection - Manages SuggestionGrant records (suggestion_grants table).
 * Inserts happen via the grant_suggestions RPC and deletes via the revoke_suggestion_grant
 * RPC. This collection provides read-only lookup by suggestion IDs as well as grant and
 * revoke operations.
 *
 * @class SuggestionGrantCollection
 * @extends BaseCollection
 */
class SuggestionGrantCollection extends BaseCollection {
  static COLLECTION_NAME = 'SuggestionGrantCollection';

  /**
   * Finds all grant rows for the given suggestion IDs (suggestion_id, grant_id only).
   *
   * @async
   * @param {string[]} suggestionIds - Suggestion IDs to look up.
   * @returns {Promise<Array<{suggestion_id: string, grant_id: string}>>}
   * @throws {DataAccessError} - On query failure.
   */
  async findBySuggestionIds(suggestionIds) {
    if (!Array.isArray(suggestionIds) || suggestionIds.length === 0) {
      return [];
    }
    const { data, error } = await this.postgrestService
      .from(this.tableName)
      .select('suggestion_id,grant_id')
      .in('suggestion_id', suggestionIds);

    if (error) {
      throw new DataAccessError('Failed to find grants by suggestion IDs', this, error);
    }

    return data ?? [];
  }

  /**
   * Invokes the grant_suggestions RPC. Inserts suggestion_grants rows and consumes one token.
   * RPC name and parameter shape live in this collection (suggestion_grants).
   *
   * @async
   * @param {string[]} suggestionIds - Suggestion IDs to grant.
   * @param {string} siteId - Site ID.
   * @param {string} tokenType - Token type.
   * @param {string} cycle - Token cycle (e.g. '2025-01').
   * @returns {Promise<{ data: Array|null, error: object|null }>}
   */
  async invokeGrantSuggestionsRpc(suggestionIds, siteId, tokenType, cycle) {
    return this.postgrestService.rpc('grant_suggestions', {
      p_suggestion_ids: suggestionIds,
      p_site_id: siteId,
      p_token_type: tokenType,
      p_cycle: cycle,
    });
  }

  /**
   * Splits suggestion IDs into those that are granted and those that are not.
   * A suggestion is considered granted if it has at least one row in suggestion_grants.
   *
   * @async
   * @param {string[]} suggestionIds - Suggestion IDs to check.
   * @returns {Promise<{ grantedIds: string[], notGrantedIds: string[], grantIds: string[] }>}
   * @throws {DataAccessError} - On invalid input or query failure.
   */
  async splitSuggestionsByGrantStatus(suggestionIds) {
    if (!Array.isArray(suggestionIds)) {
      throw new DataAccessError('splitSuggestionsByGrantStatus: suggestionIds must be an array', this);
    }

    const deduped = [...new Set(suggestionIds.filter((id) => hasText(id)))];

    if (deduped.length === 0) {
      return { grantedIds: [], notGrantedIds: [], grantIds: [] };
    }

    try {
      const rows = await this.findBySuggestionIds(deduped);
      const grantedIdSet = new Set(rows.map((r) => r.suggestion_id));
      const grantedIds = deduped.filter((id) => grantedIdSet.has(id));
      const notGrantedIds = deduped.filter((id) => !grantedIdSet.has(id));
      const grantIds = [...new Set(rows.map((r) => r.grant_id).filter(Boolean))];

      return { grantedIds, notGrantedIds, grantIds };
    } catch (err) {
      if (err instanceof DataAccessError) throw err;
      this.log.error('splitSuggestionsByGrantStatus failed', err);
      throw new DataAccessError('Failed to split suggestions by grant status', this, err);
    }
  }

  /**
   * Returns whether a single suggestion is granted (has at least one row in suggestion_grants).
   *
   * @async
   * @param {string} suggestionId - Suggestion ID to check.
   * @returns {Promise<boolean>} True if the suggestion is granted,
   *   false otherwise or if id is empty.
   */
  async isSuggestionGranted(suggestionId) {
    if (!hasText(suggestionId)) return false;
    const { grantedIds } = await this.splitSuggestionsByGrantStatus([suggestionId]);
    return grantedIds.length > 0;
  }

  /**
   * Grants one or more suggestions by consuming a single token for the given token type.
   * Resolves the current cycle token via TokenCollection#findBySiteIdAndTokenType
   * (which auto-creates if missing), checks that at least one token remains, then calls the
   * grant_suggestions RPC to atomically consume one token and insert suggestion grants for
   * the entire list of IDs.
   *
   * @async
   * @param {string[]} suggestionIds - Suggestion IDs to grant (one token consumed for the list).
   * @param {string} siteId - The site ID that owns the token allocation.
   * @param {string} tokenType - Token type (e.g. 'grant_cwv').
   * @returns {Promise<{ success: boolean, reason?: string, grantedSuggestions?: Array }>}
   * @throws {DataAccessError} - On missing inputs or RPC failure.
   */
  async grantSuggestions(suggestionIds, siteId, tokenType) {
    if (!Array.isArray(suggestionIds) || suggestionIds.some((id) => !hasText(id))) {
      throw new DataAccessError('grantSuggestions: suggestionIds must be an array of non-empty strings', this);
    }
    if (!hasText(siteId)) {
      throw new DataAccessError('grantSuggestions: siteId is required', this);
    }
    if (!hasText(tokenType)) {
      throw new DataAccessError('grantSuggestions: tokenType is required', this);
    }

    const tokenCollection = this.entityRegistry.getCollection('TokenCollection');
    const token = await tokenCollection.findBySiteIdAndTokenType(siteId, tokenType);

    if (!token || token.getRemaining() < 1) {
      return { success: false, reason: 'no_tokens' };
    }

    const cycle = token.getCycle();
    const rpcResult = await this.invokeGrantSuggestionsRpc(
      suggestionIds,
      siteId,
      tokenType,
      cycle,
    );
    const { data, error } = rpcResult;

    if (error) {
      this.log.error('grantSuggestions: RPC failed', error);
      throw new DataAccessError('Failed to grant suggestions (grant_suggestions)', this, error);
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row || !row.success) {
      return { success: false, reason: row?.reason || 'rpc_no_result' };
    }

    return { success: true, grantedSuggestions: row.granted_suggestions };
  }

  /**
   * Invokes the revoke_suggestion_grant RPC. Deletes suggestion_grants rows for the given
   * grant ID and decrements tokens.used by 1.
   * RPC name and parameter shape live in this collection (suggestion_grants).
   *
   * @async
   * @param {string} grantId - Grant ID to revoke.
   * @returns {Promise<{ data: Array|null, error: object|null }>}
   * @throws {DataAccessError} - On missing grantId.
   */
  async invokeRevokeSuggestionGrantRpc(grantId) {
    if (!hasText(grantId)) {
      throw new DataAccessError('invokeRevokeSuggestionGrantRpc: grantId is required', this);
    }
    return this.postgrestService.rpc('revoke_suggestion_grant', {
      p_grant_id: grantId,
    });
  }

  /**
   * Revokes a suggestion grant by grant ID. Calls the revoke_suggestion_grant RPC to
   * atomically delete suggestion_grants rows and refund the consumed token.
   *
   * @async
   * @param {string} grantId - The grant ID to revoke.
   * @returns {Promise<{ success: boolean, reason?: string, revokedCount?: number }>}
   * @throws {DataAccessError} - On missing inputs or RPC failure.
   */
  async revokeSuggestionGrant(grantId) {
    if (!hasText(grantId)) {
      throw new DataAccessError('revokeSuggestionGrant: grantId is required', this);
    }

    const rpcResult = await this.invokeRevokeSuggestionGrantRpc(grantId);
    const { data, error } = rpcResult;

    if (error) {
      this.log.error('revokeSuggestionGrant: RPC failed', error);
      throw new DataAccessError('Failed to revoke suggestion grant (revoke_suggestion_grant)', this, error);
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row || !row.success) {
      return { success: false, reason: row?.reason || 'rpc_no_result' };
    }

    return { success: true, revokedCount: row.revoked_count };
  }
}

export default SuggestionGrantCollection;
