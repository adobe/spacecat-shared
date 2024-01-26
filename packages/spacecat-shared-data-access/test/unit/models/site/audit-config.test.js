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

import AuditConfig from '../../../../src/models/site/audit-config.js';
import { AUDIT_TYPE_BROKEN_BACKLINKS } from '../../../../src/models/audit.js';

describe('AuditConfig Tests', () => {
  describe('AuditConfig Creation', () => {
    it('creates an AuditConfig with defaults when no data is provided', () => {
      const auditConfig = AuditConfig();
      expect(auditConfig.auditsDisabled()).to.be.false;
      const auditTypeConfigs = auditConfig.getAuditTypeConfigs();
      expect(auditTypeConfigs[AUDIT_TYPE_BROKEN_BACKLINKS]).to.be.an('object');
      expect(auditTypeConfigs[AUDIT_TYPE_BROKEN_BACKLINKS].disabled()).to.be.true;
    });

    it('creates an AuditConfig with provided data', () => {
      const data = {
        auditsDisabled: true,
        auditTypeConfigs: {
          type1: { disabled: true },
          type2: { disabled: false },
        },
      };
      const auditConfig = AuditConfig(data);
      expect(auditConfig.auditsDisabled()).to.be.true;
      expect(auditConfig.getAuditTypeConfig('type1').disabled()).to.be.true;
      expect(auditConfig.getAuditTypeConfig('type2').disabled()).to.be.false;
    });
  });

  describe('auditsDisabled Method', () => {
    it('returns true when audits are disabled', () => {
      const auditConfig = AuditConfig({ auditsDisabled: true });
      expect(auditConfig.auditsDisabled()).to.be.true;
    });

    it('returns false when audits are not disabled', () => {
      const auditConfig = AuditConfig({ auditsDisabled: false });
      expect(auditConfig.auditsDisabled()).to.be.false;
    });
  });

  describe('getAuditTypeConfig Method', () => {
    it('returns the correct AuditConfigType for a given type', () => {
      const data = {
        auditTypeConfigs: { type1: { disabled: true } },
      };
      const auditConfig = AuditConfig(data);
      const typeConfig = auditConfig.getAuditTypeConfig('type1');
      expect(typeConfig).to.be.an('object');
      expect(typeConfig.disabled()).to.be.true;
    });
  });

  describe('getAuditTypeConfigs Method', () => {
    it('returns all audit type configurations', () => {
      const data = {
        auditTypeConfigs: {
          type1: { disabled: true },
          type2: { disabled: false },
        },
      };
      const auditConfig = AuditConfig(data);
      const typeConfigs = auditConfig.getAuditTypeConfigs();
      expect(typeConfigs).to.have.keys(['type1', 'type2']);
    });
  });

  describe('updateAuditsDisabled Method', () => {
    it('updates the auditsDisabled state to true', () => {
      const auditConfig = AuditConfig({ auditsDisabled: false });
      auditConfig.updateAuditsDisabled(true);
      expect(auditConfig.auditsDisabled()).to.be.true;
    });

    it('updates the auditsDisabled state to false', () => {
      const auditConfig = AuditConfig({ auditsDisabled: true });
      auditConfig.updateAuditsDisabled(false);
      expect(auditConfig.auditsDisabled()).to.be.false;
    });

    it('updates auditTypeConfigs when auditsDisabled changes', () => {
      const data = {
        auditsDisabled: false,
        auditTypeConfigs: {
          type1: { disabled: true },
          type2: { disabled: false },
        },
      };
      const auditConfig = AuditConfig(data);

      auditConfig.updateAuditsDisabled(true);

      expect(auditConfig.auditsDisabled()).to.be.true;
    });
  });

  describe('updateAuditTypeConfig Method', () => {
    it('updates a specific audit type configuration', () => {
      const data = {
        auditsDisabled: false,
        auditTypeConfigs: {
          type1: { disabled: false },
          type2: { disabled: false },
        },
      };
      const auditConfig = AuditConfig(data);

      // Update the configuration for type1
      auditConfig.updateAuditTypeConfig('type1', { disabled: true });

      expect(auditConfig.getAuditTypeConfig('type1').disabled()).to.be.true;
      expect(auditConfig.getAuditTypeConfig('type2').disabled()).to.be.false;
    });

    it('adds a new audit type configuration if it does not exist', () => {
      const data = {
        auditsDisabled: false,
        auditTypeConfigs: {
          type1: { disabled: false },
        },
      };
      const auditConfig = AuditConfig(data);

      // Add a new configuration for type2
      auditConfig.updateAuditTypeConfig('type2', { disabled: true });

      expect(auditConfig.getAuditTypeConfig('type2').disabled()).to.be.true;
    });
  });

  describe('fromDynamoItem Static Method', () => {
    it('correctly converts from DynamoDB item', () => {
      const dynamoItem = {
        auditsDisabled: false,
        auditTypeConfigs: {
          type1: { disabled: true },
          type2: { disabled: false },
        },
      };
      const auditConfig = AuditConfig.fromDynamoItem(dynamoItem);
      expect(auditConfig.auditsDisabled()).to.be.false;
      expect(auditConfig.getAuditTypeConfig('type1').disabled()).to.be.true;
      expect(auditConfig.getAuditTypeConfig('type2').disabled()).to.be.false;
    });
  });

  describe('toDynamoItem Static Method', () => {
    it('correctly converts to DynamoDB item format', () => {
      const data = {
        auditsDisabled: false,
        auditTypeConfigs: {
          type1: { disabled: true },
          type2: { disabled: false },
        },
      };
      const auditConfig = AuditConfig(data);
      const dynamoItem = AuditConfig.toDynamoItem(auditConfig);
      expect(dynamoItem.auditsDisabled).to.be.false;
      expect(dynamoItem.auditTypeConfigs.type1.disabled).to.be.true;
      expect(dynamoItem.auditTypeConfigs.type2.disabled).to.be.false;
    });
  });
});
