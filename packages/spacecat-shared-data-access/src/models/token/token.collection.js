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

import { hasText, isNonEmptyArray, getTokenGrantConfig } from '@adobe/spacecat-shared-utils';

import BaseCollection from '../base/base.collection.js';
import DataAccessError from '../../errors/data-access.error.js';

/**
 * TokenCollection - Manages Token entities (per-site, per-tokenType, per-cycle).
 * Uses PostgREST table `tokens`.
 *
 * @class TokenCollection
 * @extends BaseCollection
 */
class TokenCollection extends BaseCollection {
  static COLLECTION_NAME = 'TokenCollection';

  /**
   * Finds a Token for the current cycle by siteId and tokenType. The cycle is
   * derived from the token-grant-config's cycleFormat. If no token exists for
   * the current cycle and options.createIfNotFound is true, creates one. The
   * token total is the minimum of options.total (if supplied) and the config
   * tokensPerCycle, clamped to at least 1.
   *
   * @param {string} siteId - Site ID (UUID).
   * @param {string} tokenType - Token type (e.g. grant_cwv,
   *   grant_broken_backlinks).
   * @param {Object} [options={}] - Options.
   * @param {boolean} [options.createIfNotFound=false] - If true, create a token when none exists.
   * @param {number} [options.total] - Optional supplied total;
   *   actual total is min(options.total, config.tokensPerCycle), at least 1.
   * @returns {Promise<import('./token.model.js').default|null>} Token instance
   *   (existing or newly created), or null when none exists and createIfNotFound is false.
   */
  async findBySiteIdAndTokenType(siteId, tokenType, options = {}) {
    if (!hasText(siteId) || !hasText(tokenType)) {
      throw new DataAccessError('TokenCollection.findBySiteIdAndTokenType: siteId and tokenType are required');
    }
    const config = getTokenGrantConfig(tokenType);
    if (!config) {
      throw new DataAccessError(`TokenCollection.findBySiteIdAndTokenType: no token grant config for tokenType: ${tokenType}`);
    }
    const { currentCycle: cycle } = config;
    const existing = await this.findByIndexKeys({ siteId, tokenType, cycle }, { limit: 1 });
    if (existing || options.createIfNotFound !== true) {
      return existing || null;
    }
    const total = options.total != null
      ? Math.max(1, Math.min(Number(options.total), config.tokensPerCycle))
      : config.tokensPerCycle;
    return this.create({
      siteId,
      tokenType,
      cycle,
      total,
      used: 0,
    });
  }

  /**
   * Finds Tokens for the given siteId and cycle in a single PostgREST query,
   * optionally filtered to a subset of tokenTypes. Backed by the
   * (site_id, cycle) index, so the wildcard form (no tokenTypes) is also a
   * range scan rather than a table scan.
   *
   * @param {string} siteId - Site ID (UUID).
   * @param {string[]|null} [tokenTypes] - Optional non-empty array of token
   *   type strings. When omitted, returns all token types for the cycle.
   * @param {string} cycle - Cycle string (e.g. '2025-03').
   * @param {Object} [options={}] - Query options forwarded to the underlying query.
   * @returns {Promise<import('./token.model.js').default[]>} Array of Token instances.
   */
  async allBySiteIdAndTokenTypesAndCycle(siteId, tokenTypes, cycle, options = {}) {
    if (!hasText(siteId)) {
      throw new DataAccessError('TokenCollection.allBySiteIdAndTokenTypesAndCycle: siteId is required');
    }
    if (!hasText(cycle)) {
      throw new DataAccessError('TokenCollection.allBySiteIdAndTokenTypesAndCycle: cycle is required');
    }
    const hasTypeFilter = tokenTypes != null;
    if (hasTypeFilter && (!isNonEmptyArray(tokenTypes) || !tokenTypes.every(hasText))) {
      throw new DataAccessError('TokenCollection.allBySiteIdAndTokenTypesAndCycle: tokenTypes must be a non-empty array of strings when provided');
    }
    const queryOptions = { ...options };
    if (hasTypeFilter) {
      queryOptions.where = (attrs, op) => op.in(attrs.tokenType, tokenTypes);
    }
    return this.all({ siteId, cycle }, queryOptions);
  }
}

export default TokenCollection;
