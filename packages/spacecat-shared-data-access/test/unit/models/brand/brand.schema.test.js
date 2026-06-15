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

import Brand from '../../../../src/models/brand/brand.model.js';
import brandSchema from '../../../../src/models/brand/brand.schema.js';

describe('Brand Schema', () => {
  const attributes = brandSchema.getAttributes();

  describe('name attribute', () => {
    it('is required', () => {
      expect(attributes.name).to.exist;
      expect(attributes.name.required).to.be.true;
    });
  });

  describe('status attribute', () => {
    it('is not required and carries an enum validator', () => {
      const attr = attributes.status;
      expect(attr).to.exist;
      expect(attr.required).to.not.equal(true);
      expect(attr.validate).to.be.a('function');
    });

    it('accepts every reference_status enum value', () => {
      for (const value of Brand.STATUSES) {
        expect(attributes.status.validate(value)).to.be.true;
      }
    });

    it('accepts nullish (a targeted patch need not send status)', () => {
      expect(attributes.status.validate(null)).to.be.true;
      expect(attributes.status.validate(undefined)).to.be.true;
    });

    it('rejects an out-of-enum value', () => {
      expect(attributes.status.validate('archived')).to.be.false;
      expect(attributes.status.validate('')).to.be.false;
    });
  });

  describe('semrushWorkspaceId attribute', () => {
    it('exists with a nullable hasText validator', () => {
      const attr = attributes.semrushWorkspaceId;
      expect(attr).to.exist;
      expect(attr.required).to.not.equal(true);
      expect(attr.validate).to.be.a('function');
    });

    it('accepts a non-empty string', () => {
      expect(attributes.semrushWorkspaceId.validate('child-ws-123')).to.be.true;
    });

    it('accepts nullish (legacy/flat mode)', () => {
      expect(attributes.semrushWorkspaceId.validate(null)).to.be.true;
      expect(attributes.semrushWorkspaceId.validate(undefined)).to.be.true;
    });

    it('rejects the empty string', () => {
      expect(attributes.semrushWorkspaceId.validate('')).to.be.false;
    });

    // No postgrestField override: camelToSnake('semrushWorkspaceId') already
    // produces the DB column name `semrush_workspace_id`.
    it('uses the default camelToSnake column mapping (no override)', () => {
      expect(attributes.semrushWorkspaceId.postgrestField).to.be.undefined;
    });
  });
});
