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

import { expect } from 'chai';
import { isValidUUID } from '@adobe/spacecat-shared-utils';
import { uuidv7 } from '../../../src/util/uuid.js';

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('uuidv7', () => {
  it('produces a string in canonical UUID format', () => {
    const id = uuidv7();
    expect(id).to.be.a('string');
    expect(id).to.match(UUID_FORMAT);
    expect(isValidUUID(id)).to.be.true;
  });

  it('pins the version nibble to 7', () => {
    for (let i = 0; i < 64; i += 1) {
      const id = uuidv7();
      // Position 14 is the high nibble of byte 6 — the version field per RFC 9562.
      expect(id.charAt(14)).to.equal('7', `expected version nibble 7 in ${id}`);
    }
  });

  it('pins the variant bits to RFC 4122 (8/9/a/b)', () => {
    for (let i = 0; i < 64; i += 1) {
      const id = uuidv7();
      // Position 19 is the high nibble of byte 8 — the variant field.
      expect('89ab').to.include(id.charAt(19), `expected variant 8/9/a/b in ${id}`);
    }
  });

  it('encodes the current unix-ms in the first 48 bits', () => {
    const before = Date.now();
    const id = uuidv7();
    const after = Date.now();

    const tsHex = id.slice(0, 8) + id.slice(9, 13);
    const ts = parseInt(tsHex, 16);

    expect(ts).to.be.at.least(before);
    expect(ts).to.be.at.most(after);
  });

  it('emits time-sortable ids across distinct millisecond ticks', async () => {
    const a = uuidv7();
    await new Promise((resolve) => {
      setTimeout(resolve, 2);
    });
    const b = uuidv7();
    expect(a < b).to.be.true;
  });

  it('produces unique ids across many calls', () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i += 1) {
      ids.add(uuidv7());
    }
    expect(ids.size).to.equal(1000);
  });
});
