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

import BaseModel from '../base/base.model.js';

/**
 * OAuthNonce — a single-use state token used for OAuth 2.0 CSRF/replay prevention.
 *
 * Lifecycle:
 *   1. Created by auth-service at the start of an OAuth authorization flow.
 *   2. Consumed atomically (via OAuthNonceCollection.delete) when the provider
 *      redirects back to the callback endpoint.
 *   3. If the nonce cannot be consumed the callback is rejected (replay attack).
 *
 * Rows are short-lived (TTL ≈ 10 minutes). A background cleanup job can sweep
 * expired rows, but replay protection does not depend on cleanup — the nonce is
 * deleted on first use regardless of expiresAt.
 *
 * @class OAuthNonce
 * @extends BaseModel
 */
class OAuthNonce extends BaseModel {
  static ENTITY_NAME = 'OAuthNonce';
}

export default OAuthNonce;
