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

import fixEntitySchema from '../../../../src/models/fix-entity/fix-entity.schema.js';

describe('FixEntity Schema', () => {
  describe('executedAt attribute validation', () => {
    it('should validate valid ISO date', () => {
      const attributes = fixEntitySchema.getAttributes();
      const executedAtAttr = attributes.executedAt;
      expect(executedAtAttr.validate('2024-01-01T00:00:00.000Z')).to.be.true;
    });

    it('should validate null value', () => {
      const attributes = fixEntitySchema.getAttributes();
      const executedAtAttr = attributes.executedAt;
      expect(executedAtAttr.validate(null)).to.be.true;
    });

    it('should validate undefined value', () => {
      const attributes = fixEntitySchema.getAttributes();
      const executedAtAttr = attributes.executedAt;
      expect(executedAtAttr.validate(undefined)).to.be.true;
    });

    it('should reject invalid date format', () => {
      const attributes = fixEntitySchema.getAttributes();
      const executedAtAttr = attributes.executedAt;
      expect(executedAtAttr.validate('2024-13-01')).to.be.false;
    });
  });

  describe('publishedAt attribute validation', () => {
    it('should validate valid ISO date', () => {
      const attributes = fixEntitySchema.getAttributes();
      const publishedAtAttr = attributes.publishedAt;
      expect(publishedAtAttr.validate('2024-01-01T00:00:00.000Z')).to.be.true;
    });

    it('should validate null value', () => {
      const attributes = fixEntitySchema.getAttributes();
      const publishedAtAttr = attributes.publishedAt;
      expect(publishedAtAttr.validate(null)).to.be.true;
    });

    it('should validate undefined value', () => {
      const attributes = fixEntitySchema.getAttributes();
      const publishedAtAttr = attributes.publishedAt;
      expect(publishedAtAttr.validate(undefined)).to.be.true;
    });

    it('should reject invalid date format', () => {
      const attributes = fixEntitySchema.getAttributes();
      const publishedAtAttr = attributes.publishedAt;
      expect(publishedAtAttr.validate('2024-13-01')).to.be.false;
    });
  });

  describe('changeDetails attribute validation', () => {
    it('should validate valid non-empty object', () => {
      const attributes = fixEntitySchema.getAttributes();
      const changeDetailsAttr = attributes.changeDetails;
      expect(changeDetailsAttr.validate({ key: 'value', nested: { prop: 'test' } })).to.be.true;
    });

    it('should reject empty object', () => {
      const attributes = fixEntitySchema.getAttributes();
      const changeDetailsAttr = attributes.changeDetails;
      expect(changeDetailsAttr.validate({})).to.be.false;
    });

    it('should reject null value', () => {
      const attributes = fixEntitySchema.getAttributes();
      const changeDetailsAttr = attributes.changeDetails;
      expect(changeDetailsAttr.validate(null)).to.be.false;
    });

    it('should reject non-object values', () => {
      const attributes = fixEntitySchema.getAttributes();
      const changeDetailsAttr = attributes.changeDetails;
      expect(changeDetailsAttr.validate('string')).to.be.false;
      expect(changeDetailsAttr.validate(123)).to.be.false;
      expect(changeDetailsAttr.validate([])).to.be.false;
    });
  });
});
