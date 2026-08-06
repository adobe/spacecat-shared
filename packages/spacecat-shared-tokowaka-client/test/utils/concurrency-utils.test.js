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
import { mapWithConcurrency } from '../../src/utils/concurrency-utils.js';

const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms);
});

describe('Concurrency Utils', () => {
  describe('mapWithConcurrency', () => {
    it('returns an empty array for empty or non-array input', async () => {
      expect(await mapWithConcurrency([], async (x) => x)).to.deep.equal([]);
      expect(await mapWithConcurrency(null, async (x) => x)).to.deep.equal([]);
      expect(await mapWithConcurrency(undefined, async (x) => x)).to.deep.equal([]);
    });

    it('maps all items and preserves input order', async () => {
      const items = [1, 2, 3, 4, 5];
      const results = await mapWithConcurrency(
        items,
        async (n) => {
          // Reverse the delay so later items finish first, proving order is preserved.
          await delay((items.length - n) * 5);
          return n * 10;
        },
        2,
      );
      expect(results).to.deep.equal([10, 20, 30, 40, 50]);
    });

    it('passes the index to the mapper', async () => {
      const results = await mapWithConcurrency(
        ['a', 'b', 'c'],
        async (item, index) => `${item}${index}`,
        2,
      );
      expect(results).to.deep.equal(['a0', 'b1', 'c2']);
    });

    it('never exceeds the concurrency limit', async () => {
      let active = 0;
      let maxActive = 0;
      const items = Array.from({ length: 20 }, (_, i) => i);

      await mapWithConcurrency(
        items,
        async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await delay(5);
          active -= 1;
        },
        4,
      );

      expect(maxActive).to.be.at.most(4);
    });

    it('defaults concurrency to 5 when not provided', async () => {
      let active = 0;
      let maxActive = 0;
      const items = Array.from({ length: 30 }, (_, i) => i);

      await mapWithConcurrency(items, async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await delay(5);
        active -= 1;
      });

      // 30 items with delay would all run at once if unbounded; the default caps it at 5.
      expect(maxActive).to.equal(5);
    });

    it('treats concurrency < 1 as 1 (sequential)', async () => {
      let active = 0;
      let maxActive = 0;

      await mapWithConcurrency(
        [1, 2, 3],
        async () => {
          active += 1;
          maxActive = Math.max(maxActive, active);
          await delay(5);
          active -= 1;
        },
        0,
      );

      expect(maxActive).to.equal(1);
    });

    it('propagates the first rejection', async () => {
      let rejected = false;
      try {
        await mapWithConcurrency(
          [1, 2, 3],
          async (n) => {
            if (n === 2) {
              throw new Error('boom');
            }
            return n;
          },
          2,
        );
      } catch (error) {
        rejected = true;
        expect(error.message).to.equal('boom');
      }
      expect(rejected).to.be.true;
    });
  });
});
