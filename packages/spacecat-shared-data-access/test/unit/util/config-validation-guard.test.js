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

import { expect, use as chaiUse } from 'chai';
import sinonChai from 'sinon-chai';
import { spy } from 'sinon';

import {
  ENFORCEMENT_MODES,
  getConfigEnforcementMode,
  guardConfigValidation,
} from '../../../src/util/config-validation-guard.js';
import { ValidationError } from '../../../src/errors/index.js';

chaiUse(sinonChai);

const validate = (value) => {
  if (value?.invalid) {
    throw new Error('boom: invalid config');
  }
};

describe('config-validation-guard', () => {
  const original = process.env.CONFIG_VALIDATION_ENFORCEMENT;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.CONFIG_VALIDATION_ENFORCEMENT;
    } else {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = original;
    }
  });

  describe('getConfigEnforcementMode', () => {
    it('defaults to warn when unset', () => {
      delete process.env.CONFIG_VALIDATION_ENFORCEMENT;
      expect(getConfigEnforcementMode()).to.equal(ENFORCEMENT_MODES.WARN);
    });

    it('defaults to warn for an unrecognized value', () => {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = 'banana';
      expect(getConfigEnforcementMode()).to.equal(ENFORCEMENT_MODES.WARN);
    });

    it('reads enforce (case-insensitive, trimmed)', () => {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = '  ENFORCE ';
      expect(getConfigEnforcementMode()).to.equal(ENFORCEMENT_MODES.ENFORCE);
    });

    it('reads off', () => {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = 'off';
      expect(getConfigEnforcementMode()).to.equal(ENFORCEMENT_MODES.OFF);
    });
  });

  describe('guardConfigValidation', () => {
    const base = { entityName: 'Site', entityId: 'id-1', validate };

    it('passes silently on a valid config', () => {
      const log = { warn: spy() };
      process.env.CONFIG_VALIDATION_ENFORCEMENT = 'enforce';
      expect(() => guardConfigValidation({
        ...base, value: { invalid: false }, log,
      })).to.not.throw();
      expect(log.warn).to.not.have.been.called;
    });

    it('warns but does not throw in warn mode (default)', () => {
      delete process.env.CONFIG_VALIDATION_ENFORCEMENT;
      const log = { warn: spy() };
      guardConfigValidation({
        ...base, value: { invalid: true }, log,
      });
      expect(log.warn).to.have.been.calledOnce;
      expect(log.warn.firstCall.args[0]).to.contain('Site id-1');
      expect(log.warn.firstCall.args[0]).to.contain('boom: invalid config');
    });

    it('tolerates a missing logger in warn mode', () => {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = 'warn';
      expect(() => guardConfigValidation({ ...base, value: { invalid: true } })).to.not.throw();
    });

    it('renders <unknown> placeholder when entityId is missing', () => {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = 'warn';
      const log = { warn: spy() };
      guardConfigValidation({
        entityName: 'Site', validate, value: { invalid: true }, log,
      });
      expect(log.warn.firstCall.args[0]).to.contain('Site <unknown>');
    });

    it('throws a ValidationError in enforce mode', () => {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = 'enforce';
      let thrown;
      try {
        guardConfigValidation({ ...base, value: { invalid: true } });
      } catch (e) {
        thrown = e;
      }
      expect(thrown).to.be.instanceOf(ValidationError);
      expect(thrown.message).to.equal('Invalid config for Site: boom: invalid config');
    });

    it('still logs the detailed violation in enforce mode', () => {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = 'enforce';
      const log = { warn: spy() };
      expect(() => guardConfigValidation({
        ...base, value: { invalid: true }, log,
      })).to.throw(ValidationError);
      expect(log.warn).to.have.been.calledOnce;
    });

    it('does nothing in off mode', () => {
      process.env.CONFIG_VALIDATION_ENFORCEMENT = 'off';
      const log = { warn: spy() };
      expect(() => guardConfigValidation({
        ...base, value: { invalid: true }, log,
      })).to.not.throw();
      expect(log.warn).to.not.have.been.called;
    });
  });
});
