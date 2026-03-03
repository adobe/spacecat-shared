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
import { importSPKI, jwtVerify } from 'jose';

export const ALGORITHM_ES256 = 'ES256';
export const ISSUER = 'https://spacecat.experiencecloud.live';

/**
 * Loads the ES256 public key from the context environment variable AUTH_PUBLIC_KEY_B64.
 * @param {Object} context - The universal context.
 * @returns {Promise<CryptoKey>} The imported public key.
 */
export async function loadPublicKey(context) {
  const authPublicKeyB64 = context.env?.AUTH_PUBLIC_KEY_B64;
  if (!hasText(authPublicKeyB64)) {
    throw new Error('No public key provided');
  }
  const pem = Buffer.from(authPublicKeyB64, 'base64').toString('utf-8');
  return importSPKI(pem, ALGORITHM_ES256);
}

/**
 * Validates a JWT token against the given public key using ES256.
 * @param {string} token - The raw JWT string.
 * @param {CryptoKey} publicKey - The public key to verify against.
 * @returns {Promise<Object>} The verified token payload.
 */
export async function validateToken(token, publicKey) {
  const { payload } = await jwtVerify(token, publicKey, {
    algorithms: [ALGORITHM_ES256],
    clockTolerance: 5,
    complete: false,
    ignoreExpiration: false,
    issuer: ISSUER,
  });
  return payload;
}
