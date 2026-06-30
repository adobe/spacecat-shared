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

import { deriveSuggestionStatus } from '../../../../src/models/suggestion/derive-status.js';

describe('deriveSuggestionStatus (non-CWV 1:1 bubble-up)', () => {
  it('maps a single DEPLOYED fix to FIXED', () => {
    expect(deriveSuggestionStatus([{ status: 'DEPLOYED' }])).to.equal('FIXED');
  });

  it('maps a single PUBLISHED fix to FIXED', () => {
    expect(deriveSuggestionStatus([{ status: 'PUBLISHED' }])).to.equal('FIXED');
  });

  it('maps a single PENDING fix to IN_PROGRESS', () => {
    expect(deriveSuggestionStatus([{ status: 'PENDING' }])).to.equal('IN_PROGRESS');
  });

  it('maps a single FAILED fix to ERROR', () => {
    expect(deriveSuggestionStatus([{ status: 'FAILED' }])).to.equal('ERROR');
  });

  it('maps a single ROLLED_BACK fix to SKIPPED', () => {
    expect(deriveSuggestionStatus([{ status: 'ROLLED_BACK' }])).to.equal('SKIPPED');
  });

  it('accepts FixEntity-like instances via getStatus()', () => {
    const fix = { getStatus: () => 'DEPLOYED' };
    expect(deriveSuggestionStatus([fix])).to.equal('FIXED');
  });

  it('accepts plain status strings', () => {
    expect(deriveSuggestionStatus(['FAILED'])).to.equal('ERROR');
  });

  describe('multi-fix severity collapse (ERROR > IN_PROGRESS > FIXED > SKIPPED)', () => {
    it('any FAILED wins -> ERROR', () => {
      expect(deriveSuggestionStatus(['DEPLOYED', 'FAILED', 'PENDING'])).to.equal('ERROR');
    });

    it('PENDING over FIXED -> IN_PROGRESS', () => {
      expect(deriveSuggestionStatus(['DEPLOYED', 'PENDING'])).to.equal('IN_PROGRESS');
    });

    it('at least one DEPLOYED/PUBLISHED (no failure/pending) -> FIXED', () => {
      expect(deriveSuggestionStatus(['DEPLOYED', 'ROLLED_BACK'])).to.equal('FIXED');
    });

    it('all ROLLED_BACK -> SKIPPED', () => {
      expect(deriveSuggestionStatus(['ROLLED_BACK', 'ROLLED_BACK'])).to.equal('SKIPPED');
    });
  });

  describe('edge cases', () => {
    it('returns null for no fixes', () => {
      expect(deriveSuggestionStatus([])).to.equal(null);
    });

    it('returns null for a non-array', () => {
      expect(deriveSuggestionStatus(undefined)).to.equal(null);
    });

    it('returns null when no rule matches (e.g. unknown status)', () => {
      expect(deriveSuggestionStatus(['WAT'])).to.equal(null);
    });

    it('throws if a non-empty issues array is passed (CWV deferred)', () => {
      expect(() => deriveSuggestionStatus(['DEPLOYED'], [{ id: 'i1' }]))
        .to.throw(/CWV multi-issue bubble-up is not yet implemented/);
    });

    it('ignores an empty issues array', () => {
      expect(deriveSuggestionStatus(['DEPLOYED'], [])).to.equal('FIXED');
    });
  });
});
