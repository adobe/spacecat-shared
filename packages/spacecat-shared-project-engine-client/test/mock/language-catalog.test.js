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

import { expect } from 'chai';
import { LANGUAGE_CATALOG, isoForLanguageId, CATALOG_CAPTURED } from '../../mock/language-catalog.js';

const ENGLISH_ID = '5a0a33ed-7f5c-4901-befd-a042c0350da1';

describe('language-catalog — the canonical id ↔ name ↔ iso catalog', () => {
  it('is the full live taxonomy (38 entries), each with id + English name + iso', () => {
    expect(LANGUAGE_CATALOG).to.be.an('array').with.length(38);
    for (const entry of LANGUAGE_CATALOG) {
      expect(entry.id).to.match(/^[0-9a-f-]{36}$/);
      expect(entry.name).to.be.a('string').with.length.greaterThan(0);
      expect(entry.iso).to.be.a('string').with.length.greaterThan(0);
    }
    // English is the live-verified read-view value.
    expect(LANGUAGE_CATALOG).to.deep.include({ id: ENGLISH_ID, name: 'English', iso: 'en' });
  });

  it('ids are unique (a faithful reverse index needs no collisions)', () => {
    const ids = LANGUAGE_CATALOG.map((l) => l.id);
    expect(new Set(ids).size).to.equal(ids.length);
  });

  it('exposes the capture date so live-catalog drift is discoverable', () => {
    expect(CATALOG_CAPTURED).to.match(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('isoForLanguageId resolves a known catalog id to its ISO code', () => {
    expect(isoForLanguageId(ENGLISH_ID)).to.equal('en');
  });

  it('isoForLanguageId returns "" for an unknown id', () => {
    expect(isoForLanguageId('not-a-catalog-id')).to.equal('');
  });

  it('isoForLanguageId returns "" for an empty/undefined id', () => {
    expect(isoForLanguageId('')).to.equal('');
    expect(isoForLanguageId()).to.equal('');
  });
});
