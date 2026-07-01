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
import taskManagementConnectionSchema from '../../../../src/models/task-management-connection/task-management-connection.schema.js';

describe('TaskManagementConnection Schema', () => {
  let attributes;

  before(() => {
    attributes = taskManagementConnectionSchema.getAttributes();
  });

  describe('externalInstanceId attribute', () => {
    it('exists', () => {
      expect(attributes.externalInstanceId).to.exist;
    });

    it('is required', () => {
      expect(attributes.externalInstanceId.required).to.be.true;
    });

    it('is readOnly', () => {
      expect(attributes.externalInstanceId.readOnly).to.be.true;
    });

    it('is of type string', () => {
      expect(attributes.externalInstanceId.type).to.equal('string');
    });

    it('validates non-empty string', () => {
      expect(attributes.externalInstanceId.validate('some-id')).to.be.true;
    });

    it('rejects empty string', () => {
      expect(attributes.externalInstanceId.validate('')).to.be.false;
    });
  });

  describe('connectedBy attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.connectedBy.required).to.be.true;
      expect(attributes.connectedBy.readOnly).to.be.true;
    });
  });

  describe('displayName attribute', () => {
    it('is required and mutable (updated on re-auth)', () => {
      expect(attributes.displayName.required).to.be.true;
      expect(attributes.displayName.readOnly).to.not.be.true;
    });
  });

  describe('instanceUrl attribute', () => {
    it('is required and mutable (updated on re-auth)', () => {
      expect(attributes.instanceUrl.required).to.be.true;
      expect(attributes.instanceUrl.readOnly).to.not.be.true;
    });
  });

  describe('connectedAt attribute', () => {
    it('exists and is optional', () => {
      expect(attributes.connectedAt).to.exist;
      expect(attributes.connectedAt.required).to.be.false;
    });

    it('validates ISO date strings', () => {
      expect(attributes.connectedAt.validate('2026-06-15T10:05:00.000Z')).to.be.true;
    });

    it('rejects non-ISO strings', () => {
      expect(attributes.connectedAt.validate('not-a-date')).to.be.false;
    });

    it('rejects loose date formats accepted by Date.parse', () => {
      expect(attributes.connectedAt.validate('Jan 1, 2024')).to.be.false;
      expect(attributes.connectedAt.validate('Tuesday')).to.be.false;
    });

    it('accepts null/undefined', () => {
      expect(attributes.connectedAt.validate(null)).to.be.true;
      expect(attributes.connectedAt.validate(undefined)).to.be.true;
    });
  });

  describe('lastUsedAt attribute', () => {
    it('exists and is optional', () => {
      expect(attributes.lastUsedAt).to.exist;
      expect(attributes.lastUsedAt.required).to.be.false;
    });

    it('validates ISO date strings', () => {
      expect(attributes.lastUsedAt.validate('2026-06-15T10:05:00.000Z')).to.be.true;
    });

    it('rejects non-ISO strings', () => {
      expect(attributes.lastUsedAt.validate('not-a-date')).to.be.false;
    });

    it('rejects loose date formats accepted by Date.parse', () => {
      expect(attributes.lastUsedAt.validate('Jan 1, 2024')).to.be.false;
    });

    it('accepts null/undefined', () => {
      expect(attributes.lastUsedAt.validate(null)).to.be.true;
      expect(attributes.lastUsedAt.validate(undefined)).to.be.true;
    });
  });

  describe('metadata attribute', () => {
    it('exists and is required', () => {
      expect(attributes.metadata).to.exist;
      expect(attributes.metadata.required).to.be.true;
    });

    it('set hook validates jira_cloud metadata and passes valid data through', () => {
      const valid = { cloudId: '11111111-2222-3333-4444-555555555555' };
      const result = attributes.metadata.set(valid, { provider: 'jira_cloud' });
      expect(result).to.deep.equal(valid);
    });

    it('set hook rejects invalid jira_cloud metadata', () => {
      const invalid = { cloudId: 'not-a-uuid' };
      expect(() => attributes.metadata.set(invalid, { provider: 'jira_cloud' }))
        .to.throw('Invalid metadata');
    });

    it('set hook rejects extra properties in metadata', () => {
      const extra = { cloudId: '11111111-2222-3333-4444-555555555555', siteName: 'forbidden' };
      expect(() => attributes.metadata.set(extra, { provider: 'jira_cloud' }))
        .to.throw('Unexpected metadata properties');
    });

    it('set hook passes through when provider is not yet set', () => {
      const data = { anything: true };
      const result = attributes.metadata.set(data, {});
      expect(result).to.deep.equal(data);
    });
  });

  describe('errorMessage attribute', () => {
    it('exists and is optional', () => {
      expect(attributes.errorMessage).to.exist;
      expect(attributes.errorMessage.required).to.be.false;
    });
  });
});
