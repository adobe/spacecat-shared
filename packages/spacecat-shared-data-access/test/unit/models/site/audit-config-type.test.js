/*
 * Copyright 2023 Adobe. All rights reserved.
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

import AuditConfigType from '../../../../src/models/site/audit-config-type.js';

describe('AuditConfigType Tests', () => {
  describe('AuditConfigType Creation', () => {
    it('creates an AuditConfigType with default disabled as false', () => {
      const auditConfigType = AuditConfigType();
      expect(auditConfigType.disabled()).to.be.false;
    });

    it('creates an AuditConfigType with specified disabled value', () => {
      const auditConfigType = AuditConfigType({ disabled: true });
      expect(auditConfigType.disabled()).to.be.true;
    });

    it('considers allAuditsDisabled flag', () => {
      const auditConfigType = AuditConfigType({}, true);
      expect(auditConfigType.disabled()).to.be.false;
    });
  });

  describe('disabled Method', () => {
    it('returns true when audit is disabled', () => {
      const auditConfigType = AuditConfigType({ disabled: true });
      expect(auditConfigType.disabled()).to.be.true;
    });

    it('returns false when audit is not disabled', () => {
      const auditConfigType = AuditConfigType({ disabled: false });
      expect(auditConfigType.disabled()).to.be.false;
    });

    it('returns false if allAuditsDisabled is true regardless', () => {
      const auditConfigType = AuditConfigType({ disabled: false }, true);
      expect(auditConfigType.disabled()).to.be.false;
    });
  });

  describe('updateDisabled Method', () => {
    it('updates the disabled status of the audit type', () => {
      const auditConfigType = AuditConfigType({ disabled: false });

      // Update the disabled status
      auditConfigType.updateDisabled(true);

      expect(auditConfigType.disabled()).to.be.true;
    });

    it('updates the disabled status independently of allAuditsDisabled flag', () => {
      // The allAuditsDisabled flag is set to true initially
      const auditConfigType = AuditConfigType({ disabled: false }, true);

      // Update the disabled status
      auditConfigType.updateDisabled(false);

      // The updateDisabled method should update the state regardless of allAuditsDisabled flag
      expect(auditConfigType.disabled()).to.be.false;
    });
  });

  describe('updateExcludedURLs Method', () => {
    it('returns the default excludedURLs array', () => {
      const auditConfigType = AuditConfigType();
      expect(auditConfigType.getExcludedURLs()).to.be.an('array').that.is.empty;
    });

    it('returns the specified excludedURLs array', () => {
      const urls = ['http://example.com', 'http://test.com'];
      const auditConfigType = AuditConfigType({ excludedURLs: urls });
      expect(auditConfigType.getExcludedURLs()).to.eql(urls);
    });

    it('updates the excludedURLs array to an empty array', () => {
      const urls = ['http://example.com', 'http://test.com'];
      const auditConfigType = AuditConfigType({ excludedURLs: urls });
      auditConfigType.updateExcludedURLs([]);
      expect(auditConfigType.getExcludedURLs()).to.be.an('array').that.is.empty;
    });

    it('updates the excludedURLs array', () => {
      const auditConfigType = AuditConfigType();
      const newURLs = ['http://newexample.com', 'http://newtest.com'];
      auditConfigType.updateExcludedURLs(newURLs);
      expect(auditConfigType.getExcludedURLs()).to.eql(newURLs);
    });
  });

  describe('fromDynamoItem Static Method', () => {
    it('correctly converts from DynamoDB item', () => {
      const dynamoItem = { disabled: true, excludedURLs: ['http://example.com'] };
      const typeConfig = AuditConfigType.fromDynamoItem(dynamoItem);
      expect(typeConfig.disabled()).to.be.true;
      expect(typeConfig.getExcludedURLs()).to.eql(['http://example.com']);
    });
  });

  describe('toDynamoItem Static Method', () => {
    it('correctly converts to DynamoDB item format', () => {
      const urls = ['http://example.com', 'http://test.com'];
      const auditConfigType = AuditConfigType({ disabled: true, excludedURLs: urls });
      const dynamoItem = AuditConfigType.toDynamoItem(auditConfigType);
      expect(dynamoItem.disabled).to.be.true;
      expect(dynamoItem.excludedURLs).to.eql(urls);
    });
  });

  describe('updateManualOverwrites Method', () => {
    it('updates the manualOverwrites array', () => {
      const auditConfigType = AuditConfigType();
      const newManualOverwrites = [
        { brokenTargetURL: 'https://broken.co', targetURL: 'https://overwrite.co' },
        { brokenTargetURL: 'https://broken.link.co', targetURL: 'https://overwrite.link.co' },
      ];
      auditConfigType.updateManualOverwrites(newManualOverwrites);
      expect(auditConfigType.getManualOverwrites()).to.eql(newManualOverwrites);
    });

    it('updates the manualOverwrites array to an empty array', () => {
      const manualOverwrites = [
        { brokenTargetURL: 'https://broken.co', targetURL: 'https://overwrite.co' },
        { brokenTargetURL: 'https://broken.link.co', targetURL: 'https://overwrite.link.co' },
      ];
      const auditConfigType = AuditConfigType({ manualOverwrites });
      auditConfigType.updateManualOverwrites([]);
      expect(auditConfigType.getManualOverwrites()).to.be.an('array').that.is.empty;
    });
  });

  describe('updateFixedURLs Method', () => {
    it('updates the updateFixedURLs array', () => {
      const auditConfigType = AuditConfigType();
      const newFixedURLs = [
        { brokenTargetURL: 'https://broken.co', targetURL: 'https://fixed.co' },
        { brokenTargetURL: 'https://broken.link.co', targetURL: 'https://fixed.link.co' },
      ];
      auditConfigType.updateFixedURLs(newFixedURLs);
      expect(auditConfigType.getFixedURLs()).to.eql(newFixedURLs);
    });

    it('updates the fixedURLs array to an empty array', () => {
      const fixedURLs = [
        { brokenTargetURL: 'https://broken.co', targetURL: 'https://fixed.co' },
        { brokenTargetURL: 'https://broken.link.co', targetURL: 'https://fixed.link.co' },
      ];
      const auditConfigType = AuditConfigType({ fixedURLs });
      auditConfigType.updateFixedURLs([]);
      expect(auditConfigType.getFixedURLs()).to.be.an('array').that.is.empty;
    });
  });
});
