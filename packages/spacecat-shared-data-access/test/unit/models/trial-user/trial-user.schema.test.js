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

/* eslint-env mocha */

import { expect } from 'chai';

import trialUserSchema from '../../../../src/models/trial-user/trial-user.schema.js';

describe('TrialUser Schema', () => {
  describe('lastSeenAt attribute validation', () => {
    it('should validate valid ISO date', () => {
      const attributes = trialUserSchema.getAttributes();
      const lastSeenAtAttr = attributes.lastSeenAt;
      expect(lastSeenAtAttr.validate('2024-01-01T00:00:00.000Z')).to.be.true;
    });

    it('should validate null value', () => {
      const attributes = trialUserSchema.getAttributes();
      const lastSeenAtAttr = attributes.lastSeenAt;
      expect(lastSeenAtAttr.validate(null)).to.be.true;
    });

    it('should validate undefined value', () => {
      const attributes = trialUserSchema.getAttributes();
      const lastSeenAtAttr = attributes.lastSeenAt;
      expect(lastSeenAtAttr.validate(undefined)).to.be.true;
    });

    it('should reject invalid date format', () => {
      const attributes = trialUserSchema.getAttributes();
      const lastSeenAtAttr = attributes.lastSeenAt;
      expect(lastSeenAtAttr.validate('2024-13-01')).to.be.false;
    });
  });

  describe('metadata attribute validation', () => {
    it('should validate valid object', () => {
      const attributes = trialUserSchema.getAttributes();
      const metadataAttr = attributes.metadata;
      expect(metadataAttr.validate({ key: 'value', nested: { prop: 'test' } })).to.be.true;
    });

    it('should validate null value', () => {
      const attributes = trialUserSchema.getAttributes();
      const metadataAttr = attributes.metadata;
      expect(metadataAttr.validate(null)).to.be.true;
    });

    it('should validate undefined value', () => {
      const attributes = trialUserSchema.getAttributes();
      const metadataAttr = attributes.metadata;
      expect(metadataAttr.validate(undefined)).to.be.true;
    });

    it('should reject non-object values', () => {
      const attributes = trialUserSchema.getAttributes();
      const metadataAttr = attributes.metadata;
      expect(metadataAttr.validate('string')).to.be.false;
      expect(metadataAttr.validate(123)).to.be.false;
      expect(metadataAttr.validate([])).to.be.false;
    });
  });
});
