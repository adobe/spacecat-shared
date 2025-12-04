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

export const handlerSchema = Joi.object().pattern(Joi.string(), Joi.object(
  {
    enabled: Joi.object({
      sites: Joi.array().items(Joi.string()),
      orgs: Joi.array().items(Joi.string()),
    }),
    disabled: Joi.object({
      sites: Joi.array().items(Joi.string()),
      orgs: Joi.array().items(Joi.string()),
    }),
    enabledByDefault: Joi.boolean().required(),
    movingAvgThreshold: Joi.number().min(1).optional(),
    percentageChangeThreshold: Joi.number().min(1).optional(),
    dependencies: Joi.array().items(Joi.object(
      {
        handler: Joi.string(),
        actions: Joi.array().items(Joi.string()),
      },
    )),
    productCodes: Joi.array().items(Joi.string()).min(1).required(),
  },
)).unknown(true);

export const jobsSchema = Joi.array().required();

export const queueSchema = Joi.object().required();

export const configurationSchema = Joi.object({
  version: Joi.number().required(),
  queues: queueSchema,
  handlers: handlerSchema,
  jobs: jobsSchema,
}).unknown(true);

/**
 * Validates a configuration object against the schema.
 * @param {object} data - The configuration data to validate.
 * @param {object} [schema=configurationSchema] - The Joi schema to validate against.
 * @returns {object} The validated configuration data.
 * @throws {Error} If validation fails.
 */
export const checkConfiguration = (data, schema = configurationSchema) => {
  const { error, value } = schema.validate(data);

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value;
};
