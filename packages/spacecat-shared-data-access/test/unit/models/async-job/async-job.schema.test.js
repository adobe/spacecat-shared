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
import asyncJobSchema from '../../../../src/models/async-job/async-job.schema.js';

describe('AsyncJob Schema', () => {
  describe('expiresAt attribute (SITES-47947)', () => {
    const attr = () => asyncJobSchema.getAttributes().expiresAt;

    it('is a read-only ISO-timestamp attribute, deliberately not required', () => {
      const a = attr();
      expect(a).to.exist;
      expect(a.readOnly).to.be.true;
      // NOT required: legacy rows created before this shipped have expires_at =
      // NULL until the one-time backfill, and a required attribute would fail
      // validation when such a row is saved (e.g. a status update) beforehand.
      expect(a.required).to.not.equal(true);
      expect(a.default).to.be.a('function');
      expect(a.validate).to.be.a('function');
    });

    it('defaults to ~7 days from now as an ISO string', () => {
      const value = attr().default();
      expect(value).to.be.a('string');
      const deltaMs = new Date(value).getTime() - (Date.now() + 7 * 24 * 60 * 60 * 1000);
      // within a minute of now + 7 days
      expect(Math.abs(deltaMs)).to.be.lessThan(60 * 1000);
    });

    it('validates ISO dates and treats empty/undefined as valid (optional)', () => {
      const a = attr();
      expect(a.validate('2025-01-08T00:00:00.000Z')).to.be.true;
      expect(a.validate('')).to.be.true;
      expect(a.validate(undefined)).to.be.true;
    });

    it('rejects a non-ISO string', () => {
      expect(attr().validate('not-a-date')).to.be.false;
    });
  });
});
