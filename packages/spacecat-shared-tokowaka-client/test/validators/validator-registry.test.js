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

/* eslint-disable max-classes-per-file */

import { expect, use } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import ValidatorRegistry from '../../src/validators/validator-registry.js';
import BaseValidator from '../../src/validators/base-validator.js';
import { ROUTING_VALIDATOR_TYPE } from '../../src/validators/routing-validator.js';

use(sinonChai);

describe('ValidatorRegistry', () => {
  let registry;
  let log;

  beforeEach(() => {
    log = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };

    registry = new ValidatorRegistry(log);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('creates an instance and registers default validators', () => {
      expect(registry).to.be.instanceOf(ValidatorRegistry);
      expect(registry.validators).to.be.instanceOf(Map);
      expect(registry.hasValidator(ROUTING_VALIDATOR_TYPE)).to.be.true;
    });
  });

  describe('registerValidator', () => {
    it('registers a custom validator', () => {
      class CustomValidator extends BaseValidator {
        // eslint-disable-next-line class-methods-use-this
        getType() {
          return 'custom';
        }

        // eslint-disable-next-line class-methods-use-this
        async validate() {
          return { outcome: 'true' };
        }
      }

      registry.registerValidator(new CustomValidator(log));

      expect(registry.hasValidator('custom')).to.be.true;
      expect(log.info).to.have.been.calledWith('Registered validator for type: custom');
    });

    it('logs a debug message when overriding an existing type', () => {
      class OverrideValidator extends BaseValidator {
        // eslint-disable-next-line class-methods-use-this
        getType() {
          return ROUTING_VALIDATOR_TYPE;
        }

        // eslint-disable-next-line class-methods-use-this
        async validate() {
          return { outcome: 'true' };
        }
      }

      registry.registerValidator(new OverrideValidator(log));

      expect(log.debug).to.have.been.calledWith(
        `Validator for type "${ROUTING_VALIDATOR_TYPE}" is being overridden`,
      );
    });
  });

  describe('getValidator', () => {
    it('returns the registered validator for a known type', () => {
      const validator = registry.getValidator(ROUTING_VALIDATOR_TYPE);
      expect(validator).to.be.instanceOf(BaseValidator);
      expect(validator.getType()).to.equal(ROUTING_VALIDATOR_TYPE);
    });

    it('returns null and logs a warning for an unknown type', () => {
      const validator = registry.getValidator('unknown-type');
      expect(validator).to.be.null;
      expect(log.warn).to.have.been.calledWith('No validator found for type: unknown-type');
    });
  });

  describe('hasValidator', () => {
    it('returns false for an unregistered type', () => {
      expect(registry.hasValidator('nope')).to.be.false;
    });
  });

  describe('getSupportedTypes', () => {
    it('returns all registered types', () => {
      expect(registry.getSupportedTypes()).to.deep.equal([ROUTING_VALIDATOR_TYPE]);
    });
  });
});
