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

import {
  SUGGESTION_TRANSITIONS,
  SUGGESTION_CREATE,
  isAllowedSuggestionTransition,
} from '../../../../src/models/suggestion/suggestion.transitions.js';
import Suggestion from '../../../../src/models/suggestion/suggestion.model.js';

describe('Suggestion transitions', () => {
  const legal = [
    [undefined, 'NEW'],
    [null, 'PENDING_VALIDATION'],
    ['NEW', 'IN_PROGRESS'],
    ['NEW', 'FIXED'],
    ['NEW', 'ERROR'],
    ['PENDING_VALIDATION', 'NEW'],
    ['PENDING_VALIDATION', 'IN_PROGRESS'], // api-service autofixSuggestions path
    ['PENDING_VALIDATION', 'REJECTED'], // the one hard rule preserved from api-service
    ['IN_PROGRESS', 'FIXED'],
    ['IN_PROGRESS', 'NEW'], // bubble-up: all issues NEUTRAL
    ['FIXED', 'NEW'], // re-detection reopens
    ['ERROR', 'IN_PROGRESS'], // retry
    ['SKIPPED', 'NEW'], // un-skip
    ['OUTDATED', 'NEW'],
    ['REJECTED', 'NEW'], // reopen after incorrect classification (sandsinh review)
  ];

  const illegal = [
    ['NEW', 'REJECTED'], // REJECTED only from PENDING_VALIDATION
    ['FIXED', 'REJECTED'],
    ['REJECTED', 'FIXED'], // reopen only to NEW, not straight to a terminal outcome
    ['SKIPPED', 'FIXED'],
    [undefined, 'FIXED'], // cannot create as FIXED
    ['NEW', 'BOGUS'],
  ];

  legal.forEach(([from, to]) => {
    it(`allows ${from ?? '<create>'} -> ${to}`, () => {
      expect(isAllowedSuggestionTransition(from, to)).to.equal(true);
    });
  });

  illegal.forEach(([from, to]) => {
    it(`rejects ${from ?? '<create>'} -> ${to}`, () => {
      expect(isAllowedSuggestionTransition(from, to)).to.equal(false);
    });
  });

  it('exposes the create case under the SUGGESTION_CREATE symbol', () => {
    expect(SUGGESTION_TRANSITIONS[SUGGESTION_CREATE]).to.deep.equal(['NEW', 'PENDING_VALIDATION', 'OUTDATED']);
  });

  it('returns false for an unknown current status', () => {
    expect(isAllowedSuggestionTransition('NOPE', 'NEW')).to.equal(false);
  });

  // Drift guard: the table duplicates the status literals to avoid a circular
  // import, so assert every real Suggestion.STATUSES value has a row. Fails at CI
  // time if the enum grows without a matching transition entry.
  it('has a transition row for every Suggestion.STATUSES value', () => {
    Object.values(Suggestion.STATUSES).forEach((status) => {
      expect(SUGGESTION_TRANSITIONS).to.have.property(status);
    });
  });
});
