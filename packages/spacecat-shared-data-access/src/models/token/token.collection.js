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
import Token from './token.model.js';

/**
 * TokenCollection - Manages Token entities (per-site, per-tokenType, per-cycle).
 * Supports getRemainingToken(siteId, tokenType, cycle), useToken, upgradePlan flows.
 *
 * @class TokenCollection
 * @extends BaseCollection
 */
class TokenCollection extends BaseCollection {
  static COLLECTION_NAME = 'TokenCollection';

  /**
   * Finds a Token by composite key (siteId, tokenType, cycle).
   * Overrides base findById for Token's composite primary key.
   *
   * @param {string} [siteId] - Site ID.
   * @param {string} [tokenType] - Token type (e.g. BROKEN_BACKLINK, CWV, ALT_TEXT).
   * @param {string} [cycle] - Cycle identifier (e.g. YYYY-MM).
   * @returns {Promise<import('./token.model.js').default|null>} Token instance or null.
   */
  async findById(siteId, tokenType, cycle) {
    if (!hasText(siteId) || !hasText(tokenType) || !hasText(cycle)) {
      throw new DataAccessError('TokenCollection.findById: siteId, tokenType, and cycle are required');
    }
    return this.findByIndexKeys({ siteId, tokenType, cycle }, { limit: 1 });
  }

  /**
   * Finds a Token by composite key (siteId, tokenType, cycle). Uses entity.get for direct lookup.
   *
   * @param {string} siteId - Site ID.
   * @param {string} tokenType - Token type (e.g. BROKEN_BACKLINK, CWV, ALT_TEXT).
   * @param {string} cycle - Cycle identifier (e.g. YYYY-MM).
   * @returns {Promise<import('./token.model.js').default|null>} Token instance or null.
   */
  async findBySiteIdAndTokenTypeAndCycle(siteId, tokenType, cycle) {
    if (!hasText(siteId) || !hasText(tokenType) || !hasText(cycle)) {
      throw new DataAccessError('TokenCollection.findBySiteIdAndTokenTypeAndCycle: siteId, tokenType, and cycle are required');
    }
    try {
      const result = await this.entity.get({ siteId, tokenType, cycle }).go();
      if (!result?.data) return null;
      // eslint-disable-next-line new-cap
      return new Token(
        this.electroService,
        this.entityRegistry,
        this.schema,
        result.data,
        this.log,
      );
    } catch (error) {
      this.log.error('Failed to find token by composite key', error);
      throw new DataAccessError('Failed to find token', this, error);
    }
  }

  /**
   * Returns the number of tokens remaining for the given site, token type, and cycle.
   *
   * @param {string} siteId - Site ID.
   * @param {string} tokenType - Token type.
   * @param {string} cycle - Cycle identifier (e.g. YYYY-MM).
   * @returns {Promise<number>} Remaining token count (0 if no token record or none left).
   */
  async getRemainingToken(siteId, tokenType, cycle) {
    const token = await this.findBySiteIdAndTokenTypeAndCycle(siteId, tokenType, cycle);
    if (!token) return 0;
    return token.getRemaining?.() ?? 0;
  }

  /**
   * Consumes one token for the given site, token type, and cycle. Atomically increments
   * the token's used count and returns grant metadata. Returns null if no token or
   * no remaining tokens.
   *
   * @param {string} siteId - Site ID.
   * @param {string} tokenType - Token type.
   * @param {string} cycle - Cycle identifier (e.g. YYYY-MM).
   * @returns {Promise<{ tokenId: string, cycle: string }|null>} Grant metadata or null.
   */
  async useToken(siteId, tokenType, cycle) {
    const token = await this.findBySiteIdAndTokenTypeAndCycle(siteId, tokenType, cycle);
    if (!token) return null;
    const remaining = token.getRemaining?.() ?? 0;
    if (remaining < 1) return null;

    const used = (token.getUsed?.() ?? token.used ?? 0) + 1;
    token.setUsed(used);
    await token.save();

    const tokenId = `${siteId}#${tokenType}#${cycle}`;
    return { tokenId, cycle };
  }
}

export default TokenCollection;
