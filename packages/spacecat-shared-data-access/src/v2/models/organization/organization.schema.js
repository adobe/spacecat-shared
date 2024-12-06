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

import { DEFAULT_CONFIG, validateConfiguration } from '../../../models/site/config.js';
import { DEFAULT_ORGANIZATION_ID } from '../../../models/organization.js';

import createSchema from '../base/base.schema.js';

/*
Schema Doc: https://electrodb.dev/en/modeling/schema/
Attribute Doc: https://electrodb.dev/en/modeling/attributes/
Indexes Doc: https://electrodb.dev/en/modeling/indexes/
 */

const OrganizationSchema = createSchema(
  'Organization',
  '1',
  'SpaceCat',
  {
    // add your custom attributes here. the primary id and
    // timestamps are created by default via the base schema.
    attributes: {
      config: {
        type: 'any',
        required: true,
        default: DEFAULT_CONFIG,
        validate: (value) => isNonEmptyObject(validateConfiguration(value)),
      },
      name: {
        type: 'string',
        required: true,
      },
      imsOrgId: {
        type: 'string',
        default: DEFAULT_ORGANIZATION_ID,
      },
      fulfillableItems: {
        type: 'any',
        validate: (value) => !value || isNonEmptyObject(value),
      },
    },
    // add your custom indexes here. the primary index is created by default via the base schema
    indexes: {
      all: {
        index: 'spacecat-data-organization-all',
        pk: {
          field: 'gsi1pk',
          template: 'ALL_ORGANIZATIONS',
        },
        sk: {
          field: 'gsi1sk',
          composite: ['imsOrgId'],
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
      has_many: [
        { target: 'Sites' },
      ],
    },
  },
);

export default OrganizationSchema;
