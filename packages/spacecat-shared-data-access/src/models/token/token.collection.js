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

import { hasText, getTokenGrantConfig } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';

/**
 * TokenCollection - Manages Token entities (per-site, per-tokenType, per-cycle).
 * Uses PostgREST table `tokens`. Token consumption is handled atomically by
 * the `grant_consume_token` RPC via {@link TokenCollection#grantEntities}.
 *
 * @class TokenCollection
 * @extends BaseCollection
 */
class TokenCollection extends BaseCollection {
  static COLLECTION_NAME = 'TokenCollection';

  /**
   * Finds a Token for the current cycle by siteId and tokenType. The cycle is
   * derived from the token-grant-config's cycleFormat. If no token exists for
   * the current cycle and createIfNotFound is true, creates one using the
   * configured limits.
   *
   * @param {string} siteId - Site ID (UUID).
   * @param {string} tokenType - Token type (e.g. monthly_suggestion_cwv,
   *   monthly_suggestion_broken_backlinks).
   * @param {boolean} [createIfNotFound=true] - If true, create a token when none
   *   exists; if false, return null when none exists.
   * @returns {Promise<import('./token.model.js').default|null>} Token instance
   *   (existing or newly created), or null when createIfNotFound is false.
   */
  async findBySiteIdAndTokenType(siteId, tokenType, createIfNotFound = true) {
    if (!hasText(siteId) || !hasText(tokenType)) {
      throw new DataAccessError('TokenCollection.findBySiteIdAndTokenType: siteId and tokenType are required');
    }
    const config = getTokenGrantConfig(tokenType);
    if (!config) {
      throw new DataAccessError(`TokenCollection.findBySiteIdAndTokenType: no token grant config for tokenType: ${tokenType}`);
    }
    const { currentCycle: cycle } = config;
    const existing = await this.findByIndexKeys({ siteId, tokenType, cycle }, { limit: 1 });
    if (existing) {
      return existing;
    }
    if (!createIfNotFound) {
      return null;
    }
    return this.create({
      siteId,
      tokenType,
      cycle,
      total: config.tokensPerCycle,
      used: 0,
    });
  }

  /**
   * Grants one or more entities by consuming a token for the given token type.
   * Resolves the current cycle token via {@link TokenCollection#findBySiteIdAndTokenType}
   * (which auto-creates if missing), checks remaining quota, then calls the
   * grant_consume_token RPC to atomically consume and insert grants.
   *
   * @async
   * @param {string[]} entityIds - One or more entity IDs to grant (e.g. suggestion IDs).
   * @param {string} parentId - Parent ID (e.g. opportunity id) the entities belong to.
   * @param {string} siteId - The site ID that owns the token allocation.
   * @param {string} tokenType - Token type (e.g. 'monthly_suggestion_cwv').
   * @returns {Promise<{ granted: boolean, reason?: string }>}
   * @throws {DataAccessError} - On missing inputs or RPC failure.
   */
  async grantEntities(entityIds, parentId, siteId, tokenType) {
    if (!Array.isArray(entityIds) || entityIds.some((id) => !hasText(id))) {
      throw new DataAccessError('grantEntities: entityIds must be an array of non-empty strings', this);
    }
    if (!hasText(parentId)) {
      throw new DataAccessError('grantEntities: parentId is required', this);
    }
    if (!hasText(siteId)) {
      throw new DataAccessError('grantEntities: siteId is required', this);
    }
    if (!hasText(tokenType)) {
      throw new DataAccessError('grantEntities: tokenType is required', this);
    }

    const token = await this.findBySiteIdAndTokenType(siteId, tokenType);

    if (token.getRemaining() < entityIds.length) {
      return { granted: false, reason: 'no_tokens' };
    }

    const cycle = token.getCycle();

    const { data, error } = await this.postgrestService.rpc('grant_consume_token', {
      p_entity_ids: entityIds,
      p_parent_id: parentId,
      p_site_id: siteId,
      p_token_type: tokenType,
      p_cycle: cycle,
    });

    if (error) {
      this.log.error('grantEntities: RPC failed', error);
      throw new DataAccessError('Failed to grant entities (grant_consume_token)', this, error);
    }

    const row = Array.isArray(data) && data.length > 0 ? data[0] : null;
    if (!row || !row.granted) {
      return { granted: false, reason: row?.reason || 'rpc_no_result' };
    }

    return { granted: true };
  }
}

export default TokenCollection;
