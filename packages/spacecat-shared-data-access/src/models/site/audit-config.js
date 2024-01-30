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

import AuditConfigType from './audit-config-type.js';
import {
  AUDIT_TYPE_BROKEN_BACKLINKS,
  AUDIT_TYPE_ORGANIC_KEYWORDS,
} from '../audit.js';

const AUDIT_TYPE_DISABLED_DEFAULTS = {
  [AUDIT_TYPE_BROKEN_BACKLINKS]: true,
  [AUDIT_TYPE_ORGANIC_KEYWORDS]: true,
};

function getAuditTypeConfigs(auditTypeConfigs, auditsDisabled) {
  if (!auditTypeConfigs || Object.keys(auditTypeConfigs).length === 0) {
    return {
      [AUDIT_TYPE_BROKEN_BACKLINKS]: AuditConfigType({ disabled: true }),
      [AUDIT_TYPE_ORGANIC_KEYWORDS]: AuditConfigType({ disabled: true }),
    };
  }
  return Object.entries(auditTypeConfigs || {}).reduce((acc, [key, value]) => {
    const disabled = value.disabled !== undefined
      ? value.disabled : (AUDIT_TYPE_DISABLED_DEFAULTS[key] || auditsDisabled || false);
    acc[key] = AuditConfigType(
      {
        ...value,
        disabled,
      },
    );
    return acc;
  }, {});
}

const AuditConfig = (data = {}) => {
  const state = {
    auditsDisabled: data.auditsDisabled || false,
    auditTypeConfigs: getAuditTypeConfigs(data.auditTypeConfigs, data.auditsDisabled),
  };

  const self = {
    auditsDisabled: () => state.auditsDisabled,
    getAuditTypeConfigs: () => state.auditTypeConfigs,
    getAuditTypeConfig: (type) => state.auditTypeConfigs[type],
    updateAuditsDisabled: (newValue) => {
      state.auditsDisabled = newValue;
    },
    updateAuditTypeConfig: (type, config) => {
      state.auditTypeConfigs[type] = AuditConfigType(config);
    },
  };

  return Object.freeze(self);
};

AuditConfig.fromDynamoItem = (dynamoItem) => AuditConfig(dynamoItem);

AuditConfig.toDynamoItem = (auditConfig) => ({
  auditsDisabled: auditConfig.auditsDisabled(),
  auditTypeConfigs: Object.entries(auditConfig.getAuditTypeConfigs())
    .reduce((acc, [key, value]) => {
      acc[key] = AuditConfigType.toDynamoItem(value);
      return acc;
    }, {}),
});

export default AuditConfig;
