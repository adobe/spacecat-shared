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
  FIX_ENTITY_TRANSITIONS,
  FIX_ENTITY_CREATE,
  isAllowedFixTransition,
} from '../../../../src/models/fix-entity/fix-entity.transitions.js';
import FixEntity from '../../../../src/models/fix-entity/fix-entity.model.js';

describe('FixEntity transitions', () => {
  const legal = [
    [undefined, 'PENDING'],
    [null, 'DEPLOYED'],
    [undefined, 'FAILED'],
    ['PENDING', 'DEPLOYED'],
    ['PENDING', 'FAILED'],
    ['DEPLOYED', 'PUBLISHED'],
    ['DEPLOYED', 'ROLLED_BACK'],
    ['FAILED', 'PENDING'],
    ['PUBLISHED', 'ROLLED_BACK'],
  ];

  const illegal = [
    ['PENDING', 'PUBLISHED'],
    ['DEPLOYED', 'PENDING'],
    ['FAILED', 'DEPLOYED'],
    ['ROLLED_BACK', 'PENDING'], // terminal
    ['PUBLISHED', 'DEPLOYED'],
    [undefined, 'PUBLISHED'], // cannot create directly as PUBLISHED
    ['PENDING', 'BOGUS'],
  ];

  legal.forEach(([from, to]) => {
    it(`allows ${from ?? '<create>'} -> ${to}`, () => {
      expect(isAllowedFixTransition(from, to)).to.equal(true);
    });
  });

  illegal.forEach(([from, to]) => {
    it(`rejects ${from ?? '<create>'} -> ${to}`, () => {
      expect(isAllowedFixTransition(from, to)).to.equal(false);
    });
  });

  it('exposes the create case under the FIX_ENTITY_CREATE symbol', () => {
    expect(FIX_ENTITY_TRANSITIONS[FIX_ENTITY_CREATE]).to.deep.equal(['PENDING', 'DEPLOYED', 'FAILED']);
  });

  it('treats ROLLED_BACK as terminal (no outgoing transitions)', () => {
    expect(FIX_ENTITY_TRANSITIONS.ROLLED_BACK).to.deep.equal([]);
  });

  it('returns false for an unknown current status', () => {
    expect(isAllowedFixTransition('NOPE', 'PENDING')).to.equal(false);
  });

  // Drift guard: the table duplicates the status literals to avoid a circular
  // import, so assert every real FixEntity.STATUSES value has a row. Fails at CI
  // time if the enum grows without a matching transition entry.
  it('has a transition row for every FixEntity.STATUSES value', () => {
    Object.values(FixEntity.STATUSES).forEach((status) => {
      expect(FIX_ENTITY_TRANSITIONS).to.have.property(status);
    });
  });
});
