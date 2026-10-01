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

  describe('semrushSubWorkspaceId attribute (write-of-record)', () => {
    it('exists with a nullable hasText validator', () => {
      const attr = attributes.semrushSubWorkspaceId;
      expect(attr).to.exist;
      expect(attr.required).to.not.equal(true);
      expect(attr.validate).to.be.a('function');
    });

    it('accepts a non-empty string', () => {
      expect(attributes.semrushSubWorkspaceId.validate('sub-ws-123')).to.be.true;
    });

    it('accepts nullish (no subworkspace connected)', () => {
      expect(attributes.semrushSubWorkspaceId.validate(null)).to.be.true;
      expect(attributes.semrushSubWorkspaceId.validate(undefined)).to.be.true;
    });

    it('rejects the empty string', () => {
      expect(attributes.semrushSubWorkspaceId.validate('')).to.be.false;
    });

    // Pins actual behaviour: the shared `hasText` does NOT trim, so a
    // whitespace-only value passes the guard (parity with the Organization
    // sibling). Safe because only the activate flow writes this column, always
    // a real Semrush workspace UUID — never user input.
    it('accepts whitespace-only input (hasText does not trim)', () => {
      expect(attributes.semrushSubWorkspaceId.validate('   ')).to.be.true;
    });

    // No postgrestField override: camelToSnake('semrushSubWorkspaceId') already
    // produces the DB column name `semrush_sub_workspace_id`.
    it('uses the default camelToSnake column mapping (no override)', () => {
      expect(attributes.semrushSubWorkspaceId.postgrestField).to.be.undefined;
    });
  });

  describe('semrushProvisioningStatus attribute', () => {
    it('is not required and carries an enum validator', () => {
      const attr = attributes.semrushProvisioningStatus;
      expect(attr).to.exist;
      expect(attr.required).to.not.equal(true);
      expect(attr.validate).to.be.a('function');
    });

    it('accepts every provisioning-status enum value', () => {
      for (const value of Brand.PROVISIONING_STATUSES) {
        expect(attributes.semrushProvisioningStatus.validate(value)).to.be.true;
      }
    });

    it('accepts nullish (no async attempt tracked)', () => {
      expect(attributes.semrushProvisioningStatus.validate(null)).to.be.true;
      expect(attributes.semrushProvisioningStatus.validate(undefined)).to.be.true;
    });

    it('rejects an out-of-enum value', () => {
      expect(attributes.semrushProvisioningStatus.validate('active')).to.be.false;
      expect(attributes.semrushProvisioningStatus.validate('')).to.be.false;
    });

    it('uses the default camelToSnake column mapping (no override)', () => {
      expect(attributes.semrushProvisioningStatus.postgrestField).to.be.undefined;
    });
  });

  describe('semrushProvisioningAttemptId / semrushProvisioningJobId attributes', () => {
    const uuidAttrs = ['semrushProvisioningAttemptId', 'semrushProvisioningJobId'];

    uuidAttrs.forEach((name) => {
      describe(name, () => {
        it('is not required and carries a UUID validator', () => {
          expect(attributes[name]).to.exist;
          expect(attributes[name].required).to.not.equal(true);
          expect(attributes[name].validate).to.be.a('function');
        });

        it('accepts a valid UUID', () => {
          expect(attributes[name].validate('e48e9db4-3101-4237-8075-a9132333e8c2')).to.be.true;
        });

        it('accepts nullish (no attempt/job tracked)', () => {
          expect(attributes[name].validate(null)).to.be.true;
          expect(attributes[name].validate(undefined)).to.be.true;
        });

        it('rejects a non-UUID string', () => {
          expect(attributes[name].validate('not-a-uuid')).to.be.false;
        });
      });
    });
  });

  describe('semrushProvisioningError attribute', () => {
    it('is not required and carries a length validator', () => {
      const attr = attributes.semrushProvisioningError;
      expect(attr).to.exist;
      expect(attr.required).to.not.equal(true);
      expect(attr.validate).to.be.a('function');
    });

    it('accepts a short sanitized message', () => {
      expect(attributes.semrushProvisioningError.validate('workspace provisioning failed')).to.be.true;
    });

    it('accepts nullish (no failure recorded)', () => {
      expect(attributes.semrushProvisioningError.validate(null)).to.be.true;
      expect(attributes.semrushProvisioningError.validate(undefined)).to.be.true;
    });

    it('accepts exactly 2000 characters (the DB CHECK boundary)', () => {
      expect(attributes.semrushProvisioningError.validate('x'.repeat(2000))).to.be.true;
    });

    it('rejects 2001 characters (matches brands_semrush_provisioning_error_length_check)', () => {
      expect(attributes.semrushProvisioningError.validate('x'.repeat(2001))).to.be.false;
    });
  });

  describe('semrushProvisioningCandidateWorkspaceId attribute (diagnostic, non-canonical)', () => {
    it('exists with a nullable hasText validator', () => {
      const attr = attributes.semrushProvisioningCandidateWorkspaceId;
      expect(attr).to.exist;
      expect(attr.required).to.not.equal(true);
      expect(attr.validate).to.be.a('function');
    });

    it('accepts a non-empty string', () => {
      expect(attributes.semrushProvisioningCandidateWorkspaceId.validate('candidate-ws-1')).to.be.true;
    });

    it('accepts nullish (no candidate captured yet)', () => {
      expect(attributes.semrushProvisioningCandidateWorkspaceId.validate(null)).to.be.true;
      expect(attributes.semrushProvisioningCandidateWorkspaceId.validate(undefined)).to.be.true;
    });

    it('rejects the empty string', () => {
      expect(attributes.semrushProvisioningCandidateWorkspaceId.validate('')).to.be.false;
    });
  });
});
