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

/* c8 ignore start */

import { isNonEmptyObject } from '@adobe/spacecat-shared-utils';

import Joi from 'joi';

import SchemaBuilder from '../base/schema.builder.js';
import Configuration from './configuration.model.js';
import ConfigurationCollection from './configuration.collection.js';

const handlerSchema = Joi.object().pattern(Joi.string(), Joi.object(
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
    dependencies: Joi.array().items(Joi.object(
      {
        handler: Joi.string(),
        actions: Joi.array().items(Joi.string()),
      },
    )),
  },
)).unknown(true);

const jobsSchema = Joi.array().required();

const queueSchema = Joi.object().required();

const configurationSchema = Joi.object({
  version: Joi.number().required(),
  queues: queueSchema,
  handlers: handlerSchema,
  jobs: jobsSchema,
}).unknown(true);

export const checkConfiguration = (data, schema = configurationSchema) => {
  const { error, value } = schema.validate(data);

  if (error) {
    throw new Error(`Configuration validation error: ${error.message}`);
  }

  return value;
};

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const schema = new SchemaBuilder(Configuration, ConfigurationCollection)
  .addAttribute('handlers', {
    type: 'any',
    validate: (value) => !value || checkConfiguration(value, handlerSchema),
  })
  .addAttribute('jobs', {
    type: 'list',
    items: {
      type: 'map',
      properties: {
        group: { type: ['audits', 'imports', 'reports'] },
        type: { type: 'string', required: true },
        interval: { type: ['daily', 'weekly'] },
      },
    },
  })
  .addAttribute('queues', {
    type: 'any',
    required: true,
    validate: (value) => isNonEmptyObject(value),
  })
  .addAttribute('slackRoles', {
    type: 'any',
    validate: (value) => !value || isNonEmptyObject(value),
  })
  .addAttribute('version', {
    type: 'number',
    required: true,
    readOnly: true,
  })
  // eslint-disable-next-line no-template-curly-in-string
  .addAllIndexWithTemplateField('version', '${version}');

export default schema.build();
