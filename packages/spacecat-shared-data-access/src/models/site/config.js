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

import Joi from 'joi';

const configSchema = Joi.object({
  slack: Joi.object({
    workspace: Joi.string(),
    channel: Joi.string(),
  }),
  alerts: Joi.array().items(Joi.object({
    type: Joi.string(),
    byOrg: Joi.boolean(),
    mentions: Joi.array().items(Joi.object({ slack: Joi.array().items(Joi.string()) })),
  })),
});
const Config = (data = {}) => {
  const state = {
    slack: {
      channel: data?.slack?.channel,
      workspace: data?.slack?.workspace,
    },
    alerts: data.alerts,
  };

  const self = {
    alerts: () => state.alerts,
    slack: () => state.slack,
  };

  return Object.freeze(self);
};

// Function to validate incoming configuration
function validateConfiguration(config) {
  const { error, value } = configSchema.validate(config);

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value; // Validated and sanitized configuration
}

Config.fromDynamoItem = (dynamoItem) => Config(dynamoItem);

Config.toDynamoItem = (config) => {
  try {
    return validateConfiguration(config);
  } catch (e) {
    throw new Error(`Error validating config ${e.message}`);
  }
};

export default Config;
