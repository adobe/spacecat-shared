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
   * the current cycle and createIfNotFound is true, creates one using the
   * configured limits.
   *
   * @param {string} siteId - Site ID (UUID).
   * @param {string} tokenType - Token type (e.g. monthly_suggestion_cwv,
   *   monthly_suggestion_broken_backlinks).
   * @param {boolean} [createIfNotFound=false] - If true, create a token when none
   *   exists; if false, return null when none exists.
   * @returns {Promise<import('./token.model.js').default|null>} Token instance
   *   (existing or newly created), or null when none exists and createIfNotFound is false.
   */
  async findBySiteIdAndTokenType(siteId, tokenType, createIfNotFound = false) {
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
}

export default TokenCollection;
