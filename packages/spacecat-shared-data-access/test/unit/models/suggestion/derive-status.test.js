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

import { deriveSuggestionStatus, classifyStatus } from '../../../../src/models/suggestion/derive-status.js';

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

    it('ignores null/undefined entries and derives from the valid ones', () => {
      expect(deriveSuggestionStatus([{ status: 'DEPLOYED' }, null])).to.equal('FIXED');
      expect(deriveSuggestionStatus([undefined, { status: 'FAILED' }])).to.equal('ERROR');
    });

    it('returns null when every entry is null/undefined or lacks a status', () => {
      expect(deriveSuggestionStatus([null, undefined])).to.equal(null);
      expect(deriveSuggestionStatus([{}])).to.equal(null);
    });

    it('falls back to currentStatus when nothing is derivable (sandsinh review)', () => {
      expect(deriveSuggestionStatus([], [], 'IN_PROGRESS')).to.equal('IN_PROGRESS');
      expect(deriveSuggestionStatus(['WAT'], [], 'FIXED')).to.equal('FIXED');
      expect(deriveSuggestionStatus([null], [], 'ERROR')).to.equal('ERROR');
    });

    it('prefers a derived status over currentStatus when fixes yield one', () => {
      expect(deriveSuggestionStatus([{ status: 'DEPLOYED' }], [], 'NEW')).to.equal('FIXED');
    });

    it('throws if a non-empty issues array is passed (CWV deferred)', () => {
      expect(() => deriveSuggestionStatus(['DEPLOYED'], [{ id: 'i1' }]))
        .to.throw(/CWV multi-issue bubble-up is not yet implemented/);
    });

    it('ignores an empty issues array', () => {
      expect(deriveSuggestionStatus(['DEPLOYED'], [])).to.equal('FIXED');
    });
  });

  describe('explicit outcome tokens + mixed vocabulary (SITES-47285)', () => {
    it("maps an explicit 'SKIPPED' outcome to SKIPPED", () => {
      expect(deriveSuggestionStatus(['SKIPPED'])).to.equal('SKIPPED');
    });

    it("maps an explicit 'ERROR' outcome to ERROR", () => {
      expect(deriveSuggestionStatus(['ERROR'])).to.equal('ERROR');
    });

    it("resolves an all-NEUTRAL signal set (e.g. only 'NEW') to NEW", () => {
      expect(deriveSuggestionStatus(['NEW'])).to.equal('NEW');
      expect(deriveSuggestionStatus(['NEW', 'OUTDATED'])).to.equal('NEW');
    });

    it('collapses mixed fix + suggestion vocab by severity', () => {
      expect(deriveSuggestionStatus([{ status: 'DEPLOYED' }, 'ERROR'])).to.equal('ERROR');
      expect(deriveSuggestionStatus([{ status: 'DEPLOYED' }, 'SKIPPED'])).to.equal('FIXED');
      expect(deriveSuggestionStatus(['SKIPPED', 'NEW'])).to.equal('SKIPPED');
    });

    it('distinguishes empty (=> currentStatus) from all-neutral (=> NEW)', () => {
      expect(deriveSuggestionStatus([], [], 'IN_PROGRESS')).to.equal('IN_PROGRESS');
      expect(deriveSuggestionStatus(['NEW'], [], 'IN_PROGRESS')).to.equal('NEW');
    });
  });

  describe('classifyStatus', () => {
    it('classifies both fix and suggestion vocabularies', () => {
      expect(classifyStatus('FAILED')).to.equal('ERROR');
      expect(classifyStatus('ERROR')).to.equal('ERROR');
      expect(classifyStatus('PENDING')).to.equal('IN_PROGRESS');
      expect(classifyStatus('IN_PROGRESS')).to.equal('IN_PROGRESS');
      expect(classifyStatus('DEPLOYED')).to.equal('FIXED');
      expect(classifyStatus('PUBLISHED')).to.equal('FIXED');
      expect(classifyStatus('FIXED')).to.equal('FIXED');
      expect(classifyStatus('ROLLED_BACK')).to.equal('SKIPPED');
      expect(classifyStatus('REJECTED')).to.equal('SKIPPED');
      expect(classifyStatus('SKIPPED')).to.equal('SKIPPED');
      expect(classifyStatus('NEW')).to.equal('NEUTRAL');
      expect(classifyStatus('OUTDATED')).to.equal('NEUTRAL');
    });

    it('returns null for unknown or nullish tokens', () => {
      expect(classifyStatus('WAT')).to.equal(null);
      expect(classifyStatus(undefined)).to.equal(null);
      expect(classifyStatus(null)).to.equal(null);
    });

    it('returns null for Object.prototype keys (own-property lookup only)', () => {
      expect(classifyStatus('constructor')).to.equal(null);
      expect(classifyStatus('toString')).to.equal(null);
      expect(deriveSuggestionStatus(['constructor'], [], 'FIXED')).to.equal('FIXED');
    });
  });
});
