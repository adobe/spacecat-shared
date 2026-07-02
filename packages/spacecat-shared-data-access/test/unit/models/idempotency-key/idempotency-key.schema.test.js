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

import { expect } from 'chai';
import idempotencyKeySchema from '../../../../src/models/idempotency-key/idempotency-key.schema.js';
import IdempotencyKey from '../../../../src/models/idempotency-key/idempotency-key.model.js';

describe('IdempotencyKey Schema', () => {
  let attributes;

  before(() => {
    attributes = idempotencyKeySchema.getAttributes();
  });

  describe('key attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.key.required).to.be.true;
      expect(attributes.key.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.key.type).to.equal('string');
    });
  });

  describe('endpoint attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.endpoint.required).to.be.true;
      expect(attributes.endpoint.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.endpoint.type).to.equal('string');
    });
  });

  describe('status attribute', () => {
    it('is required', () => {
      expect(attributes.status.required).to.be.true;
    });

    it('defaults to processing', () => {
      expect(attributes.status.default).to.equal(IdempotencyKey.STATUSES.PROCESSING);
    });

    it('accepts valid status values', () => {
      expect(attributes.status.type).to.include('processing');
      expect(attributes.status.type).to.include('completed');
      expect(attributes.status.type).to.include('failed');
    });
  });

  describe('response attribute', () => {
    it('is optional', () => {
      expect(attributes.response.required).to.be.false;
    });

    it('is of type any', () => {
      expect(attributes.response.type).to.equal('any');
    });
  });

  describe('expiresAt attribute', () => {
    it('is required', () => {
      expect(attributes.expiresAt.required).to.be.true;
    });

    it('is readOnly (expiry must not be extended post-creation)', () => {
      expect(attributes.expiresAt.readOnly).to.be.true;
    });

    it('validates ISO date strings', () => {
      expect(attributes.expiresAt.validate('2026-01-01T00:00:00.000Z')).to.be.true;
    });

    it('rejects non-ISO strings', () => {
      expect(attributes.expiresAt.validate('not-a-date')).to.be.false;
    });
  });

  describe('updatedBy attribute', () => {
    it('is suppressed via postgrestIgnore', () => {
      expect(attributes.updatedBy.postgrestIgnore).to.be.true;
    });
  });
});
