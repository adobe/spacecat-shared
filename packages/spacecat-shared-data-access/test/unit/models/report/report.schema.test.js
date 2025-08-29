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
import reportSchema from '../../../../src/models/report/report.schema.js';

describe('Report Schema', () => {
  describe('storagePath attribute', () => {
    it('should have storagePath as optional with default empty string', () => {
      const attributes = reportSchema.getAttributes();
      const storagePathAttr = attributes.storagePath;

      expect(storagePathAttr).to.exist;
      expect(storagePathAttr.required).to.be.false;
      expect(storagePathAttr.default).to.be.a('function');
      expect(storagePathAttr.validate).to.be.a('function');
    });

    it('should validate empty string as valid', () => {
      const attributes = reportSchema.getAttributes();
      const storagePathAttr = attributes.storagePath;

      expect(storagePathAttr.validate('')).to.be.true;
    });

    it('should validate non-empty string as valid', () => {
      const attributes = reportSchema.getAttributes();
      const storagePathAttr = attributes.storagePath;

      expect(storagePathAttr.validate('/some/path/')).to.be.true;
      expect(storagePathAttr.validate('relative/path')).to.be.true;
    });

    it('should validate undefined as valid (optional)', () => {
      const attributes = reportSchema.getAttributes();
      const storagePathAttr = attributes.storagePath;

      expect(storagePathAttr.validate(undefined)).to.be.true;
    });

    it('should validate null as valid (optional)', () => {
      const attributes = reportSchema.getAttributes();
      const storagePathAttr = attributes.storagePath;

      expect(storagePathAttr.validate(null)).to.be.true;
    });

    it('should reject non-string values', () => {
      const attributes = reportSchema.getAttributes();
      const storagePathAttr = attributes.storagePath;

      expect(storagePathAttr.validate(123)).to.be.false;
      expect(storagePathAttr.validate({})).to.be.false;
      expect(storagePathAttr.validate([])).to.be.false;
      expect(storagePathAttr.validate(true)).to.be.false;
    });

    it('should return empty string as default', () => {
      const attributes = reportSchema.getAttributes();
      const storagePathAttr = attributes.storagePath;

      expect(storagePathAttr.default()).to.equal('');
    });
  });

  describe('status attribute', () => {
    it('should have status as required with default processing', () => {
      const attributes = reportSchema.getAttributes();
      const statusAttr = attributes.status;

      expect(statusAttr).to.exist;
      expect(statusAttr.required).to.be.true;
      expect(statusAttr.default).to.equal('processing');
      expect(statusAttr.type).to.deep.equal(['processing', 'success', 'failed']);
    });

    it('should validate processing as valid', () => {
      const attributes = reportSchema.getAttributes();
      const statusAttr = attributes.status;

      // For enum types, validation is handled by ElectroDB internally
      expect(statusAttr.type).to.include('processing');
    });

    it('should validate success as valid', () => {
      const attributes = reportSchema.getAttributes();
      const statusAttr = attributes.status;

      expect(statusAttr.type).to.include('success');
    });

    it('should validate failed as valid', () => {
      const attributes = reportSchema.getAttributes();
      const statusAttr = attributes.status;

      expect(statusAttr.type).to.include('failed');
    });

    it('should not include invalid status values', () => {
      const attributes = reportSchema.getAttributes();
      const statusAttr = attributes.status;

      expect(statusAttr.type).to.not.include('invalid');
      expect(statusAttr.type).to.not.include('pending');
      expect(statusAttr.type).to.not.include('completed');
    });
  });
});
