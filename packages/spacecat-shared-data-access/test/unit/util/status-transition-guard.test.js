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

import { expect, use as chaiUse } from 'chai';
import sinonChai from 'sinon-chai';
import { spy } from 'sinon';

import {
  ENFORCEMENT_MODES,
  getEnforcementMode,
  guardTransition,
} from '../../../src/util/status-transition-guard.js';
import { ValidationError } from '../../../src/errors/index.js';

chaiUse(sinonChai);

// permit only A -> B for these tests
const isAllowed = (from, to) => from === 'A' && to === 'B';

describe('status-transition-guard', () => {
  const original = process.env.STATUS_TRANSITION_ENFORCEMENT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.STATUS_TRANSITION_ENFORCEMENT;
    } else {
      process.env.STATUS_TRANSITION_ENFORCEMENT = original;
    }
  });

  describe('getEnforcementMode', () => {
    it('defaults to warn when unset', () => {
      delete process.env.STATUS_TRANSITION_ENFORCEMENT;
      expect(getEnforcementMode()).to.equal(ENFORCEMENT_MODES.WARN);
    });

    it('defaults to warn for an unrecognized value', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'banana';
      expect(getEnforcementMode()).to.equal(ENFORCEMENT_MODES.WARN);
    });

    it('reads enforce (case-insensitive, trimmed)', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = '  ENFORCE ';
      expect(getEnforcementMode()).to.equal(ENFORCEMENT_MODES.ENFORCE);
    });

    it('reads off', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'off';
      expect(getEnforcementMode()).to.equal(ENFORCEMENT_MODES.OFF);
    });
  });

  describe('guardTransition', () => {
    const base = {
      entityName: 'FixEntity', entityId: 'id-1', isAllowed,
    };

    it('passes silently on an allowed transition', () => {
      const log = { warn: spy() };
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'enforce';
      expect(() => guardTransition({
        ...base, from: 'A', to: 'B', log,
      })).to.not.throw();
      expect(log.warn).to.not.have.been.called;
    });

    it('treats a no-op (from === to) as allowed', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'enforce';
      expect(() => guardTransition({
        ...base, from: 'X', to: 'X', isAllowed: () => false,
      })).to.not.throw();
    });

    it('warns but does not throw in warn mode', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'warn';
      const log = { warn: spy() };
      guardTransition({
        ...base, from: 'A', to: 'C', log,
      });
      expect(log.warn).to.have.been.calledOnce;
      expect(log.warn.firstCall.args[0]).to.contain('FixEntity id-1 A -> C');
    });

    it('tolerates a missing logger in warn mode', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'warn';
      expect(() => guardTransition({ ...base, from: 'A', to: 'C' })).to.not.throw();
    });

    it('renders <create> and <unknown> placeholders', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'warn';
      const log = { warn: spy() };
      guardTransition({
        entityName: 'Suggestion', isAllowed, from: undefined, to: 'C', log,
      });
      expect(log.warn.firstCall.args[0]).to.contain('Suggestion <unknown> <create> -> C');
    });

    it('throws ValidationError in enforce mode', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'enforce';
      expect(() => guardTransition({
        ...base, from: 'A', to: 'C',
      })).to.throw(ValidationError, 'FixEntity id-1 A -> C');
    });

    it('does nothing in off mode', () => {
      process.env.STATUS_TRANSITION_ENFORCEMENT = 'off';
      const log = { warn: spy() };
      expect(() => guardTransition({
        ...base, from: 'A', to: 'C', log,
      })).to.not.throw();
      expect(log.warn).to.not.have.been.called;
    });
  });
});
