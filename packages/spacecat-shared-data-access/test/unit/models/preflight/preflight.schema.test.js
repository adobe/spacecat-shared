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

  // ElectroDB's `map` type requires a `properties` schema. Declaring a Map
  // attribute without `properties` (as the original Preflight schema did for
  // `createdBy`) throws `InvalidAttributeDefinition` at `new Service(...)`
  // time, which silently breaks any downstream test or runtime path that
  // instantiates the full entity registry via electrodb's v1 Service
  // constructor (e.g. spacecat-api-service `fixes.test.js`). The `validate`
  // function already enforces the precise shape, so `any` is the minimal
  // correct type here.
  describe('attribute types (regression guard for ElectroDB Service construction)', () => {
    it('declares createdBy as type "any" (not "map") so Service construction succeeds', () => {
      expect(attributes.createdBy.type).to.equal('any');
    });
  });

  // SITES-47254: startedAt / result / error live on async_jobs only — fetched
  // via getAsyncJob() when needed. The Preflight schema must not re-declare
  // them as attributes (else PostgREST select=* would 400 against the new
  // table shape, and auto-generated getters would shadow the AsyncJob source
  // of truth).
  describe('attribute surface (regression guard for SITES-47254)', () => {
    it('does not declare a startedAt attribute', () => {
      expect(attributes).to.not.have.property('startedAt');
    });

    it('does not declare a result attribute', () => {
      expect(attributes).to.not.have.property('result');
    });

    it('does not declare an error attribute', () => {
      expect(attributes).to.not.have.property('error');
    });
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
