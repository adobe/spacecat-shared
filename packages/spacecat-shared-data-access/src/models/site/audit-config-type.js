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

const AuditConfigType = (data = {}) => {
  const state = {
    disabled: data.disabled || false,
    excludedURLs: data.excludedURLs || [],
    manualOverwrites: data.manualOverwrites || [],
  };

  const self = {
    disabled: () => state.disabled,
    getExcludedURLs: () => state.excludedURLs,
    updateExcludedURLs: (excludeURLs) => {
      state.excludedURLs = excludeURLs;
    },
    getManualOverwrites: () => state.manualOverwrites,
    updateManualOverwrites: (manualOverwrites) => {
      state.manualOverwrites = manualOverwrites;
    },
    updateDisabled: (newValue) => {
      state.disabled = newValue;
    },
  };

  return Object.freeze(self);
};

AuditConfigType.fromDynamoItem = (dynamoItem) => {
  const auditConfigTypeData = {
    disabled: dynamoItem.disabled,
    excludedURLs: dynamoItem.excludedURLs,
    manualOverwrites: dynamoItem.manualOverwrites,
  };
  return AuditConfigType(auditConfigTypeData);
};

AuditConfigType.toDynamoItem = (auditConfigType) => ({
  disabled: auditConfigType.disabled(),
  excludedURLs: auditConfigType.getExcludedURLs(),
  manualOverwrites: auditConfigType.getManualOverwrites(),
});

export default AuditConfigType;
