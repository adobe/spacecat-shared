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

import { isNonEmptyObject, isValidUrl } from '@adobe/spacecat-shared-utils';

import { validate as uuidValidate } from 'uuid';

import { DEFAULT_UPDATED_BY } from '../models/experiment/experiment.model.js';

import createSchema from './base.schema.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const ExperimentSchema = createSchema(
  'Experiment',
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
      conversionEventName: {
        type: 'string',
      },
      conversionEventValue: {
        type: 'string',
      },
      endDate: {
        type: 'number',
      },
      // naming this expId so that it doesn't conflict
      // with the experimentId attribute (internal id of this entity)
      expId: {
        type: 'string',
        required: true,
      },
      name: {
        type: 'string',
      },
      startDate: {
        type: 'number',
      },
      status: {
        type: ['ACTIVE', 'INACTIVE'],
        required: true,
      },
      type: {
        type: 'string',
      },
      url: {
        type: 'string',
        validate: (value) => !value || isValidUrl(value),
      },
      updatedBy: {
        type: 'string',
        required: true,
        default: DEFAULT_UPDATED_BY,
      },
      variants: {
        type: 'list',
        items: {
          type: 'any',
          validate: (value) => isNonEmptyObject(value),
        },
        required: true,
      },
    },
    // add your custom indexes here. the primary index is created by default via the base schema
    indexes: {
      bySiteId: {
        index: 'spacecat-data-experiment-by-site-id',
        pk: {
          field: 'gsi1pk',
          composite: ['siteId'],
        },
        sk: {
          field: 'gsi1sk',
          composite: ['updatedAt'],
        },
      },
      bySiteIdAndExpIdAndUrl: {
        index: 'spacecat-data-experiment-by-site-id-and-experiment-id-and-url',
        pk: {
          field: 'gsi2pk',
          composite: ['siteId', 'expId', 'url'],
        },
        sk: {
          field: 'gsi2sk',
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

export default ExperimentSchema;
