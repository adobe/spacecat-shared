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

import { parseLocale } from '../../src/locale-detect/utils.js';

describe('Language Detection Utils', () => {
  it('parses a language', () => {
    const result = parseLocale('en');
    expect(result).to.deep.equal({ language: 'en' });
  });

  it('parses a BCP-47 language tag using underscore', () => {
    const result = parseLocale('fr_CA');
    expect(result).to.deep.equal({ language: 'fr', region: 'CA' });
  });

  it('parses a BCP-47 language tag using dash', () => {
    const result = parseLocale('fr-CH');
    expect(result).to.deep.equal({ language: 'fr', region: 'CH' });
  });

  it('returns null for an invalid language', () => {
    const result = parseLocale('xx-CH');
    expect(result).to.deep.equal({ region: 'CH' });
  });

  it('returns null for an invalid region', () => {
    const result = parseLocale('en-XX');
    expect(result).to.deep.equal({ language: 'en' });
  });

  it('returns null if both language and region are invalid', () => {
    const result = parseLocale('invalid');
    expect(result).to.equal(null);
  });
});
