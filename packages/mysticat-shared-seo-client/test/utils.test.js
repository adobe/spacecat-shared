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

/* eslint-env mocha */

import { expect } from 'chai';

import { buildQueryParams, parseResponse } from '../src/utils.js';

describe('utils', () => {
  describe('buildQueryParams', () => {
    it('merges defaults with overrides', () => {
      const defaults = { a: 1, b: 2 };
      const overrides = { b: 3, c: 4 };
      const result = buildQueryParams(defaults, overrides);
      expect(result).to.deep.equal({ a: 1, b: 3, c: 4 });
    });

    it('returns defaults when no overrides given', () => {
      const defaults = { a: 1 };
      const result = buildQueryParams(defaults, {});
      expect(result).to.deep.equal({ a: 1 });
    });

    it('returns overrides when no defaults given', () => {
      const overrides = { c: 4 };
      const result = buildQueryParams({}, overrides);
      expect(result).to.deep.equal({ c: 4 });
    });
  });

  describe('parseResponse', () => {
    it('passes through the input unchanged', () => {
      const input = { metrics: [1, 2, 3] };
      const result = parseResponse(input);
      expect(result).to.equal(input);
    });

    it('handles null input', () => {
      expect(parseResponse(null)).to.equal(null);
    });

    it('handles undefined input', () => {
      expect(parseResponse(undefined)).to.equal(undefined);
    });
  });
});
