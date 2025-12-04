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

import SchemaBuilder from '../base/schema.builder.js';
import Configuration from './configuration.model.js';
import ConfigurationCollection from './configuration.collection.js';
import { zeroPad } from '../../util/util.js';
import { checkConfiguration, handlerSchema } from './configuration.validator.js';

// Re-export checkConfiguration for backward compatibility
export { checkConfiguration } from './configuration.validator.js';

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
        group: { type: Object.values(Configuration.JOB_GROUPS), required: true },
        type: { type: 'string', required: true },
        interval: { type: Object.values(Configuration.JOB_INTERVALS), required: true },
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
  .addAttribute('versionString', { // used for indexing/sorting
    type: 'string',
    required: true,
    readOnly: true,
    default: '0', // setting the default forces set() to run, to transform the version number to a string
    set: (value, all) => zeroPad(all.version, 10),
  })
  .addAllIndex(['versionString']);

export default schema.build();
