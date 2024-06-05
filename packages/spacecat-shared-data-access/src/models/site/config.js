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

export const configSchema = Joi.object({
  slack: Joi.object({
    workspace: Joi.string(),
    channel: Joi.string(),
    invitedUserCount: Joi.number().integer().min(0),
  }),
  handlers: Joi.object().pattern(Joi.string(), Joi.object({
    mentions: Joi.object().pattern(Joi.string(), Joi.array().items(Joi.string())),
  })).unknown(true),
}).unknown(true);

export const DEFAULT_CONFIG = {
  slack: {},
  handlers: {
  },
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

  const self = { ...validConfig };
  self.getSlackConfig = () => self.slack;
  self.getSlackMentions = (type) => self?.handlers[type]?.mentions?.slack;

  self.updateSlackConfig = (channel, workspace, invitedUserCount) => {
    self.slack = {
      channel,
      workspace,
      invitedUserCount,
    };
  };

  self.updateSlackMentions = (type, mentions) => {
    const { handlers } = self;
    handlers[type] = handlers[type] || {};
    handlers[type].mentions.slack = mentions;
  };

  return Object.freeze(self);
};

Config.fromDynamoItem = (dynamoItem) => Config(dynamoItem);

Config.toDynamoItem = (config) => ({
  ...config,
});
