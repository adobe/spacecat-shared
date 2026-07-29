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

import BaseModel from '../base/base.model.js';

/**
 * IdempotencyKey — deduplicates concurrent or retried requests using the
 * Stripe idempotency pattern.
 *
 * Status lifecycle:
 *   processing → completed   (cached success response)
 *   processing → failed      (cached error response, client must generate new key to retry)
 *
 * Keys are scoped to (key, organizationId, endpoint) — cross-org collision is impossible
 * and the same key can be used independently across different operations.
 *
 * Keys expire after 24 hours (or shorter for ephemeral locks like token refresh dedup).
 *
 * @class IdempotencyKey
 * @extends BaseModel
 */
class IdempotencyKey extends BaseModel {
  static ENTITY_NAME = 'IdempotencyKey';

  static STATUSES = {
    PROCESSING: 'processing',
    COMPLETED: 'completed',
    FAILED: 'failed',
  };
}

export default IdempotencyKey;
