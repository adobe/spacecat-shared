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

/* c8 ignore start */

import { isIsoDate } from '@adobe/spacecat-shared-utils';

import SchemaBuilder from '../base/schema.builder.js';
import OAuthNonce from './oauth-nonce.model.js';
import OAuthNonceCollection from './oauth-nonce.collection.js';

// nonce is the state parameter sent to the OAuth provider and consumed exactly once
// at callback time to prevent CSRF/replay attacks. The index on nonce powers the
// OAuthNonceCollection.delete({ nonce }) lookup used by auth-service at callback time.
const schema = new SchemaBuilder(OAuthNonce, OAuthNonceCollection)
  .addAttribute('nonce', {
    type: 'string',
    required: true,
    readOnly: true,
  })
  .addAttribute('expiresAt', {
    type: 'string',
    required: true,
    validate: (value) => isIsoDate(value),
  })
  .addIndex(
    { composite: ['nonce'] },
    { composite: [] },
  );

export default schema.build();
