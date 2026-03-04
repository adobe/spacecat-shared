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

import BaseModel from '../base/base.model.js';

/**
 * Token - Tracks token allocation and consumption per site, token type (opportunity type),
 * and cycle. Used to enforce per-opportunity monthly (or cycle) limits for granted suggestions.
 *
 * @class Token
 * @extends BaseModel
 */
class Token extends BaseModel {
  static ENTITY_NAME = 'Token';

  /**
   * Token types (opportunity types) that can have separate limits.
   */
  static TOKEN_TYPES = {
    BROKEN_BACKLINK: 'BROKEN_BACKLINK',
    CWV: 'CWV',
    ALT_TEXT: 'ALT_TEXT',
  };

  /**
   * Returns the number of tokens remaining in this cycle (total - used).
   * @returns {number}
   */
  getRemaining() {
    const total = this.getTotal?.() ?? this.total ?? 0;
    const used = this.getUsed?.() ?? this.used ?? 0;
    return Math.max(0, total - used);
  }

  /**
   * Generates the composite keys for the Token model.
   * Required for ElectroDB operations with composite primary key (siteId + tokenType + cycle).
   * @returns {Object} - The composite keys.
   */
  generateCompositeKeys() {
    return {
      siteId: this.getSiteId(),
      tokenType: this.getTokenType(),
      cycle: this.getCycle(),
    };
  }
}

export default Token;
