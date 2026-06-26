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

import BaseCollection from '../base/base.collection.js';

/**
 * OAuthNonceCollection — manages OAuthNonce records.
 *
 * @class OAuthNonceCollection
 * @extends BaseCollection
 */
class OAuthNonceCollection extends BaseCollection {
  static COLLECTION_NAME = 'OAuthNonceCollection';

  /**
   * Atomically deletes a nonce by its value.
   * Returns the number of rows deleted (1 = consumed, 0 = not found or already consumed).
   * Used by auth-service to enforce single-use replay prevention at OAuth callback time.
   *
   * @param {object} keys
   * @param {string} keys.nonce - The nonce value to consume.
   * @returns {Promise<number>} 1 if the nonce was found and deleted, 0 otherwise.
   */
  async delete({ nonce } = {}) {
    if (!nonce || typeof nonce !== 'string') {
      throw new Error('nonce is required and must be a non-empty string');
    }
    const { data, error } = await this.postgrestService
      .from(this.tableName)
      .delete()
      .eq('nonce', nonce)
      .select();
    if (error) {
      throw error;
    }
    return (data ?? []).length;
  }
}

export default OAuthNonceCollection;
