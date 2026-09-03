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

import crypto from 'crypto';
import { expect, use } from 'chai';
import chaiAsPromised from 'chai-as-promised';

import {
  createPublicKeyLoader,
  loadPublicKey,
} from '../../../../src/auth/handlers/utils/token.js';

use(chaiAsPromised);

const createPublicKeyB64 = () => {
  const { publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
  return Buffer.from(
    publicKey.export({ format: 'pem', type: 'spki' }),
  ).toString('base64');
};

describe('token utils', () => {
  it('exports the direct and context-aware public-key loaders', () => {
    expect(loadPublicKey).to.be.a('function');
    expect(createPublicKeyLoader).to.be.a('function');
  });

  it('rejects a malformed replacement key without losing the cached key', async () => {
    const originalPublicKeyB64 = createPublicKeyB64();
    const context = {
      env: {
        AUTH_PUBLIC_KEY_B64: originalPublicKeyB64,
      },
    };
    const loader = createPublicKeyLoader();
    const originalPublicKey = await loader(context);

    context.env.AUTH_PUBLIC_KEY_B64 = 'not-a-public-key';
    await expect(loader(context)).to.be.rejected;

    context.env.AUTH_PUBLIC_KEY_B64 = originalPublicKeyB64;
    const restoredPublicKey = await loader(context);

    expect(restoredPublicKey).to.equal(originalPublicKey);
  });
});
