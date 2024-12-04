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

import { isValidUrl } from '@adobe/spacecat-shared-utils';

import createSchema from '../base/base.schema.js';
import { SCOPE_NAMES } from './api-key.model.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const ApiKeySchema = createSchema(
  'ApiKey',
  '1',
  'SpaceCat',
  {
    // add your custom attributes here. the primary id and
    // timestamps are created by default via the base schema.
    attributes: {
      hashedApiKey: {
        type: 'string',
        required: true,
      },
      imsUserId: {
        type: 'string',
      },
      imsOrgId: {
        type: 'string',
      },
      name: {
        type: 'string',
        required: true,
      },
      deletedAt: {
        type: 'number',
      },
      expiresAt: {
        type: 'number',
      },
      revokedAt: {
        type: 'number',
      },
      scopes: {
        type: 'list',
        required: true,
        items: {
          type: 'map',
          properties: {
            domains: {
              type: 'list',
              items: {
                type: 'string',
                validate: (value) => isValidUrl(value),
              },
            },
            name: { type: SCOPE_NAMES },
          },
        },
      },
    },
    // add your custom indexes here. the primary index is created by default via the base schema
    indexes: {
      all: {
        index: 'spacecat-data-api-key-all',
        pk: {
          field: 'gsi1pk',
          template: 'ALL_API_KEYS',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['hashedApiKey'],
        },
      },
      byImsUserIdAndImsOrgId: {
        index: 'spacecat-data-api-key-by-ims-user-id-and-ims-org-id',
        pk: {
          field: 'gsi2pk',
          composite: ['imsUserId', 'imsOrgId'],
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
      has_many: [
        { target: 'Opportunities' },
      ],
    },
  },
);

export default ApiKeySchema;
