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
import preflightSchema from '../../../../src/models/preflight/preflight.schema.js';

describe('Preflight Schema', () => {
  let attributes;

  before(() => {
    attributes = preflightSchema.getAttributes();
  });

  describe('createdBy attribute', () => {
    it('accepts a valid object with email and displayName', () => {
      expect(attributes.createdBy.validate({ email: 'user@example.com', displayName: 'User' })).to.be.true;
    });

    it('accepts a valid object with email only', () => {
      expect(attributes.createdBy.validate({ email: 'user@example.com' })).to.be.true;
    });

    it('rejects null (required field must not bypass validation)', () => {
      expect(attributes.createdBy.validate(null)).to.be.false;
    });

    it('rejects undefined', () => {
      expect(attributes.createdBy.validate(undefined)).to.be.false;
    });

    it('rejects an object with empty email', () => {
      expect(attributes.createdBy.validate({ email: '' })).to.be.false;
    });

    it('rejects an object with non-string email', () => {
      expect(attributes.createdBy.validate({ email: 12345 })).to.be.false;
    });

    it('rejects a non-object value', () => {
      expect(attributes.createdBy.validate('user@example.com')).to.be.false;
    });
  });

  describe('error attribute', () => {
    it('accepts null (error is optional)', () => {
      expect(attributes.error.validate(null)).to.be.true;
    });

    it('accepts undefined (error is optional)', () => {
      expect(attributes.error.validate(undefined)).to.be.true;
    });

    it('accepts a valid object with code and message', () => {
      expect(attributes.error.validate({ code: 'ERR_TIMEOUT', message: 'Scan timed out' })).to.be.true;
    });

    it('rejects an object with empty code', () => {
      expect(attributes.error.validate({ code: '', message: 'Scan timed out' })).to.be.false;
    });

    it('rejects an object with empty message', () => {
      expect(attributes.error.validate({ code: 'ERR_TIMEOUT', message: '' })).to.be.false;
    });

    it('rejects an object with non-string code', () => {
      expect(attributes.error.validate({ code: 0, message: 'Scan timed out' })).to.be.false;
    });

    it('rejects an object with non-string message', () => {
      expect(attributes.error.validate({ code: 'ERR_TIMEOUT', message: 42 })).to.be.false;
    });

    it('rejects a non-object value', () => {
      expect(attributes.error.validate('ERR_TIMEOUT')).to.be.false;
    });
  });

  describe('url attribute', () => {
    it('accepts a valid URL within the 2048-char limit', () => {
      expect(attributes.url.validate('https://www.example.com/page')).to.be.true;
    });

    it('rejects a URL exceeding 2048 characters', () => {
      const longUrl = `https://www.example.com/${'a'.repeat(2040)}`;
      expect(attributes.url.validate(longUrl)).to.be.false;
    });

    it('rejects an invalid URL', () => {
      expect(attributes.url.validate('not-a-url')).to.be.false;
    });
  });
});
