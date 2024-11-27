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

import { hasText } from '@adobe/spacecat-shared-utils';

import { validate as uuidValidate } from 'uuid';

import { KEY_EVENT_TYPES } from '../../models/key-event.js';
import createSchema from './base.schema.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const KeyEventSchema = createSchema(
  'KeyEvent',
  '1',
  'SpaceCat',
  {
    // add your custom attributes here. the primary id and
    // timestamps are created by default via the base schema.
    attributes: {
      siteId: {
        type: 'string',
        required: true,
        validate: (value) => uuidValidate(value),
      },
      name: {
        type: 'string',
        required: true,
        validate: (value) => hasText(value),
      },
      type: {
        type: Object.values(KEY_EVENT_TYPES),
        required: true,
      },
      time: {
        type: 'number',
        required: true,
        default: () => Date.now(),
      },
    },
    // add your custom indexes here. the primary index is created by default via the base schema
    indexes: {
      bySiteId: {
        index: 'spacecat-data-key-event-by-site-id',
        pk: {
          field: 'gsi1pk',
          composite: ['siteId'],
        },
        sk: {
          field: 'gsi1sk',
          composite: ['updatedAt'],
        },
      },
    },
    /**
     * References to other entities. This is not part of the standard ElectroDB schema, but is used
     * to define relationships between entities in our data layer API.
     * @type {{
     * [belongs_to]: [{target: string}],
     * [has_many]: [{target: string}],
     * [has_one]: [{target: string}]
     * }}
     */
    references: {
      belongs_to: [
        { target: 'Site' },
      ],
    },
  },
);

export default KeyEventSchema;
