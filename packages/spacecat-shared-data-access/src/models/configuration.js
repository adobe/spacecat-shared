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

const Configuration = (data = {}) => {
  const self = { ...data };
  self.getJobs = () => self.jobs;
  self.getVersion = () => self.version;
  self.getQueues = () => self.queues;

  return Object.freeze(self);
};

export const checkConfiguration = (configuration) => {
  const schema = Joi.object({
    version: Joi.string().required(),
    queues: Joi.object().required(),
    jobs: Joi.array().required(),
  }).unknown(true);
  const { error, value } = schema.validate(configuration);

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value; // Validated and sanitized configuration
};

/**
 * Creates a new Configuration.
 *
 * @param {object} data - configuration data
 * @returns {Readonly<Configuration>} configuration - new configuration
 */
export const createConfiguration = (data) => {
  const value = checkConfiguration(data);
  const newState = { ...value };
  return Configuration(newState);
};
