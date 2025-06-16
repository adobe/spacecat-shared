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

/* eslint-env mocha */

import { expect } from 'chai';
import { encrypt, decrypt } from '../src/utils.js';

describe('Utils Tests', () => {
  describe('encrypt/decrypt', () => {
    it('encrypt/decrypt of a string with default values', async () => {
      const text = 'Hello, World!';
      const encrypted = await encrypt({
        secret: 'secret',
        salt: 'salt',
      }, text);

      const decrypted = await decrypt({
        secret: 'secret',
        salt: 'salt',
      }, encrypted);

      expect(decrypted).to.be.equal(text);
    });
  });
});
