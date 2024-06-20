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

import Joi from 'joi';
import AuditConfig from './audit-config.js';

export const configSchema = Joi.object({
  slack: Joi.object({
    workspace: Joi.string(),
    channel: Joi.string(),
    invitedUserCount: Joi.number().integer().min(0),
  }),
  alerts: Joi.array().items(Joi.object({
    type: Joi.string().required(),
    byOrg: Joi.boolean(),
    mentions: Joi.array().items(Joi.object({ slack: Joi.array().items(Joi.string()) })),
  }).unknown(true)),
  audits: Joi.object({
    auditsDisabled: Joi.boolean().optional(),
    auditTypeConfigs: Joi.object().pattern(
      Joi.string(),
      Joi.object({
        disabled: Joi.boolean().optional(),
        excludedURLs: Joi.array().items(Joi.string()).optional(),
        manualOverwrites: Joi.array().items(Joi.object({
          brokenTargetURL: Joi.string().optional(),
          targetURL: Joi.string().optional(),
        })).optional(),
      }).unknown(true),
    ).unknown(true),
  }).unknown(true),
}).unknown(true);

export const DEFAULT_CONFIG = {
  slack: {},
  alerts: [],
  audits: {},
};

// Function to validate incoming configuration
function validateConfiguration(config) {
  const { error, value } = configSchema.validate(config);

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value; // Validated and sanitized configuration
}

export const Config = (data = {}) => {
  const validConfig = validateConfiguration(data);
  validConfig.audits = AuditConfig(validConfig.audits);

  const state = { ...validConfig };

  const self = { ...state };

  return Object.freeze(self);
};

Config.fromDynamoItem = (dynamoItem) => Config(dynamoItem);

Config.toDynamoItem = (config) => ({
  ...config,
  audits: AuditConfig.toDynamoItem(config.audits),
});
