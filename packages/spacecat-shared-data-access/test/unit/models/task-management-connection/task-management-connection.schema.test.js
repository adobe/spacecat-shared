/*
 * Copyright 2024 Adobe. All rights reserved.
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
    it('is required and readOnly', () => {
      expect(attributes.displayName.required).to.be.true;
      expect(attributes.displayName.readOnly).to.be.true;
    });
  });

  describe('instanceUrl attribute', () => {
    it('is required and readOnly', () => {
      expect(attributes.instanceUrl.required).to.be.true;
      expect(attributes.instanceUrl.readOnly).to.be.true;
    });
  });
});
