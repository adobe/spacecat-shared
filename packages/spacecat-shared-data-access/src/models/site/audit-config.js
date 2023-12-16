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

/**
 * Initializes the audit type configs. If auditsDisabled is true, all audit types will be disabled.
 * @param {object} auditTypeConfigs - Object containing audit type configs.
 * @param {boolean} auditsDisabled - Flag indicating if all audits are disabled.
 * @return {object} Object containing audit type configs.
 */
function getAuditTypeConfigs(auditTypeConfigs, auditsDisabled) {
  return Object.entries(auditTypeConfigs || {}).reduce((acc, [key, value]) => {
    acc[key] = AuditConfigType(value, auditsDisabled);
    return acc;
  }, {});
}

const AuditConfig = (data = {}) => {
  const auditTypeConfigs = getAuditTypeConfigs(data.auditTypeConfigs, data.auditsDisabled);
  return {
    auditsDisabled: () => data.auditsDisabled || false,
    getAuditTypeConfigs: () => auditTypeConfigs,
    getAuditTypeConfig: (type) => auditTypeConfigs[type],
  };
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
